import { PaginatedAssessmentPreview } from "./PaginatedAssessmentPreview";
import type { RenderContext } from "@/lib/assessment-render";

export const AssessmentPreview = ({ ctx }: { ctx: RenderContext }) => {
  return <PaginatedAssessmentPreview ctx={ctx} />;
};
