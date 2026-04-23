

# Limitar altura de la imagen al alto de las opciones (layout dos columnas)

## Problema

En `multiple-choice` con `imageLayout: "side-right"` o `"side-left"`, la imagen ocupa el 20% derecho/izquierdo y las opciones el 80% restante. Hoy la altura de la imagen es libre: si la imagen es alta y las opciones son pocas líneas (ej. 4 opciones cortas), la imagen sobresale por debajo de la lista, dejando un bloque desbalanceado y desperdiciando espacio vertical.

La regla pedida: **la imagen no puede ser más alta que el conjunto de opciones del lado izquierdo**.

## 1) Preview web + PDF (`src/lib/assessment-render.tsx`)

Aprovechar que la `<table class="pa-mc-split">` ya alinea ambas celdas con `vertical-align: top`. Necesitamos que la celda de imagen actúe como contenedor con altura limitada y la imagen se ajuste dentro.

**Estrategia CSS — sin medir alturas en JS:**
- La fila de la tabla impone que ambas celdas tengan la **misma altura** automáticamente (comportamiento nativo de tablas HTML).
- La celda de imagen pasa a ser `position: relative` con altura determinada por la celda de texto.
- El contenido de la celda de imagen se envuelve en un contenedor con `position: absolute; inset: 0;` y la imagen interna usa `max-height: 100%; max-width: 100%; object-fit: contain;` para preservar proporción dentro de los límites.

**Cambios concretos:**
- En `renderImageHtml`, si recibe un flag adicional `containMode` (nuevo), genera el wrapper sin `aspect-ratio` y la `<img>` con `max-height: 100%; max-width: 100%; height: auto; width: auto; object-fit: contain;`. Para imágenes con crop, el wrapper interno (`pa-image-crop`) mantiene su `aspect-ratio` pero lleva además `max-height: 100%`, y se envuelve dentro de un contenedor flex con `align-items: flex-start` para que respete el límite vertical.
- Más simple: en lugar de tocar `renderImageHtml`, agregar una variante específica para split. Crear helper `renderImageHtmlContained(img)` que devuelve un wrapper con la lógica de crop (mismo cálculo de aspect-ratio y márgenes negativos) pero envuelto en un contenedor con `max-height: 100%` y la celda con `height: 1px` (truco clásico de tablas para que `height: 100%` funcione en hijos).
- Actualizar `ASSESSMENT_CSS`:
  ```
  .pa-mc-split { table-layout: fixed; }
  .pa-mc-split td.pa-mc-image { height: 1px; vertical-align: top; }
  .pa-mc-image .pa-image-wrap { height: 100%; max-height: 100%; display: flex; align-items: flex-start; justify-content: center; }
  .pa-mc-image .pa-image-crop { max-height: 100%; max-width: 100%; aspect-ratio: var(--ratio); }
  .pa-mc-image .pa-image-plain { max-height: 100%; max-width: 100%; height: auto; width: auto; object-fit: contain; }
  ```
- En la rama `isSplit` del render, llamar a una función `renderContainedImage(img)` que produce el HTML con `--ratio` como CSS variable inline para mantener la proporción del crop, y sin forzar `width: 100%` que rompería el ajuste vertical.

**Resultado esperado:** la imagen se escala (manteniendo proporción y crop) hasta llenar como máximo el alto de la columna de opciones. Si las opciones son cortas, la imagen se ve más pequeña; si son largas, la imagen crece hasta su tamaño natural respetando el ancho del 20%.

## 2) DOCX (`src/lib/assessment-docx.ts`)

Word/docx-js no tiene equivalente directo a `object-fit: contain` ni a "altura igual a otra celda". Las imágenes se insertan con dimensiones fijas en píxeles vía `transformation: { width, height }`.

**Estrategia: estimación de altura disponible basada en el conteo de opciones.**

- Calcular una altura aproximada en cm para el bloque de opciones:
  - Línea base de opción: `optionLineCm ≈ template.typography.bodySize * 0.0353 cm/pt * 1.35 (line-height) ≈ 0.48 cm` para 10pt.
  - Altura total estimada: `optionsCount * optionLineCm + 0.2cm de holgura`.
- En `buildImageRun`, aceptar un parámetro opcional `maxHeightCm`. Si se proporciona, calcular `maxHeightPx = maxHeightCm * 37.8` y, si la altura calculada (`heightPx`) excede ese máximo, escalar **ambas** dimensiones proporcionalmente para no deformar:
  ```
  if (heightPx > maxHeightPx) {
    const scale = maxHeightPx / heightPx;
    widthPx = Math.round(widthPx * scale);
    heightPx = maxHeightPx;
  }
  ```
- En la rama split de `questionParagraphs`, pasar `maxHeightCm = optionsCount * optionLineCm` al construir el `ImageRun` de la celda derecha/izquierda.

**Limitación honesta:** la estimación es aproximada — opciones con texto largo (que envuelven a 2 líneas) ocupan más alto del estimado. Para acercar más la realidad, contar líneas estimadas por opción con `Math.ceil(optionText.length / charsPerLine)` donde `charsPerLine ≈ 60` para una columna del 80% en 10pt. Sumar esas líneas y multiplicar por `optionLineCm`. No es perfecto pero evita las desproporciones más notorias.

## 3) Archivos a modificar

- `src/lib/assessment-render.tsx`:
  - Añadir reglas CSS al `ASSESSMENT_CSS` para celda de imagen con altura igualada.
  - Crear helper `renderContainedImageHtml(img)` para uso exclusivo en split.
  - En la rama `isSplit`, sustituir `renderImageHtml({ ...q.image, widthPct: 100 })` por `renderContainedImageHtml(q.image)`.
- `src/lib/assessment-docx.ts`:
  - Añadir parámetro opcional `maxHeightCm?: number` a `buildImageRun`.
  - Aplicar escalado proporcional cuando excede.
  - En la rama split, calcular `maxHeightCm` desde el número y largo de opciones, y pasarlo a `buildImageRun`.

## 4) Consideraciones técnicas

- **Crop preservado:** el aspect-ratio del área visible se respeta en ambos casos. En CSS por `aspect-ratio` del wrapper; en DOCX por escalado proporcional de `widthPx`/`heightPx`.
- **Compatibilidad:** layout `block` (imagen arriba) no se ve afectado — sigue usando `renderImageHtml` normal.
- **Borradores existentes:** sin cambios de schema; solo cambia el renderizado.
- **Print/PDF:** las reglas `max-height: 100%` y la igualación de altura por tabla funcionan en motor de impresión de Chromium (usado por la exportación PDF).

## Resultado esperado

- En preview y PDF, la imagen del split nunca sobrepasa verticalmente al bloque de opciones — se reduce manteniendo proporción si es necesario.
- En DOCX, la imagen se escala proporcionalmente para no exceder la altura estimada del bloque de opciones.
- Si las opciones son más altas que la imagen natural a 20% de ancho, la imagen mantiene su tamaño natural (no se estira).

