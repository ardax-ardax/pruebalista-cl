// Instrucciones oficiales por defecto para los Cuadernillos Maestros SIMCE / PAES.
// Se usan cuando el docente no escribe instrucciones propias en `meta.instructions`.

import type { PaesVariant } from "./assessment-schema";

export const SIMCE_DEFAULT_INSTRUCTIONS =
  "Lee atentamente cada pregunta antes de responder. Marca solo una alternativa por pregunta " +
  "ennegreciendo completamente el círculo correspondiente en la hoja de respuestas. " +
  "No se permite el uso de calculadora, diccionario ni dispositivos electrónicos. " +
  "Dispones de 90 minutos para completar la prueba. Trabaja en silencio.";

export const PAES_DEFAULT_INSTRUCTIONS_BASE =
  "Esta prueba contiene preguntas de selección múltiple con cinco opciones (A, B, C, D y E), " +
  "de las cuales solo UNA es correcta. Marca tus respuestas en la hoja de respuestas " +
  "ennegreciendo completamente el óvalo. Usa lápiz grafito N° 2 o portaminas HB. " +
  "No se permite el uso de calculadora, diccionario ni dispositivos electrónicos, salvo " +
  "indicación expresa del módulo. Si te equivocas, borra completamente antes de marcar la " +
  "alternativa definitiva.";

export function defaultInstructionsFor(
  essayMode: "simce" | "paes" | null | undefined,
  _variant?: PaesVariant,
): string | null {
  if (essayMode === "simce") return SIMCE_DEFAULT_INSTRUCTIONS;
  if (essayMode === "paes") return PAES_DEFAULT_INSTRUCTIONS_BASE;
  return null;
}
