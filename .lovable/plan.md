

# Título por enunciado + tope de 20% de ancho para imágenes

## 1) Título obligatorio por enunciado

**Schema (`src/lib/assessment-schema.ts`)**
- `Question` gana campo `title?: string` (opcional para no romper borradores existentes, pero la UI lo trata como recomendado).
- Aplica solo a tipos contables: `multiple-choice`, `true-false`, `short-answer`. No a `section-title` ni `info-block` (que ya son títulos/contexto).

**Editor (`QuestionEditor.tsx`)**
- Sobre el `Textarea` "Enunciado" se agrega un `Input` "Título del enunciado" (placeholder: "Ej: Comprensión de lectura · Texto 1"). Más compacto y en negrita visual.
- Misma posición en los tres tipos contables.

**Renderer web (`assessment-render.tsx`)**
- Si `q.title` existe, se imprime antes de la línea numerada de la pregunta como un sub-encabezado:
  ```
  <div class="pa-question-title">{title}</div>
  <div class="pa-question-header">N) {prompt} (X pts)</div>
  ```
- Nuevo CSS:
  ```
  .pa-question-title { font-weight: bold; font-size: 10pt; margin-top: 2pt; margin-bottom: 1pt; text-transform: none; }
  ```

**DOCX (`assessment-docx.ts`)**
- En `questionParagraphs`, si `q.title` existe, push un `Paragraph` previo al header con `TextRun({ text: q.title, bold: true })` y `spacing.before: 120, after: 0`.

**Migración**: pruebas guardadas sin `title` siguen funcionando; el campo simplemente no se renderiza si está vacío.

## 2) Tope de 20% del ancho para imágenes

**Regla**
- El campo `widthPct` de `QuestionImage` se acota a `[10, 20]` en vez de `[10, 100]`.
- Aplica a imagen de pregunta, de opción y de afirmación V/F.

**Editor (`ImageCropEditor.tsx`)**
- `Input type="number"` de Ancho cambia a `min={10} max={20}`, default al subir nueva imagen pasa a `20` (en vez de 60/80).
- Texto de ayuda corto: "Máx. 20% del ancho disponible".

**Schema/Helpers**
- Helper `clampWidthPct(n) => Math.max(10, Math.min(20, n))` aplicado al cambiar widthPct y al cargar imágenes nuevas.
- Migración suave: al cargar una prueba existente con `widthPct > 20`, se acota a 20 al editarla (sin tocar storage hasta que el usuario edite).

**Layout split (multiple-choice `side-right`/`side-left`)**
- Hoy en split la imagen se renderiza con `widthPct: 100` forzado para llenar la columna del 40%. Eso ya da ~40% del ancho total. Para respetar el tope:
  - En split, la columna de imagen pasa de 40% a **20% del ancho total** y la columna de texto sube a **80%**. La imagen sigue ocupando el 100% de su columna, así el tope queda respetado.
  - Aplica simétricamente en preview HTML (`pa-mc-split` con `width: 80%/20%`) y en DOCX (`columnWidths` 0.8/0.2).

**Resultado visual**
- Las imágenes nunca exceden el 20% del ancho de contenido de la página, lo que las mantiene compactas y deja espacio para texto. El recorte sigue funcionando igual; lo que cambia es solo el ancho final de salida.

## Archivos a modificar

- `src/lib/assessment-schema.ts` — añadir `title?: string` a `Question`; añadir helper `clampWidthPct`.
- `src/components/test-builder/QuestionEditor.tsx` — input de título; sin más cambios.
- `src/components/test-builder/ImageCropEditor.tsx` — acotar widthPct a 20%; ajustar default y placeholder.
- `src/lib/assessment-render.tsx` — renderizar `q.title`; ajustar `.pa-mc-split` a 80/20; CSS `.pa-question-title`.
- `src/lib/assessment-docx.ts` — emitir párrafo de título; ajustar `columnWidths` de la tabla split a 0.8/0.2; usar `imgColCm = contentWidthCm * 0.2` para `buildImageRun` en split.

## Resultado esperado

- Cada pregunta puede llevar un título corto en negrita por encima del enunciado, visible en preview, PDF y DOCX.
- Ninguna imagen (de pregunta, opción o afirmación V/F) supera el 20% del ancho útil de la página, ni siquiera en layouts a dos columnas.
- El comportamiento existente de recorte y proporción se mantiene intacto.

