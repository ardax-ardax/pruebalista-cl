// Tipos y plantillas predefinidas del estandarizador

export type Alignment = "left" | "center" | "right" | "justify";

export interface FormatTemplate {
  id: string;
  name: string;
  description: string;
  isBuiltIn?: boolean;
  typography: {
    bodyFont: string;
    headingFont: string;
    bodySize: number; // pt
    h1Size: number;
    h2Size: number;
    h3Size: number;
    bodyColor: string; // hex sin #
    headingColor: string;
  };
  spacing: {
    marginTop: number; // cm
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    lineSpacing: number; // 1.0, 1.15, 1.5, 2.0
    paragraphSpacingBefore: number; // pt
    paragraphSpacingAfter: number;
  };
  header: {
    enabled: boolean;
    institutionName: string;
    showLogo: boolean;
    alignment: Alignment;
  };
  footer: {
    enabled: boolean;
    text: string;
    showPageNumber: boolean;
    showDate: boolean;
  };
  headings: {
    bold: boolean;
    h1Alignment: Alignment;
    h2Alignment: Alignment;
    h3Alignment: Alignment;
  };
}

export const FONT_OPTIONS = [
  "Arial",
  "Calibri",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Cambria",
  "Garamond",
  "Tahoma",
] as const;

export const BUILT_IN_TEMPLATES: FormatTemplate[] = [
  {
    id: "circular-oficial",
    name: "Circular oficial",
    description: "Documento formal con logo institucional y pie de página completo.",
    isBuiltIn: true,
    typography: {
      bodyFont: "Arial",
      headingFont: "Arial",
      bodySize: 11,
      h1Size: 16,
      h2Size: 14,
      h3Size: 12,
      bodyColor: "1F2937",
      headingColor: "1E40AF",
    },
    spacing: {
      marginTop: 2.5,
      marginBottom: 2.5,
      marginLeft: 3,
      marginRight: 3,
      lineSpacing: 1.15,
      paragraphSpacingBefore: 0,
      paragraphSpacingAfter: 8,
    },
    header: {
      enabled: true,
      institutionName: "Colegio",
      showLogo: true,
      alignment: "center",
    },
    footer: {
      enabled: true,
      text: "Documento oficial",
      showPageNumber: true,
      showDate: true,
    },
    headings: {
      bold: true,
      h1Alignment: "center",
      h2Alignment: "left",
      h3Alignment: "left",
    },
  },
  {
    id: "examen",
    name: "Examen",
    description: "Encabezado con datos del alumno, cuerpo claro y numeración de páginas.",
    isBuiltIn: true,
    typography: {
      bodyFont: "Times New Roman",
      headingFont: "Arial",
      bodySize: 12,
      h1Size: 14,
      h2Size: 12,
      h3Size: 11,
      bodyColor: "111827",
      headingColor: "111827",
    },
    spacing: {
      marginTop: 2,
      marginBottom: 2,
      marginLeft: 2.5,
      marginRight: 2.5,
      lineSpacing: 1.5,
      paragraphSpacingBefore: 0,
      paragraphSpacingAfter: 6,
    },
    header: {
      enabled: true,
      institutionName: "Nombre: ___________________  Curso: _____  Fecha: _______",
      showLogo: true,
      alignment: "left",
    },
    footer: {
      enabled: true,
      text: "",
      showPageNumber: true,
      showDate: false,
    },
    headings: {
      bold: true,
      h1Alignment: "center",
      h2Alignment: "left",
      h3Alignment: "left",
    },
  },
  {
    id: "informe-interno",
    name: "Informe interno",
    description: "Título grande, cuerpo limpio. Ideal para reportes y memos.",
    isBuiltIn: true,
    typography: {
      bodyFont: "Calibri",
      headingFont: "Calibri",
      bodySize: 11,
      h1Size: 20,
      h2Size: 14,
      h3Size: 12,
      bodyColor: "1F2937",
      headingColor: "0F172A",
    },
    spacing: {
      marginTop: 2.5,
      marginBottom: 2.5,
      marginLeft: 2.5,
      marginRight: 2.5,
      lineSpacing: 1.15,
      paragraphSpacingBefore: 0,
      paragraphSpacingAfter: 10,
    },
    header: {
      enabled: false,
      institutionName: "",
      showLogo: false,
      alignment: "left",
    },
    footer: {
      enabled: true,
      text: "Uso interno",
      showPageNumber: true,
      showDate: true,
    },
    headings: {
      bold: true,
      h1Alignment: "left",
      h2Alignment: "left",
      h3Alignment: "left",
    },
  },
  {
    id: "comunicado-familias",
    name: "Comunicado a familias",
    description: "Tono cercano, encabezado destacado con logo y mensaje claro.",
    isBuiltIn: true,
    typography: {
      bodyFont: "Georgia",
      headingFont: "Georgia",
      bodySize: 12,
      h1Size: 18,
      h2Size: 14,
      h3Size: 12,
      bodyColor: "1F2937",
      headingColor: "1E3A8A",
    },
    spacing: {
      marginTop: 3,
      marginBottom: 3,
      marginLeft: 3,
      marginRight: 3,
      lineSpacing: 1.5,
      paragraphSpacingBefore: 0,
      paragraphSpacingAfter: 10,
    },
    header: {
      enabled: true,
      institutionName: "Comunicación a familias",
      showLogo: true,
      alignment: "center",
    },
    footer: {
      enabled: true,
      text: "Equipo directivo",
      showPageNumber: false,
      showDate: true,
    },
    headings: {
      bold: true,
      h1Alignment: "center",
      h2Alignment: "left",
      h3Alignment: "left",
    },
  },
];

const STORAGE_KEY = "estandarizador.templates.v1";
const LOGO_KEY = "estandarizador.logo.v1";
const INSTITUTION_KEY = "estandarizador.institution.v1";

export function loadTemplates(): FormatTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return BUILT_IN_TEMPLATES;
    const stored = JSON.parse(raw) as FormatTemplate[];
    // mezclar built-ins (siempre presentes) con personalizadas
    const customs = stored.filter((t) => !t.isBuiltIn);
    const builtInOverrides = stored.filter((t) => t.isBuiltIn);
    const merged = BUILT_IN_TEMPLATES.map((b) => builtInOverrides.find((o) => o.id === b.id) ?? b);
    return [...merged, ...customs];
  } catch {
    return BUILT_IN_TEMPLATES;
  }
}

export function saveTemplates(templates: FormatTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function loadLogo(): string | null {
  return localStorage.getItem(LOGO_KEY);
}

export function saveLogo(dataUrl: string | null) {
  if (dataUrl) localStorage.setItem(LOGO_KEY, dataUrl);
  else localStorage.removeItem(LOGO_KEY);
}

export function loadInstitutionName(): string {
  return localStorage.getItem(INSTITUTION_KEY) ?? "";
}

export function saveInstitutionName(name: string) {
  localStorage.setItem(INSTITUTION_KEY, name);
}

export function duplicateTemplate(t: FormatTemplate): FormatTemplate {
  return {
    ...t,
    id: `custom-${Date.now()}`,
    name: `${t.name} (copia)`,
    isBuiltIn: false,
  };
}

export function emptyTemplate(): FormatTemplate {
  return duplicateTemplate(BUILT_IN_TEMPLATES[0]);
}
