// Hoja de Respuestas Básica — HTML inline para preview / PDF print.
// Se inyecta al final del assessment con break-before: page.

import type { Assessment, Question } from "./assessment-schema";

type Entry = { num: number; type: "mc"; options: string[] } | { num: number; type: "tf" };

function buildEntries(questions: Question[]): Entry[] {
  const entries: Entry[] = [];
  let num = 1;
  for (const q of questions) {
    if (q.type === "section-title" || q.type === "info-block" || q.type === "short-answer") continue;
    if (q.type === "multiple-choice" && q.options) {
      entries.push({ num, type: "mc", options: q.options.map((_, i) => String.fromCharCode(65 + i)) });
    } else if (q.type === "true-false") {
      entries.push({ num, type: "tf" });
    }
    num++;
  }
  return entries;
}

export function renderResponseSheetHtml(assessment: Assessment, institutionName: string): string {
  const entries = buildEntries(assessment.questions);
  if (entries.length === 0) return "";

  const COLS = entries.length > 30 ? 3 : entries.length > 15 ? 2 : 1;
  const perCol = Math.ceil(entries.length / COLS);

  const columns: string[] = [];
  for (let c = 0; c < COLS; c++) {
    const slice = entries.slice(c * perCol, (c + 1) * perCol);
    const rows = slice
      .map((e) => {
        const bubbles =
          e.type === "mc"
            ? e.options.map((l) => `<span class="rs-bubble">${l}</span>`).join("")
            : `<span class="rs-bubble">V</span><span class="rs-bubble">F</span>`;
        return `<tr><td class="rs-num">${e.num}.</td><td class="rs-opts">${bubbles}</td></tr>`;
      })
      .join("");
    columns.push(`<table class="rs-col"><tbody>${rows}</tbody></table>`);
  }

  return `
<div class="rs-page">
  <div class="rs-header">
    <div class="rs-institution">${esc(institutionName)}</div>
    <div class="rs-title">Hoja de Respuestas — ${esc(assessment.meta.title)}</div>
    <div class="rs-fields">
      <div class="rs-field"><span class="rs-field-label">Nombre:</span><span class="rs-field-line"></span></div>
      <div class="rs-field-row">
        <div class="rs-field rs-field-half"><span class="rs-field-label">Curso:</span><span class="rs-field-line"></span></div>
        <div class="rs-field rs-field-half"><span class="rs-field-label">Fecha:</span><span class="rs-field-line"></span></div>
      </div>
      <div class="rs-field-row">
        <div class="rs-field rs-field-half"><span class="rs-field-label">Puntaje:</span><span class="rs-field-line"></span></div>
        <div class="rs-field rs-field-half"><span class="rs-field-label">Nota:</span><span class="rs-field-line"></span></div>
      </div>
    </div>
  </div>
  <div class="rs-grid">${columns.join("")}</div>
  <div class="rs-footer">Total: ${entries.length} preguntas</div>
</div>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** CSS for the inline response sheet (appended to ASSESSMENT_CSS). */
export const RESPONSE_SHEET_INLINE_CSS = `
  .rs-page {
    break-before: page;
    page-break-before: always;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    color: #000;
  }
  .rs-header { margin-bottom: 16pt; border-bottom: 1.5pt solid #000; padding-bottom: 10pt; }
  .rs-institution { font-size: 11pt; font-weight: bold; text-align: center; margin-bottom: 2pt; }
  .rs-title { font-size: 12pt; font-weight: bold; text-align: center; margin-bottom: 10pt; }
  .rs-fields { margin-top: 8pt; }
  .rs-field { display: flex; align-items: baseline; gap: 4pt; margin-bottom: 6pt; }
  .rs-field-label { font-weight: bold; white-space: nowrap; font-size: 9pt; }
  .rs-field-line { flex: 1; border-bottom: 0.5pt solid #000; min-width: 80pt; }
  .rs-field-row { display: flex; gap: 16pt; }
  .rs-field-half { flex: 1; display: flex; align-items: baseline; gap: 4pt; margin-bottom: 6pt; }
  .rs-grid { display: flex; gap: 12pt; justify-content: space-between; }
  .rs-col { flex: 1; border-collapse: collapse; }
  .rs-col tr { border-bottom: 0.5pt solid #ddd; }
  .rs-num { padding: 3pt 4pt 3pt 0; font-weight: bold; font-size: 9pt; text-align: right; width: 24pt; vertical-align: middle; }
  .rs-opts { padding: 3pt 0; vertical-align: middle; }
  .rs-bubble {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18pt; height: 18pt; border: 1pt solid #000; border-radius: 50%;
    font-size: 8pt; font-weight: bold; margin-right: 4pt; text-align: center;
  }
  .rs-footer { margin-top: 10pt; font-size: 8pt; color: #666; text-align: right; }
`;
