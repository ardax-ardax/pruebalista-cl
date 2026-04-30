// Tipos y plantillas predefinidas del estandarizador

export type Alignment = "left" | "center" | "right" | "justify";

export interface FormatTemplate {
  id: string;
  name: string;
  description: string;
  isBuiltIn?: boolean;
  /**
   * Modo "ensayo estandarizado". Si está presente, fuerza diseño de 2 columnas
   * de página y fuente específica sin importar la configuración por prueba.
   *  - "simce": 2 col, sans-serif (Arial), sin línea divisoria.
   *  - "paes":  2 col con línea divisoria, serif (Times New Roman), 5 alternativas.
   */
  essayMode?: "simce" | "paes";

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
  pageSize: {
    widthCm: number;  // ancho hoja en cm
    heightCm: number; // alto hoja en cm
  };
  body: {
    alignment: Alignment; // alineación por defecto del cuerpo
  };
  fileNaming?: {
    enabled: boolean;
    prefix: string; // ej: "Ev_Sumativa"
    hint: string;   // texto guía mostrado al usuario
  };
  header: {
    enabled: boolean;
    institutionName: string;
    showLogo: boolean;
    alignment: Alignment;
    /**
     * Estilo del encabezado:
     *  - "banner-evaluacion": tabla 3 columnas con logo + Profesor/Asignatura/Curso + recuadro Calificación
     *  - "banner-guia": igual al anterior pero SIN recuadro Calificación
     *  - "classic": header de Word tradicional (texto centrado)
     */
    style?: "banner-evaluacion" | "banner-guia" | "classic";
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
  "Century Gothic",
  "Arial",
  "Calibri",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Cambria",
  "Garamond",
  "Tahoma",
] as const;

// Tamaño Oficio personalizado del colegio (21.59 x 33.02 cm)
export const SCHOOL_PAGE_SIZE = { widthCm: 21.59, heightCm: 33.02 };
export const A4_PAGE_SIZE = { widthCm: 21, heightCm: 29.7 };
export const LETTER_PAGE_SIZE = { widthCm: 21.59, heightCm: 27.94 };

// Parámetros base comunes a todas las plantillas del colegio
// (Century Gothic 10, justificado, márgenes 2.5/2/2/2, hoja Oficio 21.59 x 33.02 cm)
const SCHOOL_BASE = {
  typography: {
    bodyFont: "Century Gothic",
    headingFont: "Century Gothic",
    bodySize: 10,
    h1Size: 14,
    h2Size: 12,
    h3Size: 11,
    bodyColor: "000000",
    headingColor: "000000",
  },
  spacing: {
    marginTop: 2,
    marginBottom: 2,
    marginLeft: 2.5,
    marginRight: 2,
    lineSpacing: 1.15,
    paragraphSpacingBefore: 0,
    paragraphSpacingAfter: 6,
  },
  pageSize: { ...SCHOOL_PAGE_SIZE },
  body: { alignment: "justify" as Alignment },
  headings: {
    bold: true,
    h1Alignment: "center" as Alignment,
    h2Alignment: "left" as Alignment,
    h3Alignment: "left" as Alignment,
  },
};

export const BUILT_IN_TEMPLATES: FormatTemplate[] = [
  {
    id: "ev-formativa-formal",
    name: "Ev. Formativa Formal",
    description:
      "Evaluación formativa formal del colegio. Century Gothic 10, justificado, hoja Oficio.",
    isBuiltIn: true,
    ...SCHOOL_BASE,
    header: {
      enabled: true,
      institutionName: "New Little College La Florida",
      showLogo: true,
      alignment: "center",
      style: "banner-evaluacion",
    },
    footer: {
      enabled: true,
      text: "",
      showPageNumber: true,
      showDate: false,
    },
    fileNaming: {
      enabled: true,
      prefix: "Ev_Diversificada",
      hint: "Ej: Ev_Diversificada_N°1_Historia_7Básico",
    },
  },
  {
    id: "ev-sumativa",
    name: "Ev. Sumativa",
    description:
      "Evaluación sumativa del colegio con encabezado institucional y formato unificado.",
    isBuiltIn: true,
    ...SCHOOL_BASE,
    header: {
      enabled: true,
      institutionName: "New Little College La Florida",
      showLogo: true,
      alignment: "center",
      style: "banner-evaluacion",
    },
    footer: {
      enabled: true,
      text: "",
      showPageNumber: true,
      showDate: false,
    },
    fileNaming: {
      enabled: true,
      prefix: "Ev_Sumativa",
      hint: "Ej: Ev_Sumativa_N°1_Historia_7Básico",
    },
  },
  {
    id: "guia-portafolio",
    name: "Guía de Portafolio",
    description:
      "Guía de aprendizaje para portafolio. Mismo formato institucional que las evaluaciones.",
    isBuiltIn: true,
    ...SCHOOL_BASE,
    header: {
      enabled: true,
      institutionName: "New Little College La Florida",
      showLogo: true,
      alignment: "center",
      style: "banner-guia",
    },
    footer: {
      enabled: true,
      text: "",
      showPageNumber: true,
      showDate: false,
    },
    fileNaming: {
      enabled: true,
      prefix: "Guía_Portafolio",
      hint: "Ej: Guía_Portafolio_N°1_Historia_7Básico",
    },
  },
  // ====== Plantillas de ensayo estandarizado ======
  {
    id: "ensayo-simce",
    name: "Ensayo SIMCE",
    description:
      "Formato oficial SIMCE, 2 columnas, fuente Sans-Serif, optimizado para ahorro de papel.",
    isBuiltIn: true,
    essayMode: "simce",
    typography: {
      bodyFont: "Arial",
      headingFont: "Arial",
      bodySize: 10,
      h1Size: 13,
      h2Size: 11,
      h3Size: 10,
      bodyColor: "000000",
      headingColor: "000000",
    },
    spacing: {
      marginTop: 1.5,
      marginBottom: 1.5,
      marginLeft: 1.5,
      marginRight: 1.5,
      lineSpacing: 1.1,
      paragraphSpacingBefore: 0,
      paragraphSpacingAfter: 4,
    },
    pageSize: { ...A4_PAGE_SIZE },
    body: { alignment: "justify" },
    headings: {
      bold: true,
      h1Alignment: "center",
      h2Alignment: "left",
      h3Alignment: "left",
    },
    header: {
      enabled: true,
      institutionName: "New Little College La Florida",
      showLogo: true,
      alignment: "center",
      style: "banner-evaluacion",
    },
    footer: {
      enabled: true,
      text: "",
      showPageNumber: true,
      showDate: false,
    },
    fileNaming: {
      enabled: true,
      prefix: "Ensayo_SIMCE",
      hint: "Ej: Ensayo_SIMCE_Lenguaje_4Básico",
    },
  },
  {
    id: "ensayo-paes",
    name: "Ensayo PAES",
    description:
      "Formato oficial PAES, 2 columnas con línea divisoria, fuente Serif (Times New Roman), soporte para 5 alternativas.",
    isBuiltIn: true,
    essayMode: "paes",
    typography: {
      bodyFont: "Times New Roman",
      headingFont: "Times New Roman",
      bodySize: 11,
      h1Size: 14,
      h2Size: 12,
      h3Size: 11,
      bodyColor: "000000",
      headingColor: "000000",
    },
    spacing: {
      marginTop: 1.5,
      marginBottom: 1.5,
      marginLeft: 1.5,
      marginRight: 1.5,
      lineSpacing: 1.15,
      paragraphSpacingBefore: 0,
      paragraphSpacingAfter: 4,
    },
    pageSize: { ...LETTER_PAGE_SIZE },
    body: { alignment: "justify" },
    headings: {
      bold: true,
      h1Alignment: "center",
      h2Alignment: "left",
      h3Alignment: "left",
    },
    header: {
      enabled: true,
      institutionName: "New Little College La Florida",
      showLogo: true,
      alignment: "center",
      style: "banner-evaluacion",
    },
    footer: {
      enabled: true,
      text: "",
      showPageNumber: true,
      showDate: false,
    },
    fileNaming: {
      enabled: true,
      prefix: "Ensayo_PAES",
      hint: "Ej: Ensayo_PAES_Matemática_3Medio",
    },
  },
];

const STORAGE_KEY = "estandarizador.templates.v2";
const LOGO_KEY = "estandarizador.logo.v2";
const INSTITUTION_KEY = "estandarizador.institution.v2";

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
