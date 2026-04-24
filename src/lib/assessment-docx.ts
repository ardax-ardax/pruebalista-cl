// Generación nativa de .docx desde Assessment usando docx-js.
// Sin mutar archivos arbitrarios: garantiza formato institucional consistente.

import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
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

import type { Assessment, Question, QuestionImage } from "./assessment-schema";
import type { FormatTemplate } from "./templates";
import { richTextToRuns } from "./rich-text";
import { hasCrop, imageCacheKey, processAssessmentImages, type ProcessedImage } from "./image-crop";

interface BuildContext {
  assessment: Assessment;
  template: FormatTemplate;
  logoDataUrl: string | null;
  institutionName: string;
  subjectLabel: string;
  gradeLabel: string;
  teacherLabel: string;
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

  const infoChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: institutionName, bold: true, size: ptToHalfPt(11) })],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Profesor/a: ", bold: true, size: ptToHalfPt(9) }),
        new TextRun({ text: teacherLabel, size: ptToHalfPt(9) }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Asignatura: ", bold: true, size: ptToHalfPt(9) }),
        new TextRun({ text: subjectLabel, size: ptToHalfPt(9) }),
        new TextRun({ text: "    Curso: ", bold: true, size: ptToHalfPt(9) }),
        new TextRun({ text: gradeLabel, size: ptToHalfPt(9) }),
      ],
    }),
  ];

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
    return [
      new Paragraph({
        spacing: { before: 120, after: 120 },
        shading: { fill: "F2F2F2", type: ShadingType.CLEAR, color: "auto" },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: "000000", space: 4 } },
        keepLines: true,
        keepNext: true,
        children: [new TextRun({ text: q.prompt, italics: true, size: baseSize })],
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
    const letters = ["a", "b", "c", "d", "e", "f"];
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
  if (assessment.meta.instructions) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 60, after: 180 },
        children: [
          new TextRun({ text: "Instrucciones: ", bold: true, size: ptToHalfPt(template.typography.bodySize) }),
          new TextRun({ text: assessment.meta.instructions, size: ptToHalfPt(template.typography.bodySize) }),
        ],
      }),
    );
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
            size: {
              width: cmToTwip(template.pageSize.widthCm),
              height: cmToTwip(template.pageSize.heightCm),
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: cmToTwip(template.spacing.marginTop),
              bottom: cmToTwip(template.spacing.marginBottom),
              left: cmToTwip(template.spacing.marginLeft),
              right: cmToTwip(template.spacing.marginRight),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}
