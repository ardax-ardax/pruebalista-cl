// Edge function: genera una pregunta alineada a un OA usando Lovable AI Gateway.
// Devuelve un objeto compatible con la interfaz `Question` (subset suficiente para
// que el cliente lo combine con `newQuestion(type)`).

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
      },
      required: ["prompt", "points", "answerLines"],
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
      return new Response(
        JSON.stringify({ error: "Límite de uso alcanzado. Intenta nuevamente en unos segundos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "Sin créditos disponibles en Lovable AI. Recarga en Settings > Workspace > Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Error del proveedor de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await aiResp.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    const argStr = toolCall?.function?.arguments;
    if (!argStr) {
      return new Response(JSON.stringify({ error: "La IA no devolvió una pregunta válida" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(argStr);
    } catch {
      return new Response(JSON.stringify({ error: "La IA devolvió JSON inválido" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
