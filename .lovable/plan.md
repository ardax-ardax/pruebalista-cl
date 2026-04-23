

# Imagen MC más grande: ampliar columna y respetar `widthPct`

## Problema

En selección múltiple con imagen, la columna de imagen está fija en **20%** del ancho de contenido (texto en 80%). Eso vuelve la imagen muy pequeña, sin importar las dimensiones reales o el `widthPct` configurado por el usuario.

Además, en el render dentro de la columna, el `widthPct` se ignora (se fuerza a 100% de la celda en DOCX y la columna manda en HTML), así que el usuario no tiene control sobre el tamaño.

## Solución

### 1) Ampliar la columna de imagen al 40% (texto 60%)

`src/lib/assessment-render.tsx` — CSS `.pa-mc-split`:
- `.pa-mc-text { width: 60%; }`
- `.pa-mc-image { width: 40%; }`

`src/lib/assessment-docx.ts` — en la rama `isSplit`:
- Cambiar `textColCm = contentWidthCm * 0.6` y `imgColCm = contentWidthCm * 0.4`.
- Ajustar `columnWidths` y `width` de las celdas a `0.6` / `0.4`.
- Recalcular `charsPerLine` con la nueva `textColCm` (la fórmula ya es proporcional, solo cambia el insumo).

### 2) Respetar `widthPct` dentro de la columna

El `widthPct` del usuario se interpretará como **porcentaje del ancho de la columna de imagen**, no del ancho de página. Default 100%.

`src/lib/assessment-render.tsx` — `renderContainedImageHtml`:
- Aplicar `width: ${img.widthPct}%` (clamp 10–100) al wrapper / al `.pa-image-crop` / `.pa-image-plain`, en lugar de `max-width: 100%` puro.

`src/lib/assessment-docx.ts` — rama `isSplit`:
- Pasar `widthPct: clamp(10, 100, q.image.widthPct)` en lugar de forzar `100`.

### 3) Quitar el clamp restrictivo de `widthPct` para MC con imagen

En `ImageCropEditor` el slider hoy clampa a 20% para `left/right` y 50% para `center`. Para una imagen MC el slider debe permitir 10–100% (ya que se aplica sobre la columna, no sobre la página).

`src/components/test-builder/ImageCropEditor.tsx`:
- Aceptar un prop opcional `allowFullWidth` (boolean). Cuando es `true`, usar `MAX_IMAGE_WIDTH_PCT` (100) sin importar la alineación.

`src/components/test-builder/QuestionEditor.tsx`:
- En la imagen del enunciado de una pregunta `multiple-choice`, pasar `allowFullWidth={true}` al `ImageCropEditor`.
- Actualizar el texto informativo: "En selección múltiple la imagen ocupa una columna a la derecha de las opciones; usá el control de ancho para ajustar su tamaño dentro de la columna".

## Resultado esperado

- La columna de imagen pasa de 20% a 40% del ancho de contenido — la imagen se ve significativamente más grande por defecto.
- El usuario puede ajustar el `widthPct` (10–100) para reducirla dentro de su columna si lo desea.
- Sin cambios de schema. DOCX, PDF y preview quedan consistentes.

