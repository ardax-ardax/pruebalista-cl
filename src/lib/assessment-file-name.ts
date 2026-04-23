// Convención de nombre de archivo, reusando la lógica de templates + catálogo.
import type { FormatTemplate } from "./templates";
import { sanitizeFileToken } from "./catalog";
import type { AssessmentMeta } from "./assessment-schema";

export function buildAssessmentFileName(
  meta: AssessmentMeta,
  template: FormatTemplate | null,
  ext: "docx" | "pdf",
): string {
  const prefix = template?.fileNaming?.enabled
    ? template.fileNaming.prefix
    : "Evaluación";
  const parts = [
    prefix,
    meta.number ? `N°${sanitizeFileToken(meta.number)}` : "",
    meta.subjectValue ? sanitizeFileToken(meta.subjectValue) : "",
    meta.gradeValue ? sanitizeFileToken(meta.gradeValue) : "",
    meta.teacherValue ? sanitizeFileToken(meta.teacherValue) : "",
  ].filter(Boolean);
  return `${parts.join("_")}.${ext}`;
}
