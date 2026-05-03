// Preview paginado tipo Word: mide el HTML generado por renderAssessmentHtml,
// reparte sus bloques de primer nivel en hojas A4 (según template.pageSize),
// respetando page-break-inside: avoid. No duplica lógica de render.
//
// En modo "ensayo" (SIMCE/PAES) el HTML usa CSS columns, así que la paginación
// la hace el motor del navegador y aquí mostramos una sola "vista".

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ASSESSMENT_CSS, effectiveMarginsCm, renderAssessmentHtml, type RenderContext } from "@/lib/assessment-render";

const CM_TO_PX = 37.8; // 1cm ≈ 37.8 px @96dpi

interface PageGeom {
  widthPx: number;
  heightPx: number;
  padTopPx: number;
  padRightPx: number;
  padBottomPx: number;
  padLeftPx: number;
  usableHeightPx: number;
  usableWidthPx: number;
}

function geomFromTemplate(ctx: RenderContext): PageGeom {
  const t = ctx.template;
  const widthPx = t.pageSize.widthCm * CM_TO_PX;
  const heightPx = t.pageSize.heightCm * CM_TO_PX;
  const m = effectiveMarginsCm(ctx);
  const padTopPx = m.top * CM_TO_PX;
  const padRightPx = m.right * CM_TO_PX;
  const padBottomPx = m.bottom * CM_TO_PX;
  const padLeftPx = m.left * CM_TO_PX;
  return {
    widthPx,
    heightPx,
    padTopPx,
    padRightPx,
    padBottomPx,
    padLeftPx,
    usableHeightPx: heightPx - padTopPx - padBottomPx,
    usableWidthPx: widthPx - padLeftPx - padRightPx,
  };
}

export function PaginatedAssessmentPreview({ ctx }: { ctx: RenderContext }) {
  const html = useMemo(() => renderAssessmentHtml(ctx), [ctx]);
  const geom = useMemo(() => geomFromTemplate(ctx), [ctx]);
  const measureRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<string[]>([html]);
  const [scale, setScale] = useState(1);
  const isEssay = !!ctx.template.essayMode;

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    const paPage = root.querySelector(".pa-page") as HTMLElement | null;
    if (!paPage) return;
    if (paPage.dataset.essayMode) {
      setPages([html]);
      return;
    }

    // Separate: header blocks (before .pa-content), content blocks, footer blocks (after .pa-content)
    const headerBlocks: HTMLElement[] = [];
    const contentBlocks: HTMLElement[] = [];
    const footerBlocks: HTMLElement[] = [];
    const children = Array.from(paPage.children) as HTMLElement[];
    let seenContent = false;
    for (const child of children) {
      if (child.classList.contains("pa-content")) {
        seenContent = true;
        contentBlocks.push(...(Array.from(child.children) as HTMLElement[]));
      } else if (seenContent) {
        // Everything after .pa-content is footer (pa-footer, pa-watermark)
        footerBlocks.push(child);
      } else {
        headerBlocks.push(child);
      }
    }

    const allBlocks = [...headerBlocks, ...contentBlocks];
    if (allBlocks.length === 0) {
      setPages([html]);
      return;
    }

    const footerHeight = footerBlocks.reduce((sum, el) => {
      const h = el.getBoundingClientRect().height;
      const margin = parseFloat(getComputedStyle(el).marginTop) + parseFloat(getComputedStyle(el).marginBottom);
      return sum + h + (isFinite(margin) ? margin : 0);
    }, 0);

    const pagesHtml: string[] = [];
    let current: string[] = [];
    let usedH = 0;
    const limit = geom.usableHeightPx;

    for (const el of allBlocks) {
      const h = el.getBoundingClientRect().height;
      const margin = parseFloat(getComputedStyle(el).marginTop) + parseFloat(getComputedStyle(el).marginBottom);
      const total = h + (isFinite(margin) ? margin : 0);

      if (current.length > 0 && usedH + total > limit) {
        pagesHtml.push(current.join(""));
        current = [];
        usedH = 0;
      }
      current.push(el.outerHTML);
      usedH += total;
    }
    if (current.length > 0) pagesHtml.push(current.join(""));
    if (pagesHtml.length === 0) pagesHtml.push(html);

    // Append footer to the last page only
    if (footerBlocks.length > 0) {
      const footerHtml = footerBlocks.map((el) => el.outerHTML).join("");
      pagesHtml[pagesHtml.length - 1] += footerHtml;
    }

    setPages(pagesHtml);

    setPages(pagesHtml);
  }, [html, geom.usableHeightPx, geom.usableWidthPx]);

  // Recalcular escala para fit-to-width
  const updateScale = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const available = el.clientWidth - 48; // p-6 = 24px * 2
    setScale(Math.min(1, available / geom.widthPx));
  }, [geom.widthPx]);

  useEffect(() => {
    updateScale();
    const handle = () => { setPages((p) => [...p]); updateScale(); };
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [updateScale]);

  return (
    <div ref={containerRef} className="overflow-hidden rounded-md border border-border bg-muted p-6">
      <style>{ASSESSMENT_CSS}</style>
      <div
        ref={measureRef}
        aria-hidden
        style={{
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          left: -99999,
          top: 0,
          width: geom.usableWidthPx,
          background: "white",
          color: "black",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className="flex flex-col items-center gap-6">
        {pages.map((pageHtml, idx) => {
          const pageH = isEssay ? geom.heightPx : geom.heightPx;
          return (
            <div key={idx} className="flex flex-col items-center" style={{ width: geom.widthPx * scale }}>
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "top center",
                  width: geom.widthPx,
                  height: isEssay ? "auto" : pageH,
                  marginBottom: isEssay ? 0 : (pageH * scale - pageH),
                }}
              >
                <div
                  style={{
                    background: "white",
                    color: "black",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                    width: geom.widthPx,
                    minHeight: geom.heightPx,
                    height: isEssay ? "auto" : geom.heightPx,
                    paddingTop: geom.padTopPx,
                    paddingRight: geom.padRightPx,
                    paddingBottom: geom.padBottomPx,
                    paddingLeft: geom.padLeftPx,
                    boxSizing: "border-box",
                    overflow: "hidden",
                  }}
                >
                  {isEssay ? (
                    <div
                      style={{ width: "100%", height: "100%" }}
                      dangerouslySetInnerHTML={{ __html: pageHtml }}
                    />
                  ) : (
                    <div
                      className="pa-page"
                      style={{ width: "100%", height: "100%" }}
                      dangerouslySetInnerHTML={{ __html: pageHtml }}
                    />
                  )}
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {isEssay ? "Vista previa (modo ensayo · columnas automáticas)" : `Página ${idx + 1} de ${pages.length}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
