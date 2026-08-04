// Edge function: descarga un PDF curricular oficial, extrae su texto y usa el
// AI Gateway de Lovable para devolver decreto, período y lista de OA estructurada.
// Solo para administradores.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TOOL = {
  type: "function" as const,
  function: {
    name: "emit_curriculum",
    description: "Emite los metadatos y los Objetivos de Aprendizaje extraídos del documento.",
    parameters: {
      type: "object",
      properties: {
        curriculum_decree: { type: "string", description: "Decreto que aprueba las bases (ej: 'Decreto 439/2012'). Vacío si no aparece." },
        curriculum_period: { type: "string", description: "Período de vigencia (ej: '2012-vigente'). Vacío si no aparece." },
        oas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              oa_code: { type: "string", description: "Código del OA tal como aparece, ej 'OA 01'." },
              grade_value: { type: "string", description: "Código interno del curso: 1basico..8basico, 1medio..4medio." },
              subject_value: { type: "string", description: "Código interno de la asignatura, ej matematica, lenguaje, historia, ciencias, ingles." },
              eje: { type: "string", description: "Eje temático. Vacío si no aplica." },
              oa_description: { type: "string", description: "Descripción textual completa del OA." },
            },
            required: ["oa_code", "grade_value", "subject_value", "eje", "oa_description"],
            additionalProperties: false,
          },
        },
      },
      required: ["curriculum_decree", "curriculum_period", "oas"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurada");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "No autenticado" }, 401);

    const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Solo administradores" }, 403);

    const { url } = (await req.json()) as { url?: string };
    if (!url || !/^https?:\/\//i.test(url)) return json({ error: "URL inválida" }, 400);

    // --- Descargar PDF ---
    const pdfResp = await fetch(url);
    if (!pdfResp.ok) return json({ error: `No se pudo descargar el PDF (${pdfResp.status})` }, 400);
    const buf = new Uint8Array(await pdfResp.arrayBuffer());

    // --- Extraer texto ---
    let text = "";
    try {
      const doc = await getDocumentProxy(buf);
      const res = await extractText(doc, { mergePages: true });
      text = (Array.isArray(res.text) ? res.text.join("\n") : res.text) || "";
    } catch (e) {
      console.error("pdf parse error", e);
      return json({ error: "No se pudo leer el contenido del PDF" }, 400);
    }
    text = text.replace(/\s+\n/g, "\n").trim();
    if (text.length < 200) return json({ error: "El PDF no contiene texto extraíble (¿es escaneado?)" }, 400);

    // Limitar el tamaño enviado al modelo.
    const MAX = 120_000;
    const excerpt = text.length > MAX ? text.slice(0, MAX) : text;

    const systemPrompt = `Eres un experto en el currículum escolar chileno (Mineduc).
Recibes el texto de un documento oficial de Bases Curriculares o Programa de Estudio.
Tu tarea es extraer:
- El decreto que aprueba las bases y el período de vigencia (si aparecen).
- TODOS los Objetivos de Aprendizaje (OA) presentes, con su código, eje temático y descripción textual completa (sin resumir ni reescribir).
Normaliza el curso a códigos internos: 1basico, 2basico, ..., 8basico, 1medio, 2medio, 3medio, 4medio.
Normaliza la asignatura a códigos internos en minúsculas sin acentos ni espacios (ej: matematica, lenguaje, historia, ciencias, biologia, fisica, quimica, ingles, artes, musica, tecnologia, educacion_fisica, orientacion, filosofia).
Si el documento cubre un solo curso y asignatura, usa ese mismo valor en todos los OA.
Devuelve el resultado exclusivamente vía la tool 'emit_curriculum'.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `URL: ${url}\n\nTexto del documento:\n\n${excerpt}` },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "emit_curriculum" } },
      }),
    });

    if (aiResp.status === 429) return json({ error: "Límite de uso de IA alcanzado. Intenta en unos segundos." }, 429);
    if (aiResp.status === 402) return json({ error: "Sin créditos de IA disponibles." }, 402);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return json({ error: "Error del proveedor de IA" }, 500);
    }

    const out = await aiResp.json();
    const argStr = out?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argStr) return json({ error: "La IA no devolvió datos estructurados" }, 500);

    let parsed: { curriculum_decree?: string; curriculum_period?: string; oas?: unknown[] };
    try {
      parsed = JSON.parse(argStr);
    } catch {
      return json({ error: "La IA devolvió JSON inválido" }, 500);
    }

    return json({
      curriculum_decree: parsed.curriculum_decree ?? "",
      curriculum_period: parsed.curriculum_period ?? "",
      source_url: url,
      oas: Array.isArray(parsed.oas) ? parsed.oas : [],
      truncated: text.length > MAX,
    });
  } catch (e) {
    console.error("extract-curriculum-pdf error", e);
    return json({ error: e instanceof Error ? e.message : "Error desconocido" }, 500);
  }
});
