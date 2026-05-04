// Curriculum data — reads entirely from DB (curriculum_base table).
// Public API: getOAs, findOA, hasCurriculum, findIndicators, TRANSVERSAL_SKILLS.

import { listOverrides, naturalSortByCode } from "./curriculum-overrides";

export interface Indicator {
  code: string;
  description: string;
}

export interface OA {
  code: string;
  description: string;
  eje?: string;
  indicators: Indicator[];
}

// Fallback genérico cuando no hay OAs para un curso/asignatura.
export const TRANSVERSAL_SKILLS: OA[] = [
  {
    code: "HT 01", eje: "Pensamiento crítico",
    description: "Analizar, interpretar y evaluar información proveniente de distintas fuentes para formarse una opinión fundamentada.",
    indicators: [
      { code: "1.1", description: "Compara información de al menos dos fuentes." },
      { code: "1.2", description: "Distingue hechos de opiniones." },
      { code: "1.3", description: "Fundamenta su postura con evidencia del texto o fuente." },
    ],
  },
  {
    code: "HT 02", eje: "Comunicación",
    description: "Comunicar ideas, opiniones y resultados de manera clara y coherente, utilizando lenguaje oral, escrito y visual apropiado al contexto.",
    indicators: [
      { code: "2.1", description: "Organiza su mensaje con introducción, desarrollo y cierre." },
      { code: "2.2", description: "Usa vocabulario preciso al contexto." },
      { code: "2.3", description: "Apoya la comunicación con recursos visuales o ejemplos." },
    ],
  },
  {
    code: "HT 03", eje: "Resolución de problemas",
    description: "Identificar problemas, plantear estrategias de solución, evaluar alternativas y aplicar la más adecuada al contexto.",
    indicators: [
      { code: "3.1", description: "Define el problema con sus propias palabras." },
      { code: "3.2", description: "Propone al menos dos estrategias de resolución." },
      { code: "3.3", description: "Verifica el resultado obtenido." },
    ],
  },
  {
    code: "HT 04", eje: "Trabajo colaborativo",
    description: "Trabajar en equipo de manera responsable, respetando las ideas de los demás y aportando al logro de objetivos comunes.",
    indicators: [
      { code: "4.1", description: "Cumple con el rol asignado en el equipo." },
      { code: "4.2", description: "Escucha y valora las ideas de sus compañeros." },
      { code: "4.3", description: "Aporta al producto colectivo dentro del plazo." },
    ],
  },
  {
    code: "HT 05", eje: "Uso de TIC",
    description: "Utilizar herramientas tecnológicas para buscar, organizar, producir y comunicar información de manera ética y eficiente.",
    indicators: [
      { code: "5.1", description: "Selecciona la herramienta adecuada para la tarea." },
      { code: "5.2", description: "Cita las fuentes utilizadas." },
      { code: "5.3", description: "Respeta normas de uso responsable y seguro." },
    ],
  },
  {
    code: "HT 06", eje: "Autorregulación",
    description: "Planificar, monitorear y evaluar el propio aprendizaje, asumiendo responsabilidad sobre los procesos y resultados.",
    indicators: [
      { code: "6.1", description: "Establece metas concretas para la tarea." },
      { code: "6.2", description: "Monitorea sus avances y ajusta estrategias." },
      { code: "6.3", description: "Reflexiona sobre los resultados obtenidos." },
    ],
  },
];

const overrideToOA = (o: { oa_code: string; oa_description: string; eje?: string; indicators: Indicator[] }): OA => ({
  code: o.oa_code,
  description: o.oa_description,
  eje: o.eje,
  indicators: Array.isArray(o.indicators) ? o.indicators : [],
});

export const hasCurriculum = (gradeValue: string, subjectValue: string): boolean => {
  if (!gradeValue || !subjectValue) return false;
  return listOverrides(gradeValue, subjectValue).length > 0;
};

export const getOAs = (gradeValue: string, subjectValue: string): OA[] => {
  if (!gradeValue || !subjectValue) return [];
  const rows = listOverrides(gradeValue, subjectValue);
  if (rows.length > 0) return naturalSortByCode(rows.map(overrideToOA));
  return TRANSVERSAL_SKILLS;
};

export const findOA = (gradeValue: string, subjectValue: string, code: string): OA | undefined =>
  getOAs(gradeValue, subjectValue).find((o) => o.code === code);

export const findIndicators = (gradeValue: string, subjectValue: string, oaCode: string): Indicator[] =>
  findOA(gradeValue, subjectValue, oaCode)?.indicators ?? [];

// Compat export (legacy).
export const CURRICULUM: Record<string, Record<string, unknown[]>> = {};
