# Imagen en preguntas de desarrollo

Aplica a preguntas de tipo **Desarrollo corto** (`short-answer`). La imagen del enunciado se renderiza siempre **centrada** y por encima de las líneas de respuesta (esto último ya ocurre hoy). Cambia el rango y el valor por defecto del ancho.

## Cambios

1. **Ancho de imagen para desarrollo**
   - Rango permitido: **10% – 80%** del ancho disponible.
   - Valor por defecto al subir una imagen: **50%**.
   - Alineación: **centro fija** (sin selector izquierda/derecha para este tipo de pregunta).

2. **Editor (`QuestionEditor.tsx`)**
   - En `short-answer`, mostrar el editor de imagen en un modo nuevo (centrado forzado, ancho hasta 80%, default 50%).
   - Resto de tipos (info-block, section-title) siguen igual con los topes actuales.

3. **Render HTML/PDF (`assessment-render.tsx`)**
   - La imagen del enunciado ya se inserta antes del cuerpo en `short-answer`. No requiere cambios estructurales; respeta el `widthPct` y alineación centro.

4. **Render DOCX (`assessment-docx.ts`)**
   - Igual: ya emite la imagen antes de las líneas. Respetará el nuevo `widthPct` y centrado.

## Detalles técnicos

- En `assessment-schema.ts`:
  - Añadir constantes `MAX_IMAGE_WIDTH_DEV_PCT = 80` y `DEFAULT_IMAGE_WIDTH_DEV_PCT = 50`.
  - Añadir helper `clampWidthPctDev(n)` que limita a `[10, 80]`.

- En `ImageCropEditor.tsx`:
  - Añadir prop `mode?: "default" | "column" | "development"` (o un par de props equivalentes: `maxWidthOverride`, `defaultWidthOverride`, `lockCenter`).
  - Modo `development`: alineación forzada `center`, slider/input con máx 80, default 50, ocultar selector de alineación.
  - Migración suave: si una imagen existente tiene `widthPct > 80` o `alignment !== "center"`, se ajusta al cargarse (efecto similar al actual `allowFullWidth`).

- En `QuestionEditor.tsx`:
  - Para `short-answer`, usar `<ImageCropEditor mode="development" ... />` en lugar del editor genérico.

## Archivos afectados

- `src/lib/assessment-schema.ts`
- `src/components/test-builder/ImageCropEditor.tsx`
- `src/components/test-builder/QuestionEditor.tsx`

¿Apruebas el plan?