// Catálogo oficial de Ejes Temáticos PAES (DEMRE).
// Datos estáticos cargados en código (no requiere tabla en BD).
import type { PaesVariant } from "./assessment-schema";

export type PaesCienciasModule = "biologia" | "fisica" | "quimica";

export const PAES_CIENCIAS_MODULES: { value: PaesCienciasModule; label: string }[] = [
  { value: "biologia", label: "Biología" },
  { value: "fisica", label: "Física" },
  { value: "quimica", label: "Química" },
];

// Clave compuesta para variantes que se subdividen.
export type PaesAxisGroupKey =
  | "competencia-lectora"
  | "m1"
  | "m2"
  | "ciencias-biologia"
  | "ciencias-fisica"
  | "ciencias-quimica"
  | "historia";

const M_AXES = ["Números", "Álgebra y Funciones", "Geometría", "Probabilidades y Estadística"];

export const PAES_AXES: Record<PaesAxisGroupKey, string[]> = {
  "competencia-lectora": [
    "Localizar información",
    "Interpretar y relacionar",
    "Reflexionar y evaluar",
  ],
  "m1": M_AXES,
  "m2": M_AXES,
  "ciencias-biologia": [
    "Organización celular",
    "Herencia y evolución",
    "Organismo y ambiente",
  ],
  "ciencias-fisica": [
    "Ondas",
    "Mecánica",
    "Energía",
    "Electricidad",
    "Tierra y Universo",
  ],
  "ciencias-quimica": [
    "Estructura atómica",
    "Química orgánica",
    "Reacciones químicas",
  ],
  "historia": [
    "Historia en perspectiva",
    "Formación Ciudadana",
    "Economía y Sociedad",
  ],
};

/**
 * Devuelve los ejes oficiales para una combinación variante + módulo (si Ciencias).
 * Retorna [] cuando faltan datos suficientes (ej. Ciencias sin módulo).
 */
export function getAxesFor(
  variant: PaesVariant | undefined | null,
  cienciasModule?: PaesCienciasModule | null,
): string[] {
  if (!variant) return [];
  if (variant === "ciencias") {
    if (!cienciasModule) return [];
    return PAES_AXES[`ciencias-${cienciasModule}` as PaesAxisGroupKey] ?? [];
  }
  return PAES_AXES[variant as PaesAxisGroupKey] ?? [];
}

/** Indica si la variante elegida requiere seleccionar un sub-módulo (caso Ciencias). */
export function requiresCienciasModule(variant: PaesVariant | undefined | null): boolean {
  return variant === "ciencias";
}
