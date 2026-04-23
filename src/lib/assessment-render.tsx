// Renderer único de evaluaciones. Produce React (preview) y HTML (PDF print).
// Mismo CSS para ambos para que coincidan visualmente.

import type { CSSProperties, ReactNode } from "react";
import type { Assessment, Question, QuestionImage } from "./assessment-schema";
import type { FormatTemplate } from "./templates";
import { sanitizeRichText } from "./rich-text";

export interface RenderContext {
  assessment: Assessment;
  template: FormatTemplate;
  logoDataUrl: string | null;
  institutionName: string;
  subjectLabel: string;
  gradeLabel: string;
  teacherLabel: string;
}

// === CSS común para preview y print ===
export const ASSESSMENT_CSS = `
  .pa-page {
    font-family: "Century Gothic", "Apple Gothic", "URW Gothic", "Avenir", Arial, sans-serif;
    font-size: 10pt;
    color: #000;
    line-height: 1.35;
  }
  .pa-banner {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-bottom: 12pt;
    border: 0.75pt solid #000;
  }
  .pa-banner td {
    border: 0.75pt solid #000;
    padding: 4pt 6pt;
    vertical-align: middle;
    font-size: 9pt;
  }
  .pa-banner .pa-logo-cell { width: 22%; text-align: center; }
  .pa-banner .pa-logo-cell img { max-width: 90%; max-height: 60pt; }
  .pa-banner .pa-info-cell { width: 56%; }
  .pa-banner .pa-grade-cell { width: 22%; text-align: center; font-weight: bold; }
  .pa-banner .pa-info-cell .pa-inst-name {
    font-size: 11pt; font-weight: bold; text-align: center; margin-bottom: 2pt;
  }
  .pa-banner .pa-info-cell .pa-row {
    display: flex; justify-content: space-between; gap: 8pt;
  }
  .pa-banner .pa-info-cell .pa-row span { white-space: nowrap; }
  .pa-student-row {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-bottom: 10pt;
  }
  .pa-student-row td {
    border-bottom: 0.5pt solid #000;
    padding: 4pt 4pt;
    font-size: 9pt;
  }
  .pa-title { font-size: 12pt; font-weight: bold; text-align: center; margin: 6pt 0 4pt; text-transform: uppercase; }
  .pa-instructions { font-size: 10pt; text-align: justify; margin: 6pt 0 10pt; }
  .pa-instructions strong { font-weight: bold; }
  .pa-question { margin: 0 0 14pt; padding-bottom: 8pt; border-bottom: 0.5pt solid #d0d0d0; page-break-inside: avoid; break-inside: avoid; }
  .pa-question.pa-no-sep { border-bottom: none; padding-bottom: 0; }
  .pa-question-title { font-weight: bold; font-size: 10pt; margin-top: 2pt; margin-bottom: 1pt; break-after: avoid; page-break-after: avoid; }
  .pa-question-header { font-weight: normal; font-size: 10pt; margin-bottom: 3pt; break-after: avoid; page-break-after: avoid; }
  .pa-question-header b, .pa-question-header strong { font-weight: bold; }
  .pa-question-header i, .pa-question-header em { font-style: italic; }
  .pa-question-header u { text-decoration: underline; }
  .pa-question-number { font-weight: bold; }
  .pa-question-prompt { text-align: justify; }
  .pa-question-points { float: right; font-weight: normal; font-style: italic; }
  .pa-options { margin: 4pt 0 0 14pt; padding: 0; list-style: none; break-inside: avoid; page-break-inside: avoid; }
  .pa-options li { margin: 2pt 0; }
  .pa-option-letter { font-weight: bold; margin-right: 4pt; }
  .pa-statements { margin: 4pt 0 0 0; padding: 0; list-style: none; }
  .pa-statements li { margin: 4pt 0; }
  .pa-statement-vf { display: inline-block; font-weight: bold; margin-right: 6pt; letter-spacing: 1pt; }
  .pa-statement-num { font-weight: bold; margin-right: 4pt; }
  .pa-answer-line { border-bottom: 0.5pt solid #000; height: 14pt; margin: 4pt 0; }
  .pa-info-block { background: #f3f3f3; border-left: 2pt solid #000; padding: 6pt 8pt; margin: 6pt 0 10pt; font-style: italic; break-inside: avoid; page-break-inside: avoid; break-after: avoid; page-break-after: avoid; }
  .pa-section-title { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 14pt 0 6pt; border-bottom: 0.75pt solid #000; padding-bottom: 2pt; break-after: avoid; page-break-after: avoid; }
  .pa-image-wrap { margin: 6pt 0; break-inside: avoid; page-break-inside: avoid; }
  .pa-image-wrap.pa-align-left { text-align: left; }
  .pa-image-wrap.pa-align-center { text-align: center; }
  .pa-image-wrap.pa-align-right { text-align: right; }
  .pa-image-crop { display: inline-block; overflow: hidden; vertical-align: top; position: relative; }
  .pa-image-crop img { display: block; max-width: none; height: auto; }
  .pa-image-plain { display: inline-block; height: auto; }
  .pa-mc-split { width: 100%; border-collapse: collapse; margin-top: 4pt; table-layout: fixed; break-inside: avoid; page-break-inside: avoid; }
  .pa-statements { break-inside: avoid; page-break-inside: avoid; }
  .pa-mc-split td { vertical-align: top; padding: 0; border: 0; }
  .pa-mc-split .pa-mc-text { width: 80%; padding-right: 8pt; }
  .pa-mc-split .pa-mc-image { width: 20%; padding-left: 8pt; height: 1px; }
  .pa-mc-image .pa-image-wrap { width: 100%; height: 100%; max-height: 100%; display: flex; align-items: flex-start; margin: 0; }
  .pa-mc-image .pa-image-wrap.pa-align-left { justify-content: flex-start; }
  .pa-mc-image .pa-image-wrap.pa-align-center { justify-content: center; }
  .pa-mc-image .pa-image-wrap.pa-align-right { justify-content: flex-end; }
  .pa-mc-image .pa-image-crop { max-width: 100%; max-height: 100%; }
  .pa-mc-image .pa-image-crop-inner { width: 100%; height: 100%; overflow: hidden; position: relative; }
  .pa-mc-image .pa-image-plain { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; }
`;

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ====================== HTML render (para PDF) ======================

export function renderAssessmentHtml(ctx: RenderContext): string {
  const { assessment, template, logoDataUrl, institutionName, subjectLabel, gradeLabel, teacherLabel } = ctx;
  const meta = assessment.meta;
  const showGradeBox = template.header?.style === "banner-evaluacion";

  const banner = template.header?.enabled
    ? `<table class="pa-banner"><tr>
        <td class="pa-logo-cell">${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo" />` : ""}</td>
        <td class="pa-info-cell">
          <div class="pa-inst-name">${escape(institutionName)}</div>
          <div class="pa-row"><span><strong>Profesor/a:</strong> ${escape(teacherLabel || "")}</span></div>
          <div class="pa-row"><span><strong>Asignatura:</strong> ${escape(subjectLabel || "")}</span><span><strong>Curso:</strong> ${escape(gradeLabel || "")}</span></div>
          ${meta.date ? `<div class="pa-row"><span><strong>Fecha:</strong> ${escape(meta.date)}</span></div>` : ""}
        </td>
        ${showGradeBox ? `<td class="pa-grade-cell">Calificación<br/><br/><br/></td>` : `<td class="pa-grade-cell">Pje. Total<br/><strong>${meta.totalPoints}</strong></td>`}
      </tr></table>`
    : "";

  const studentRow = `<table class="pa-student-row"><tr>
    <td style="width:65%"><strong>Nombre:</strong> ${escape(meta.studentName || "")}</td>
    <td style="width:35%"><strong>Puntaje obtenido:</strong></td>
  </tr></table>`;

  const title = meta.title ? `<div class="pa-title">${escape(meta.title)}</div>` : "";
  const instructions = meta.instructions
    ? `<div class="pa-instructions"><strong>Instrucciones:</strong> ${escape(meta.instructions)}</div>`
    : "";

  let qNum = 0;
  const questionsHtml = assessment.questions
    .map((q, i) => {
      if (q.type === "section-title") {
        return `<div class="pa-section-title">${escape(q.prompt || "Sección")}</div>`;
      }
      if (q.type === "info-block") {
        return `<div class="pa-info-block">${escape(q.prompt)}</div>`;
      }
      qNum += 1;
      const next = assessment.questions[i + 1];
      const noSep = !next || next.type === "section-title" || next.type === "info-block";
      const totalPts =
        q.type === "true-false"
          ? (q.statements ?? []).reduce((s, st) => s + (st.points ?? 0), 0)
          : (q.points ?? 0);
      const pts = totalPts
        ? `<span class="pa-question-points">(${totalPts} pt${totalPts === 1 ? "" : "s"})</span>`
        : "";
      const titleHtml = q.title ? `<div class="pa-question-title">${escape(q.title)}</div>` : "";
      const header = `${titleHtml}<div class="pa-question-header">${pts}<span class="pa-question-number">${qNum})</span> ${sanitizeRichText(q.prompt)}</div>`;
      // Para selección múltiple con imagen siempre forzamos split: opciones izq, imagen der.
      const isSplit = q.type === "multiple-choice" && !!q.image;
      const layout: "side-left" | "side-right" | "block" = isSplit ? "side-right" : (q.imageLayout ?? "block");
      const headerImg = q.image && !isSplit ? renderImageHtml(q.image) : "";
      let body = "";
      if (q.type === "multiple-choice") {
        const letters = ["a", "b", "c", "d", "e", "f"];
        const optionsList = `<ol class="pa-options">${(q.options ?? [])
          .map((o, i) => {
            const optImg = o.image ? renderImageHtml(o.image) : "";
            return `<li><span class="pa-option-letter">${letters[i] ?? i + 1})</span>${escape(o.text)}${optImg}</li>`;
          })
          .join("")}</ol>`;
        if (isSplit && q.image) {
          const imgCell = `<td class="pa-mc-image">${renderContainedImageHtml(q.image)}</td>`;
          const txtCell = `<td class="pa-mc-text">${optionsList}</td>`;
          body = `<table class="pa-mc-split"><tr>${layout === "side-left" ? imgCell + txtCell : txtCell + imgCell}</tr></table>`;
        } else {
          body = optionsList;
        }
      } else if (q.type === "true-false") {
        body = `<ol class="pa-statements">${(q.statements ?? [])
          .map((st, i) => {
            const stImg = st.image ? renderImageHtml(st.image) : "";
            return `<li><span class="pa-statement-vf">( V ) ( F )</span><span class="pa-statement-num">${qNum}.${i + 1}</span>${escape(st.text)}${stImg}</li>`;
          })
          .join("")}</ol>`;
      } else if (q.type === "short-answer") {
        const lines = Math.max(1, q.answerLines ?? 3);
        body = Array.from({ length: lines })
          .map(() => `<div class="pa-answer-line"></div>`)
          .join("");
      }
      return `<div class="pa-question${noSep ? " pa-no-sep" : ""}">${header}${headerImg}${body}</div>`;
    })
    .join("");

  return `<div class="pa-page">${banner}${studentRow}${title}${instructions}${questionsHtml}</div>`;
}

// Render imagen sin deformación: wrapper con aspect-ratio basado en dimensiones
// naturales y porcentajes de crop. <img> solo recibe width; height es auto.
function renderImageHtml(img: QuestionImage): string {
  const { left: L, right: R, top: T, bottom: B } = img.crop;
  const visibleW = Math.max(1, 100 - L - R);
  const visibleH = Math.max(1, 100 - T - B);
  // Clamp dependiente de alineación: centro hasta 50%, left/right hasta 20%.
  const maxPct = img.alignment === "center" ? 50 : 20;
  const safeWidthPct = Math.max(10, Math.min(maxPct, img.widthPct));
  const wrapperWidth = `${safeWidthPct}%`;
  const natW = img.naturalW ?? 4;
  const natH = img.naturalH ?? 3;
  const hasCrop = L > 0 || R > 0 || T > 0 || B > 0;

  if (!hasCrop) {
    // Sin crop: imagen libre con aspect-ratio natural.
    return `<div class="pa-image-wrap pa-align-${img.alignment}"><img class="pa-image-plain" src="${img.src}" alt="${escape(img.alt ?? "")}" style="width:${wrapperWidth};" /></div>`;
  }

  // Con crop: aspect-ratio del wrapper = (natW * visibleW%) / (natH * visibleH%)
  const ratio = (natW * (visibleW / 100)) / Math.max(1, natH * (visibleH / 100));
  const inner = `<img src="${img.src}" alt="${escape(img.alt ?? "")}" style="width:${(100 / visibleW) * 100}%;height:auto;margin-left:${-(L / visibleW) * 100}%;margin-top:${-(T / visibleH) * 100}%;" />`;
  return `<div class="pa-image-wrap pa-align-${img.alignment}"><span class="pa-image-crop" style="width:${wrapperWidth};aspect-ratio:${ratio};">${inner}</span></div>`;
}

// ====================== React render (para preview en pantalla) ======================

export function AssessmentPreviewRender({ ctx }: { ctx: RenderContext }) {
  const html = renderAssessmentHtml(ctx);
  const wrapperStyle: CSSProperties = {
    background: "white",
    color: "black",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    padding: "2cm 2cm 2cm 2.5cm",
    width: `${ctx.template.pageSize.widthCm}cm`,
    minHeight: `${ctx.template.pageSize.heightCm}cm`,
    margin: "0 auto",
    boxSizing: "border-box",
  };
  return (
    <>
      <style>{ASSESSMENT_CSS}</style>
      <div style={wrapperStyle} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

export function renderQuestionNumber(questions: Question[], index: number): number | null {
  let n = 0;
  for (let i = 0; i <= index; i++) {
    const t = questions[i].type;
    if (t === "section-title" || t === "info-block") continue;
    n += 1;
  }
  const cur = questions[index].type;
  if (cur === "section-title" || cur === "info-block") return null;
  return n;
}

// Variante de imagen para layout split: limita altura al alto de la celda
// (que se iguala con la celda de opciones gracias a height:1px en CSS).
// Mantiene proporción del crop usando aspect-ratio inline.
function renderContainedImageHtml(img: QuestionImage): string {
  const { left: L, right: R, top: T, bottom: B } = img.crop;
  const visibleW = Math.max(1, 100 - L - R);
  const visibleH = Math.max(1, 100 - T - B);
  const natW = img.naturalW ?? 4;
  const natH = img.naturalH ?? 3;
  const hasCrop = L > 0 || R > 0 || T > 0 || B > 0;
  // En layout split MC siempre centramos la imagen en su columna.
  const alignClass = `pa-align-center`;

  if (!hasCrop) {
    // Sin crop: ocupa toda la columna; max-height de la celda evita exceder el alto.
    return `<div class="pa-image-wrap ${alignClass}"><img class="pa-image-plain" src="${img.src}" alt="${escape(img.alt ?? "")}" /></div>`;
  }

  const ratio = (natW * (visibleW / 100)) / Math.max(1, natH * (visibleH / 100));
  // Wrapper con aspect-ratio del recorte; max-width/max-height de la celda
  // reducirán la imagen manteniendo proporción cuando exceda.
  const inner = `<div class="pa-image-crop-inner"><img src="${img.src}" alt="${escape(img.alt ?? "")}" style="position:absolute;width:${(100 / visibleW) * 100}%;height:auto;left:${-(L / visibleW) * 100}%;top:${-(T / visibleH) * 100}%;" /></div>`;
  return `<div class="pa-image-wrap ${alignClass}"><span class="pa-image-crop" style="aspect-ratio:${ratio};width:100%;">${inner}</span></div>`;
}

export const _internal = { renderImageHtml };

export type AssessmentChildren = ReactNode;
