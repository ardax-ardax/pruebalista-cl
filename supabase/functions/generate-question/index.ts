// Edge function: genera una pregunta alineada a un OA usando Lovable AI Gateway.
// Verifica créditos del usuario antes de llamar a la IA.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Indicator {
  code: string;
  description: string;
}

interface Payload {
  oaCode: string;
  oaDescription: string;
  gradeLabel: string;
  subjectLabel: string;
  questionType: "multiple-choice" | "true-false" | "short-answer";
  indicators?: Indicator[];
}

const COMMON_FIELDS = {
  difficulty: { type: "string", enum: ["baja", "media", "alta"], description: "Dificultad estimada." },
  rubricExplanation: { type: "string", description: "Explicación pedagógica con la respuesta correcta y criterios para corregir (pauta)." },
};

const TOOL_MC = {
  type: "function" as const,
  function: {
    name: "emit_question",
    description: "Emite una pregunta de selección múltiple alineada al OA.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Enunciado claro y autocontenido." },
        points: { type: "number", description: "Puntaje sugerido (1-3)." },
        options: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              correct: { type: "boolean" },
            },
            required: ["text", "correct"],
            additionalProperties: false,
          },
        },
        ...COMMON_FIELDS,
      },
      required: ["prompt", "points", "options", "difficulty", "rubricExplanation"],
      additionalProperties: false,
    },
  },
};

const TOOL_TF = {
  type: "function" as const,
  function: {
    name: "emit_question",
    description: "Emite un ítem de Verdadero/Falso con varias afirmaciones.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Instrucción del ítem (ej: Marca V o F)." },
        statements: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              answer: { type: "string", enum: ["V", "F"] },
              points: { type: "number" },
            },
            required: ["text", "answer", "points"],
            additionalProperties: false,
          },
        },
        ...COMMON_FIELDS,
      },
      required: ["prompt", "statements", "difficulty", "rubricExplanation"],
      additionalProperties: false,
    },
  },
};

const TOOL_SA = {
  type: "function" as const,
  function: {
    name: "emit_question",
    description: "Emite una pregunta de desarrollo / respuesta corta.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        points: { type: "number" },
        answerLines: { type: "number", description: "Líneas de respuesta sugeridas (1-10)." },
        ...COMMON_FIELDS,
      },
      required: ["prompt", "points", "answerLines", "difficulty", "rubricExplanation"],
      additionalProperties: false,
    },
  },
};

function pickTool(t: Payload["questionType"]) {
  if (t === "multiple-choice") return TOOL_MC;
  if (t === "true-false") return TOOL_TF;
  return TOOL_SA;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurada");

    // --- Autenticar usuario ---
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente con token del usuario para obtener uid
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Verificar créditos con service role ---
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: usageRow } = await adminClient
      .from("user_usage")
      .select("credits_available, plan_type, plan_expires_at, monthly_quota")
      .eq("user_id", user.id)
      .maybeSingle();

    const rawPlan = usageRow?.plan_type ?? "free";
    const credits = usageRow?.credits_available ?? 0;
    const expiresAt = usageRow?.plan_expires_at;
    const monthlyQuota = usageRow?.monthly_quota ?? null;

    // Compute effective plan respecting expiration
    let planType = rawPlan;
    if (rawPlan !== "free" && expiresAt && new Date(expiresAt) <= new Date()) {
      planType = "free";
    }

    if (!usageRow) {
      await adminClient.from("user_usage").insert({ user_id: user.id });
    }

    // Determine if we need to deduct credits for this request
    // Institucional WITHOUT quota = unlimited (no deduction needed)
    const needsDeduction = planType !== "institucional" || monthlyQuota !== null;

    // --- ATOMIC credit reservation BEFORE calling the AI ---
    // This prevents race conditions where concurrent requests both pass the check.
    let creditReserved = false;
    if (needsDeduction) {
      const { data: deducted, error: deductErr } = await adminClient
        .from("user_usage")
        .update({ credits_available: Math.max(0, credits - 1) })
        .eq("user_id", user.id)
        .gt("credits_available", 0)
        .select("credits_available")
        .maybeSingle();

      if (deductErr || !deducted) {
        // No row updated → user has 0 credits
        const errMsg = planType === "institucional"
          ? "Has alcanzado tu cuota mensual de generaciones IA asignada por la UTP. Contacta a tu Jefe de UTP para solicitar más créditos."
          : "Sin créditos de IA disponibles. Mejora tu plan para seguir generando preguntas.";
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      creditReserved = true;
    }

    const body = (await req.json()) as Payload;
    if (!body?.oaCode || !body?.oaDescription || !body?.questionType) {
      return new Response(JSON.stringify({ error: "Parámetros faltantes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tool = pickTool(body.questionType);

    const systemPrompt = `Eres un docente experto del sistema escolar chileno. Diseñas evaluaciones alineadas a las Bases Curriculares (Mineduc).
Reglas estrictas:
- Redacta en español de Chile, claro y libre de ambigüedades.
- Adapta la complejidad al curso indicado.
- Las preguntas deben evaluar exactamente el OA entregado.
- Si se entregan Indicadores de Evaluación específicos, la pregunta debe enfocarse en ellos prioritariamente, sin perder alineación con el OA.
- En selección múltiple: 4 alternativas plausibles, exactamente 1 correcta, distractores realistas (no obvios ni absurdos).
- En V/F: afirmaciones bien formuladas, mezcla equilibrada de V y F.
- No incluyas la respuesta dentro del enunciado.
- Estima la dificultad ("baja", "media" o "alta") según el curso.
- Entrega siempre 'rubricExplanation': respuesta correcta detallada y criterios de corrección para la pauta.
- Devuelve la pregunta exclusivamente vía la tool 'emit_question'.`;

    const indicatorsBlock =
      body.indicators && body.indicators.length > 0
        ? `\nIndicadores específicos a evaluar:\n${body.indicators
            .map((i) => `- ${i.code}: ${i.description}`)
            .join("\n")}\nLa pregunta debe centrarse explícitamente en estos indicadores.`
        : "";

    const userPrompt = `Curso: ${body.gradeLabel}
Asignatura: ${body.subjectLabel}
Objetivo de Aprendizaje (${body.oaCode}): ${body.oaDescription}
Tipo de pregunta: ${body.questionType}${indicatorsBlock}

Genera una pregunta alineada al OA${body.indicators?.length ? " y a los indicadores señalados" : ""}.`;

    // Helper: refund the reserved credit when AI fails
    const refundCredit = async () => {
      if (creditReserved) {
        await adminClient
          .from("user_usage")
          .update({ credits_available: credits })
          .eq("user_id", user.id)
          .then(() => { creditReserved = false; });
      }
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "emit_question" } },
      }),
    });

    if (aiResp.status === 429) {
      await refundCredit();
      return new Response(
        JSON.stringify({ error: "Límite de uso alcanzado. Intenta nuevamente en unos segundos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiResp.status === 402) {
      await refundCredit();
      return new Response(
        JSON.stringify({ error: "Sin créditos disponibles en Lovable AI. Recarga en Settings > Workspace > Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      await refundCredit();
      return new Response(JSON.stringify({ error: "Error del proveedor de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await aiResp.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    const argStr = toolCall?.function?.arguments;
    if (!argStr) {
      await refundCredit();
      return new Response(JSON.stringify({ error: "La IA no devolvió una pregunta válida" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(argStr);
    } catch {
      await refundCredit();
      return new Response(JSON.stringify({ error: "La IA devolvió JSON inválido" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Registrar en ai_generation_log ---
    await adminClient
      .from("ai_generation_log")
      .insert({
        user_id: user.id,
        oa_code: body.oaCode,
        question_type: body.questionType,
      });

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-question error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
