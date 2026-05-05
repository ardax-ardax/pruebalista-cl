// Generación nativa de .docx desde Assessment usando docx-js.
// Sin mutar archivos arbitrarios: garantiza formato institucional consistente.

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  HeightRule,
  VerticalAlign,
} from "docx";
import { saveAs } from "file-saver";

import type { Assessment, Question, QuestionImage, PaesVariant } from "./assessment-schema";
import { PAES_VARIANTS, resolvePageSize } from "./assessment-schema";
import type { FormatTemplate } from "./templates";
import { richTextToRuns } from "./rich-text";
import { hasCrop, imageCacheKey, processAssessmentImages, type ProcessedImage } from "./image-crop";
import { findOA } from "./curriculum-data";
import { defaultInstructionsFor } from "./essay-defaults";

function paesVariantLabelDocx(v?: PaesVariant): string {
  if (!v) return "PAES";
  return PAES_VARIANTS.find((x) => x.value === v)?.label ?? "PAES";
}

interface BuildContext {
  assessment: Assessment;
  template: FormatTemplate;
  logoDataUrl: string | null;
  institutionName: string;
  subjectLabel: string;
  gradeLabel: string;
  teacherLabel: string;
  includeAnswerKey?: boolean;
}

const cmToTwip = (cm: number) => Math.round(cm * 567);
const ptToHalfPt = (pt: number) => Math.round(pt * 2);

function dataUrlToUint8Array(dataUrl: string): { data: Uint8Array; type: "png" | "jpg" | "gif" | "bmp" } {
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Imagen inválida");
  const ext = m[1].toLowerCase();
  const type: "png" | "jpg" | "gif" | "bmp" =
    ext === "jpeg" || ext === "jpg" ? "jpg" : (["png", "gif", "bmp"].includes(ext) ? (ext as "png" | "gif" | "bmp") : "png");
  const bin = atob(m[2]);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return { data: u8, type };
}

// ImageRun manteniendo proporción real. Si la imagen tiene crop, recibe los
// bytes ya recortados desde imageCache (procesados con <canvas>); en caso
// contrario usa el dataURL original.
function buildImageRun(
  img: QuestionImage,
  contentWidthCm: number,
  imageCache: Map<string, ProcessedImage>,
  maxHeightCm?: number,
  allowFullWidth?: boolean,
): ImageRun {
  const cropped = hasCrop(img) ? imageCache.get(imageCacheKey(img)) : undefined;
  const { data, type } = cropped
    ? { data: cropped.data, type: "png" as const }
    : dataUrlToUint8Array(img.src);

  // Clamp: full width si se pide; en otro caso centro=50%, left/right=20%.
  const maxByAlign = img.alignment === "center" ? 50 : 20;
  const safeWidthPct = allowFullWidth
    ? Math.max(10, Math.min(100, img.widthPct))
    : Math.max(10, Math.min(maxByAlign, img.widthPct));
  const targetWidthCm = contentWidthCm * (safeWidthPct / 100);
  let widthPx = Math.round(targetWidthCm * 37.8); // 1cm ≈ 37.8 px

  // Dimensiones efectivas: del recorte (si existe) o las naturales originales.
  const effW = cropped ? cropped.width : (img.naturalW ?? 4);
  const effH = cropped ? cropped.height : (img.naturalH ?? 3);
  const ratio = effH / Math.max(1, effW);
  let heightPx = Math.max(1, Math.round(widthPx * ratio));

  if (maxHeightCm && maxHeightCm > 0) {
    const maxHeightPx = Math.round(maxHeightCm * 37.8);
    if (heightPx > maxHeightPx) {
      const scale = maxHeightPx / heightPx;
      widthPx = Math.max(1, Math.round(widthPx * scale));
      heightPx = maxHeightPx;
    }
  }

  return new ImageRun({
    type,
    data,
    transformation: { width: widthPx, height: heightPx },
    altText: { title: img.alt ?? "Imagen", description: img.alt ?? "Imagen", name: "image" },
  });
}

function imageParagraph(
  img: QuestionImage,
  contentWidthCm: number,
  imageCache: Map<string, ProcessedImage>,
  indentLeft = 0,
): Paragraph {
  const align =
    img.alignment === "left"
      ? AlignmentType.LEFT
      : img.alignment === "right"
        ? AlignmentType.RIGHT
        : AlignmentType.CENTER;
  return new Paragraph({
    alignment: align,
    indent: indentLeft ? { left: indentLeft } : undefined,
    spacing: { before: 60, after: 60 },
    children: [buildImageRun(img, contentWidthCm, imageCache)],
  });
}

function bannerTable(ctx: BuildContext): Table {
  const { template, logoDataUrl, institutionName, teacherLabel, subjectLabel, gradeLabel } = ctx;
  const showGradeBox = template.header?.style === "banner-evaluacion";
  const contentWidthTwip = cmToTwip(
    template.pageSize.widthCm - template.spacing.marginLeft - template.spacing.marginRight,
  );
  const w = (pct: number) => Math.round(contentWidthTwip * pct);
  const border = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
  const borders = { top: border, bottom: border, left: border, right: border };

  const logoChildren = logoDataUrl
    ? (() => {
        try {
          const { data, type } = dataUrlToUint8Array(logoDataUrl);
          return [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new ImageRun({ type, data, transformation: { width: 70, height: 70 }, altText: { title: "Logo", description: "Logo", name: "logo" } })],
            }),
          ];
        } catch {
          return [new Paragraph({ children: [new TextRun("")] })];
        }
      })()
    : [new Paragraph({ children: [new TextRun("")] })];

  const isPaes = template.essayMode === "paes";
  const isEssay = !!template.essayMode;

  const infoChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: institutionName, bold: true, size: ptToHalfPt(11) })],
    }),
  ];

  if (isEssay) {
    // Cuadernillo Maestro: anónimo institucional, sin profesor identificable.
    infoChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: isPaes ? "Ensayo PAES" : "Ensayo SIMCE",
            bold: true,
            size: ptToHalfPt(10),
          }),
        ],
      }),
    );
  } else {
    infoChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Profesor/a: ", bold: true, size: ptToHalfPt(9) }),
          new TextRun({ text: teacherLabel, size: ptToHalfPt(9) }),
        ],
      }),
    );
  }
  infoChildren.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Asignatura: ", bold: true, size: ptToHalfPt(9) }),
        new TextRun({ text: subjectLabel, size: ptToHalfPt(9) }),
        new TextRun({ text: "    Curso: ", bold: true, size: ptToHalfPt(9) }),
        new TextRun({ text: gradeLabel, size: ptToHalfPt(9) }),
      ],
    }),
  );

  const linkedOA = ctx.assessment.meta.linkedOA ?? [];
  if (!isEssay && linkedOA.length > 0) {
    infoChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: "OA evaluados: ", bold: true, size: ptToHalfPt(9) }),
          new TextRun({ text: linkedOA.join(", "), size: ptToHalfPt(9) }),
        ],
      }),
    );
  }
  if (isPaes) {
    infoChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Variante: ", bold: true, size: ptToHalfPt(9) }),
          new TextRun({ text: paesVariantLabelDocx(ctx.assessment.meta.paesVariant), size: ptToHalfPt(9) }),
        ],
      }),
    );
    if (ctx.assessment.meta.paesAxis) {
      infoChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Eje Temático: ", bold: true, size: ptToHalfPt(9) }),
            new TextRun({ text: ctx.assessment.meta.paesAxis, size: ptToHalfPt(9) }),
          ],
        }),
      );
    }
  }

  // En modo Cuadernillo Maestro NO incluimos caja de calificación.
  if (isEssay) {
    return new Table({
      width: { size: contentWidthTwip, type: WidthType.DXA },
      columnWidths: [w(0.22), w(0.78)],
      rows: [
        new TableRow({
          height: { value: 1100, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({ borders, width: { size: w(0.22), type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER, children: logoChildren }),
            new TableCell({ borders, width: { size: w(0.78), type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER, children: infoChildren }),
          ],
        }),
      ],
    });
  }

  const gradeChildren: Paragraph[] = showGradeBox
    ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Calificación", bold: true, size: ptToHalfPt(9) })] })]
    : [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Pje. Total", bold: true, size: ptToHalfPt(9) })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "", size: ptToHalfPt(11) })] }),
      ];

  return new Table({
    width: { size: contentWidthTwip, type: WidthType.DXA },
    columnWidths: [w(0.22), w(0.56), w(0.22)],
    rows: [
      new TableRow({
        height: { value: 1100, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({ borders, width: { size: w(0.22), type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER, children: logoChildren }),
          new TableCell({ borders, width: { size: w(0.56), type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER, children: infoChildren }),
          new TableCell({ borders, width: { size: w(0.22), type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, verticalAlign: VerticalAlign.CENTER, shading: { fill: "F2F2F2", type: ShadingType.CLEAR, color: "auto" }, children: gradeChildren }),
        ],
      }),
    ],
  });
}

function studentRow(ctx: BuildContext): Table {
  const contentWidthTwip = cmToTwip(
    ctx.template.pageSize.widthCm - ctx.template.spacing.marginLeft - ctx.template.spacing.marginRight,
  );
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const bottom = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const cellBorders = { top: noBorder, left: noBorder, right: noBorder, bottom };

  const isEssay = !!ctx.template.essayMode;

  if (isEssay) {
    // Cuadernillo Maestro: 3 campos en blanco para identificación manual.
    const cw = (pct: number) => Math.round(contentWidthTwip * pct);
    const mkCell = (pct: number, label: string, marginLeft: number, marginRight: number) =>
      new TableCell({
        borders: cellBorders,
        width: { size: cw(pct), type: WidthType.DXA },
        margins: { top: 120, bottom: 80, left: marginLeft, right: marginRight },
        children: [
          new Paragraph({
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({ text: `${label}: `, bold: true, size: ptToHalfPt(9) }),
              new TextRun({ text: "", size: ptToHalfPt(9) }),
            ],
          }),
        ],
      });
    return new Table({
      width: { size: contentWidthTwip, type: WidthType.DXA },
      columnWidths: [cw(0.55), cw(0.25), cw(0.20)],
      rows: [
        new TableRow({
          children: [
            mkCell(0.55, "Nombre", 0, 120),
            mkCell(0.25, "RUT", 120, 120),
            mkCell(0.20, "Fecha", 120, 0),
          ],
        }),
      ],
    });
  }

  return new Table({
    width: { size: contentWidthTwip, type: WidthType.DXA },
    columnWidths: [Math.round(contentWidthTwip * 0.65), Math.round(contentWidthTwip * 0.35)],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: cellBorders,
            width: { size: Math.round(contentWidthTwip * 0.65), type: WidthType.DXA },
            margins: { top: 120, bottom: 80, left: 0, right: 120 },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({ text: "Nombre: ", bold: true, size: ptToHalfPt(9) }),
                  new TextRun({ text: ctx.assessment.meta.studentName ?? "", size: ptToHalfPt(9) }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: cellBorders,
            width: { size: Math.round(contentWidthTwip * 0.35), type: WidthType.DXA },
            margins: { top: 120, bottom: 80, left: 120, right: 0 },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                children: [new TextRun({ text: "Puntaje obtenido: ", bold: true, size: ptToHalfPt(9) })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function questionParagraphs(q: Question, qNumber: number | null, ctx: BuildContext, imageCache: Map<string, ProcessedImage>): Array<Paragraph | Table> {
  // Acumulamos descriptores y al final aplicamos keepLines/keepNext.
  // Para mantener cada pregunta como bloque indivisible: todos los párrafos llevan keepLines+keepNext,
  // excepto el último que solo lleva keepLines (para no pegarse a la siguiente pregunta).
  type POpts = Record<string, unknown>;
  type Item =
    | { kind: "p"; opts: POpts }
    | { kind: "pre"; paragraph: Paragraph }
    | { kind: "t"; table: Table };
  const items: Item[] = [];
  const pushP = (opts: POpts) => items.push({ kind: "p", opts });
  const pushT = (table: Table) => items.push({ kind: "t", table });
  const pushPre = (paragraph: Paragraph) => items.push({ kind: "pre", paragraph });

  const baseSize = ptToHalfPt(ctx.template.typography.bodySize);
  const contentWidthCm =
    ctx.template.pageSize.widthCm - ctx.template.spacing.marginLeft - ctx.template.spacing.marginRight;

  if (q.type === "section-title") {
    // section-title se mantiene junto con la pregunta siguiente.
    const out: Paragraph[] = [
      new Paragraph({
        spacing: { before: 240, after: q.instructions ? 60 : 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
        keepLines: true,
        keepNext: true,
        children: [new TextRun({ text: (q.prompt || "Sección").toUpperCase(), bold: true, size: ptToHalfPt(11) })],
      }),
    ];
    if (q.instructions) {
      out.push(
        new Paragraph({
          spacing: { before: 60, after: 120 },
          alignment: AlignmentType.JUSTIFIED,
          keepLines: true,
          keepNext: true,
          children: [new TextRun({ text: q.instructions, italics: true, size: baseSize })],
        }),
      );
    }
    return out;
  }
  if (q.type === "info-block") {
    // info-block se mantiene junto con la pregunta siguiente.
    const isPlain = q.infoStyle === "plain";
    return [
      new Paragraph({
        spacing: { before: 120, after: 120 },
        alignment: isPlain ? AlignmentType.JUSTIFIED : undefined,
        shading: isPlain ? undefined : { fill: "F2F2F2", type: ShadingType.CLEAR, color: "auto" },
        border: isPlain ? undefined : { left: { style: BorderStyle.SINGLE, size: 12, color: "000000", space: 4 } },
        keepLines: true,
        keepNext: true,
        children: [new TextRun({ text: q.prompt, italics: !isPlain, size: baseSize })],
      }),
    ];
  }

  // Título opcional del enunciado
  if (q.title) {
    pushP({
      spacing: { before: 120, after: 0 },
      children: [new TextRun({ text: q.title, bold: true, size: baseSize })],
    });
  }

  // Cabecera de pregunta
  const totalPts =
    q.type === "true-false"
      ? (q.statements ?? []).reduce((s, st) => s + (st.points ?? 0), 0)
      : (q.points ?? 0);
  const headerRuns: TextRun[] = [
    new TextRun({ text: `${qNumber}) `, bold: true, size: baseSize }),
    ...richTextToRuns(q.prompt, { size: baseSize, bold: false }),
  ];
  // Puntaje oculto en la prueba (dato interno del docente).
  void totalPts;
  pushP({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: q.title ? 0 : 120, after: 60 },
    children: headerRuns,
  });

  // Split solo si el usuario eligió 2 columnas (retrocompatibilidad: imagen presente sin flag → 2 columnas).
  const wantsTwo = (q.type === "multiple-choice" || q.type === "true-false") && (q.useTwoColumns ?? !!q.image);
  const isSplit = wantsTwo && !!q.image;

  if (q.image && !isSplit) {
    const align =
      q.image.alignment === "left"
        ? AlignmentType.LEFT
        : q.image.alignment === "right"
          ? AlignmentType.RIGHT
          : AlignmentType.CENTER;
    pushP({
      alignment: align,
      spacing: { before: 60, after: 60 },
      children: [buildImageRun(q.image, contentWidthCm, imageCache)],
    });
  }

  // Helper: construye la tabla split (texto 60% / imagen 40% centrada).
  const buildSplitTable = (textParagraphs: Paragraph[], totalLines: number): Table => {
    const contentWidthTwip = cmToTwip(contentWidthCm);
    const textColCm = contentWidthCm * 0.6;
    const imgColCm = contentWidthCm * 0.4;
    const optionLineCm = ctx.template.typography.bodySize * 0.0353 * 1.35;
    const maxImgHeightCm = Math.max(1, totalLines * optionLineCm + 0.2);
    const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const borders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
    const textCell = new TableCell({
      borders,
      width: { size: Math.round(contentWidthTwip * 0.6), type: WidthType.DXA },
      margins: { top: 0, bottom: 0, left: 0, right: 120 },
      children: textParagraphs,
    });
    // Forzamos ancho completo de columna en split MC/VF (ignoramos widthPct guardado).
    const safeImgPct = 100;
    const imgCell = new TableCell({
      borders,
      width: { size: Math.round(contentWidthTwip * 0.4), type: WidthType.DXA },
      margins: { top: 0, bottom: 0, left: 120, right: 0 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
          children: [buildImageRun({ ...q.image!, widthPct: safeImgPct }, imgColCm, imageCache, maxImgHeightCm, true)],
        }),
      ],
    });
    return new Table({
      width: { size: contentWidthTwip, type: WidthType.DXA },
      columnWidths: [Math.round(contentWidthTwip * 0.6), Math.round(contentWidthTwip * 0.4)],
      rows: [
        new TableRow({
          cantSplit: true,
          children: [textCell, imgCell],
        }),
      ],
    });
  };

  if (q.type === "multiple-choice") {
    const letters = ["A", "B", "C", "D", "E", "F"];
    // Filtra opciones vacías a partir de la 5ª (la "E" solo se renderiza si tiene contenido).
    const filteredOpts = (q.options ?? []).filter((o, idx) =>
      idx < 4 ? true : (o.text && o.text.trim().length > 0) || !!o.image,
    );
    q = { ...q, options: filteredOpts } as Question;
    const buildOptionParagraphs = (colWidthCm: number, indent: number): Paragraph[] => {
      const ps: Paragraph[] = [];
      (q.options ?? []).forEach((o, i) => {
        ps.push(
          new Paragraph({
            indent: indent ? { left: indent } : undefined,
            spacing: { before: 0, after: 40 },
            keepLines: true,
            keepNext: true,
            children: [
              new TextRun({ text: `${letters[i] ?? i + 1}) `, bold: true, size: baseSize }),
              new TextRun({ text: o.text, size: baseSize }),
            ],
          }),
        );
        if (o.image) {
          ps.push(imageParagraph(o.image, colWidthCm, imageCache, indent));
        }
      });
      return ps;
    };

    if (isSplit && q.image) {
      const textColCm = contentWidthCm * 0.6;
      const charsPerLine = Math.max(20, Math.floor((textColCm * 10) / (ctx.template.typography.bodySize * 0.05)));
      const totalLines = (q.options ?? []).reduce((sum, o) => {
        const text = `a) ${o.text}`;
        return sum + Math.max(1, Math.ceil(text.length / charsPerLine));
      }, 0);
      pushT(buildSplitTable(buildOptionParagraphs(textColCm, 0), totalLines));
    } else if (ctx.assessment.meta.layout?.optionsColumns === 2) {
      // Optimización de espacio: distribuir alternativas en 2 columnas usando tabla sin bordes.
      const opts = q.options ?? [];
      const half = Math.ceil(opts.length / 2);
      const leftOpts = opts.slice(0, half);
      const rightOpts = opts.slice(half);
      const colWidthCm = contentWidthCm / 2;
      const contentWidthTwip = cmToTwip(contentWidthCm);
      const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
      const borders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
      const buildHalfParagraphs = (slice: typeof opts, startIdx: number): Paragraph[] => {
        const ps: Paragraph[] = [];
        slice.forEach((o, j) => {
          const i = startIdx + j;
          ps.push(
            new Paragraph({
              spacing: { before: 0, after: 40 },
              keepLines: true,
              keepNext: true,
              children: [
                new TextRun({ text: `${letters[i] ?? i + 1}) `, bold: true, size: baseSize }),
                new TextRun({ text: o.text, size: baseSize }),
              ],
            }),
          );
          if (o.image) ps.push(imageParagraph(o.image, colWidthCm, imageCache, 0));
        });
        return ps;
      };
      const halfTwip = Math.round(contentWidthTwip / 2);
      pushT(
        new Table({
          width: { size: contentWidthTwip, type: WidthType.DXA },
          columnWidths: [halfTwip, halfTwip],
          rows: [
            new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  borders,
                  width: { size: halfTwip, type: WidthType.DXA },
                  margins: { top: 0, bottom: 0, left: 120, right: 120 },
                  children: buildHalfParagraphs(leftOpts, 0),
                }),
                new TableCell({
                  borders,
                  width: { size: halfTwip, type: WidthType.DXA },
                  margins: { top: 0, bottom: 0, left: 120, right: 120 },
                  children: rightOpts.length
                    ? buildHalfParagraphs(rightOpts, half)
                    : [new Paragraph({ children: [new TextRun("")] })],
                }),
              ],
            }),
          ],
        }),
      );
    } else {
      for (const p of buildOptionParagraphs(contentWidthCm, 360)) {
        pushPre(p);
      }
    }
  } else if (q.type === "true-false") {
    const buildStatementParagraphs = (indent: number): Paragraph[] => {
      const ps: Paragraph[] = [];
      (q.statements ?? []).forEach((st, i) => {
        ps.push(
          new Paragraph({
            indent: indent ? { left: indent } : undefined,
            spacing: { before: 60, after: 40 },
            keepLines: true,
            keepNext: true,
            children: [
              new TextRun({ text: "( V ) ( F )   ", bold: true, size: baseSize }),
              new TextRun({ text: `${qNumber}.${i + 1} `, bold: true, size: baseSize }),
              new TextRun({ text: st.text, size: baseSize }),
            ],
          }),
        );
        if (st.image) {
          const align =
            st.image.alignment === "left"
              ? AlignmentType.LEFT
              : st.image.alignment === "right"
                ? AlignmentType.RIGHT
                : AlignmentType.CENTER;
          ps.push(
            new Paragraph({
              alignment: align,
              indent: { left: indent + 360 },
              spacing: { before: 60, after: 60 },
              children: [buildImageRun(st.image, contentWidthCm, imageCache)],
            }),
          );
        }
      });
      return ps;
    };

    if (isSplit && q.image) {
      const textColCm = contentWidthCm * 0.6;
      const charsPerLine = Math.max(20, Math.floor((textColCm * 10) / (ctx.template.typography.bodySize * 0.05)));
      const totalLines = (q.statements ?? []).reduce((sum, st) => {
        const text = `( V ) ( F )   ${qNumber}.x ${st.text}`;
        return sum + Math.max(1, Math.ceil(text.length / charsPerLine));
      }, 0);
      pushT(buildSplitTable(buildStatementParagraphs(0), totalLines));
    } else {
      for (const p of buildStatementParagraphs(360)) {
        pushPre(p);
      }
    }
  } else if (q.type === "short-answer") {
    const lines = Math.max(1, q.answerLines ?? 3);
    for (let i = 0; i < lines; i++) {
      pushP({
        spacing: { before: 0, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 1 } },
        children: [new TextRun({ text: "", size: baseSize })],
      });
    }
  }

  // Identificar el índice del último ítem que aporta un párrafo (p o pre)
  // para no aplicarle keepNext y evitar que se pegue a la siguiente pregunta.
  let lastPIdx = -1;
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].kind === "p" || items[i].kind === "pre") {
      lastPIdx = i;
      break;
    }
  }

  const out: Array<Paragraph | Table> = items.map((it, idx) => {
    if (it.kind === "t") return it.table;
    if (it.kind === "pre") return it.paragraph;
    const isLast = idx === lastPIdx;
    return new Paragraph({
      ...it.opts,
      keepLines: true,
      keepNext: !isLast,
    } as ConstructorParameters<typeof Paragraph>[0]);
  });

  return out;
}

function buildAnswerKeySection(ctx: BuildContext): ConstructorParameters<typeof Document>["0"]["sections"][number] {
  const children: Array<Paragraph | Table> = [];
  const sz = ptToHalfPt(10);
  const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
  const cellMargins = { top: 40, bottom: 40, left: 80, right: 80 };

  // Institutional banner (reuse)
  if (ctx.template.header?.enabled) children.push(bannerTable(ctx));
  children.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun("")] }));

  // Title
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 40 },
    children: [new TextRun({ text: "PAUTA DE CORRECCIÓN / SOLUCIONARIO", bold: true, size: ptToHalfPt(13) })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: ctx.assessment.meta.title || "", size: sz, color: "444444" })],
  }));

  // Build entries
  type AKEntry = { num: number; type: "mc" | "tf" | "dev"; answer: string; detail: string };
  const entries: AKEntry[] = [];
  let num = 1;
  for (const q of ctx.assessment.questions) {
    if (q.type === "section-title" || q.type === "info-block") continue;
    if (q.type === "multiple-choice" && q.options) {
      const ci = q.options.findIndex((o) => o.correct);
      const letter = ci >= 0 ? String.fromCharCode(65 + ci) : "—";
      const text = ci >= 0 ? q.options[ci].text.replace(/<[^>]*>/g, "").trim() : "";
      entries.push({ num, type: "mc", answer: letter, detail: text });
    } else if (q.type === "true-false" && q.statements) {
      for (const st of q.statements) {
        entries.push({ num, type: "tf", answer: st.answer, detail: st.text.replace(/<[^>]*>/g, "").trim() });
        num++;
      }
      continue;
    } else if (q.type === "short-answer") {
      entries.push({ num, type: "dev", answer: "Desarrollo", detail: (q.rubric || "").replace(/<[^>]*>/g, "").trim() });
    }
    num++;
  }

  // MC/TF entries in columns
  const mcTf = entries.filter((e) => e.type === "mc" || e.type === "tf");
  if (mcTf.length > 0) {
    const COLS = mcTf.length > 20 ? 3 : mcTf.length > 10 ? 2 : 1;
    const perCol = Math.ceil(mcTf.length / COLS);
    const colW = Math.floor(9360 / COLS);
    const columnWidths = Array(COLS).fill(colW);
    const rows: TableRow[] = [];
    for (let r = 0; r < perCol; r++) {
      const cells: TableCell[] = [];
      for (let c = 0; c < COLS; c++) {
        const e = mcTf[c * perCol + r];
        const text = e ? `${e.num}. ${e.answer} — ${e.detail}` : "";
        cells.push(new TableCell({
          width: { size: colW, type: WidthType.DXA },
          borders,
          margins: cellMargins,
          children: [new Paragraph({ children: [new TextRun({ text, size: ptToHalfPt(9) })] })],
        }));
      }
      rows.push(new TableRow({ children: cells }));
    }
    children.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths, rows }));
  }

  // Development entries
  const devEntries = entries.filter((e) => e.type === "dev");
  if (devEntries.length > 0) {
    children.push(new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: "Preguntas de Desarrollo — Criterios de Corrección", bold: true, size: sz })] }));
    for (const e of devEntries) {
      children.push(new Paragraph({
        spacing: { before: 80 },
        children: [
          new TextRun({ text: `${e.num}. Desarrollo: `, bold: true, size: ptToHalfPt(9) }),
          new TextRun({ text: e.detail || "Sin criterios definidos", size: ptToHalfPt(9), color: "333333" }),
        ],
      }));
    }
  }

  children.push(new Paragraph({
    spacing: { before: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `Documento de uso exclusivo del docente · ${entries.length} respuestas`, size: ptToHalfPt(8), color: "888888" })],
  }));

  const ps = resolvePageSize(ctx.assessment.meta.layout, ctx.template.pageSize);
  return {
    properties: {
      page: {
        size: { width: cmToTwip(ps.widthCm), height: cmToTwip(ps.heightCm), orientation: PageOrientation.PORTRAIT },
        margin: { top: cmToTwip(1.5), bottom: cmToTwip(1.5), left: cmToTwip(2), right: cmToTwip(2) },
      },
    },
    children,
  };
}

export async function exportAssessmentToDocx(ctx: BuildContext, fileName: string) {
  const { template, assessment } = ctx;
  // Pre-procesar imágenes con crop a PNG recortado para evitar deformación en Word.
  const imageCache = await processAssessmentImages(assessment);
  const children: Array<Paragraph | Table> = [];

  if (template.header?.enabled) children.push(bannerTable(ctx));
  // Separador para que la fila Nombre/Puntaje no quede pegada al banner.
  children.push(
    new Paragraph({ spacing: { before: 0, after: 120 }, children: [new TextRun("")] }),
  );
  children.push(studentRow(ctx));

  if (assessment.meta.title) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
        children: [new TextRun({ text: assessment.meta.title.toUpperCase(), bold: true, size: ptToHalfPt(12) })],
      }),
    );
  }
  const effectiveInstructions =
    assessment.meta.instructions ||
    (template.essayMode ? defaultInstructionsFor(template.essayMode) ?? "" : "");
  if (effectiveInstructions) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 60, after: 180 },
        children: [
          new TextRun({ text: "Instrucciones: ", bold: true, size: ptToHalfPt(template.typography.bodySize) }),
          new TextRun({ text: effectiveInstructions, size: ptToHalfPt(template.typography.bodySize) }),
        ],
      }),
    );
  }

  // Bloque opcional bajo el título: en PAES listamos "Ejes Temáticos"; en el resto, OAs evaluados.
  const isPaesDoc = template.essayMode === "paes";
  const showOaHeader = !isPaesDoc && !!assessment.meta.showOaInHeader && (assessment.meta.linkedOA?.length ?? 0) > 0;
  const showPaesAxis = isPaesDoc && !!assessment.meta.paesAxis;
  if (showOaHeader || showPaesAxis) {
    children.push(
      new Paragraph({
        spacing: { before: 0, after: 80 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 2 },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 2 },
          left: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 4 },
          right: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 4 },
        },
        shading: { fill: "FAFAFA", type: ShadingType.CLEAR, color: "auto" },
        children: [
          new TextRun({
            text: showPaesAxis ? "EJE TEMÁTICO PAES" : "OBJETIVOS DE APRENDIZAJE EVALUADOS",
            bold: true,
            size: ptToHalfPt(9),
          }),
        ],
      }),
    );
    if (showPaesAxis) {
      children.push(
        new Paragraph({
          spacing: { before: 0, after: 40 },
          indent: { left: 240 },
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun({ text: `• ${assessment.meta.paesAxis}`, size: ptToHalfPt(template.typography.bodySize) }),
          ],
        }),
      );
    } else {
      for (const code of assessment.meta.linkedOA ?? []) {
        const oa = findOA(assessment.meta.gradeValue, assessment.meta.subjectValue, code);
        const desc = oa?.description ? ` — ${oa.description}` : "";
        children.push(
          new Paragraph({
            spacing: { before: 0, after: 40 },
            indent: { left: 240 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({ text: `• ${code}`, bold: true, size: ptToHalfPt(template.typography.bodySize) }),
              new TextRun({ text: desc, size: ptToHalfPt(template.typography.bodySize) }),
            ],
          }),
        );
      }
    }
    // Espacio extra antes de las preguntas
    children.push(new Paragraph({ spacing: { before: 0, after: 120 }, children: [new TextRun("")] }));
  }

  let qN = 0;
  for (const q of assessment.questions) {
    if (q.type === "section-title") qN = 0;
    const isCounted = q.type !== "section-title" && q.type !== "info-block";
    if (isCounted) qN += 1;
    for (const p of questionParagraphs(q, isCounted ? qN : null, ctx, imageCache)) children.push(p);
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: template.typography.bodyFont, size: ptToHalfPt(template.typography.bodySize) },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: (() => {
              const ps = resolvePageSize(assessment.meta.layout, template.pageSize);
              return {
                width: cmToTwip(ps.widthCm),
                height: cmToTwip(ps.heightCm),
                orientation: PageOrientation.PORTRAIT,
              };
            })(),
            margin: (() => {
              // Si la prueba tiene `meta.layout`, los márgenes (mm) sobreescriben al template (cm).
              const layout = assessment.meta.layout;
              if (layout) {
                const mmToTwip = (mm: number) => Math.round((mm / 10) * 567);
                return {
                  top: mmToTwip(layout.marginTop),
                  bottom: mmToTwip(layout.marginBottom),
                  left: mmToTwip(layout.marginSide),
                  right: mmToTwip(layout.marginSide),
                };
              }
              return {
                top: cmToTwip(template.spacing.marginTop),
                bottom: cmToTwip(template.spacing.marginBottom),
                left: cmToTwip(template.spacing.marginLeft),
                right: cmToTwip(template.spacing.marginRight),
              };
            })(),
            ...(template.essayMode
              ? {
                  column: {
                    count: 2,
                    space: template.essayMode === "paes" ? 567 : 454,
                    equalWidth: true,
                    separate: template.essayMode === "paes",
                  },
                }
              : {}),
          },
        },

        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 4 } },
                children: [
                  new TextRun({
                    text: [ctx.institutionName, ctx.subjectLabel, ctx.gradeLabel]
                      .filter((s) => s && s.trim().length > 0)
                      .join(" · "),
                    size: ptToHalfPt(8),
                    color: "555555",
                  }),
                  new TextRun({ text: "    —    Página ", size: ptToHalfPt(8), color: "555555" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: ptToHalfPt(8), color: "555555" }),
                  new TextRun({ text: " de ", size: ptToHalfPt(8), color: "555555" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: ptToHalfPt(8), color: "555555" }),
                ],
              }),
            ],
          }),
        },
        children,
      },
      ...(ctx.includeAnswerKey ? [buildAnswerKeySection(ctx)] : []),
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}
