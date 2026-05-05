// Pauta de Corrección / Solucionario — HTML inline para preview / PDF print.
// Se inyecta al final del assessment con break-before: page.
// Reutiliza el mismo encabezado institucional de la evaluación.

import type { Assessment, Question } from "./assessment-schema";
import type { RenderContext } from "./assessment-render";
import { sanitizeRichText } from "./rich-text";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

interface AKEntry {
  num: number;
  type: "mc" | "tf" | "dev";
  answer: string;   // e.g. "A", "V", "F"
  detail: string;   // text of the correct option / rubric
}

function buildEntries(questions: Question[]): AKEntry[] {
  const entries: AKEntry[] = [];
  let num = 1;
  for (const q of questions) {
    if (q.type === "section-title" || q.type === "info-block") continue;

    if (q.type === "multiple-choice" && q.options) {
      const correctIdx = q.options.findIndex((o) => o.correct);
      const letter = correctIdx >= 0 ? String.fromCharCode(65 + correctIdx) : "—";
      const text = correctIdx >= 0 ? stripHtml(q.options[correctIdx].text) : "";
      entries.push({ num, type: "mc", answer: letter, detail: text });
    } else if (q.type === "true-false" && q.statements) {
      for (const st of q.statements) {
        entries.push({ num, type: "tf", answer: st.answer, detail: stripHtml(st.text) });
        num++;
      }
      continue; // num already incremented per statement
    } else if (q.type === "short-answer") {
      const rubric = q.rubric || "";
      entries.push({ num, type: "dev", answer: "Desarrollo", detail: stripHtml(rubric) });
    }
    num++;
  }
  return entries;
}

export function renderAnswerKeyHtml(ctx: RenderContext): string {
  const { assessment, template, logoDataUrl, institutionName, subjectLabel, gradeLabel, teacherLabel } = ctx;
  const meta = assessment.meta;
  const entries = buildEntries(assessment.questions);
  if (entries.length === 0) return "";

  // Institutional banner (same as the assessment)
  const showGradeBox = template.header?.style === "banner-evaluacion";
  const banner = template.header?.enabled
    ? `<table class="pa-banner"><tr>
        <td class="pa-logo-cell">${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo" />` : ""}</td>
        <td class="pa-info-cell">
          <div class="pa-inst-name">${esc(institutionName)}</div>
          <div class="pa-row"><span><strong>Profesor/a:</strong> ${esc(teacherLabel || "")}</span></div>
          <div class="pa-row"><span><strong>Asignatura:</strong> ${esc(subjectLabel || "")}</span><span><strong>Curso:</strong> ${esc(gradeLabel || "")}</span></div>
          ${meta.date ? `<div class="pa-row"><span><strong>Fecha:</strong> ${esc(meta.date)}</span></div>` : ""}
        </td>
        ${showGradeBox ? `<td class="pa-grade-cell" style="visibility:hidden">—</td>` : ""}
      </tr></table>`
    : "";

  // Split MC/TF entries for column layout
  const mcTfEntries = entries.filter((e) => e.type === "mc" || e.type === "tf");
  const devEntries = entries.filter((e) => e.type === "dev");

  // MC/TF in columns
  let mcTfHtml = "";
  if (mcTfEntries.length > 0) {
    const COLS = mcTfEntries.length > 20 ? 3 : mcTfEntries.length > 10 ? 2 : 1;
    const perCol = Math.ceil(mcTfEntries.length / COLS);
    const columns: string[] = [];
    for (let c = 0; c < COLS; c++) {
      const slice = mcTfEntries.slice(c * perCol, (c + 1) * perCol);
      const rows = slice
        .map((e) => {
          const badge = e.type === "mc"
            ? `<span class="ak-badge">${esc(e.answer)}</span>`
            : `<span class="ak-badge ak-badge-${e.answer === "V" ? "v" : "f"}">${e.answer}</span>`;
          return `<tr><td class="ak-num">${e.num}.</td><td class="ak-ans">${badge}</td><td class="ak-detail">${esc(e.detail)}</td></tr>`;
        })
        .join("");
      columns.push(`<table class="ak-col"><tbody>${rows}</tbody></table>`);
    }
    mcTfHtml = `<div class="ak-grid">${columns.join("")}</div>`;
  }

  // Development questions (full width)
  let devHtml = "";
  if (devEntries.length > 0) {
    const items = devEntries
      .map((e) => `<div class="ak-dev-item"><div class="ak-dev-num">${e.num}. Desarrollo</div><div class="ak-dev-rubric">${esc(e.detail) || "<em>Sin criterios definidos</em>"}</div></div>`)
      .join("");
    devHtml = `<div class="ak-dev-section"><div class="ak-dev-title">Preguntas de Desarrollo — Criterios de Corrección</div>${items}</div>`;
  }

  return `
<div class="ak-page">
  ${banner}
  <div class="ak-title">Pauta de Corrección / Solucionario</div>
  <div class="ak-subtitle">${esc(meta.title || "")}</div>
  ${mcTfHtml}
  ${devHtml}
  <div class="ak-footer">Documento de uso exclusivo del docente · ${entries.length} respuestas</div>
</div>`;
}

/** CSS for the answer key page (appended to ASSESSMENT_CSS). */
export const ANSWER_KEY_CSS = `
  .ak-page {
    break-before: page;
    page-break-before: always;
    font-family: "Century Gothic", "Apple Gothic", "URW Gothic", "Avenir", Arial, sans-serif;
    font-size: 10pt;
    color: #000;
  }
  .ak-title {
    font-size: 13pt;
    font-weight: bold;
    text-align: center;
    margin-top: 12pt;
    margin-bottom: 2pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
  }
  .ak-subtitle {
    font-size: 10pt;
    text-align: center;
    margin-bottom: 14pt;
    color: #444;
  }
  .ak-grid { display: flex; gap: 10pt; justify-content: space-between; margin-bottom: 14pt; }
  .ak-col { flex: 1; border-collapse: collapse; }
  .ak-col tr { border-bottom: 0.5pt solid #ddd; }
  .ak-num { padding: 3pt 4pt 3pt 0; font-weight: bold; font-size: 9pt; text-align: right; width: 22pt; vertical-align: middle; }
  .ak-ans { padding: 3pt 6pt; vertical-align: middle; width: 28pt; text-align: center; }
  .ak-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 20pt; height: 20pt; border-radius: 50%;
    background: #2563eb; color: #fff;
    font-size: 9pt; font-weight: bold;
  }
  .ak-badge-v { background: #16a34a; }
  .ak-badge-f { background: #dc2626; }
  .ak-detail { padding: 3pt 0; font-size: 8.5pt; color: #333; vertical-align: middle; }
  .ak-dev-section { margin-top: 10pt; }
  .ak-dev-title { font-size: 10pt; font-weight: bold; margin-bottom: 6pt; border-bottom: 1pt solid #000; padding-bottom: 3pt; }
  .ak-dev-item { margin-bottom: 8pt; padding-left: 4pt; }
  .ak-dev-num { font-weight: bold; font-size: 9pt; margin-bottom: 2pt; }
  .ak-dev-rubric { font-size: 9pt; color: #333; padding-left: 8pt; white-space: pre-wrap; }
  .ak-footer { margin-top: 14pt; font-size: 8pt; color: #888; text-align: center; border-top: 0.5pt solid #ccc; padding-top: 6pt; }
`;
