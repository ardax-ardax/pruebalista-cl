import { AssessmentPreviewRender, type RenderContext } from "@/lib/assessment-render";

export const AssessmentPreview = ({ ctx }: { ctx: RenderContext }) => {
  return (
    <div className="overflow-auto rounded-md border border-border bg-muted p-6">
      <AssessmentPreviewRender ctx={ctx} />
    </div>
  );
};
