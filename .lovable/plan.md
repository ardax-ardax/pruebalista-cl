

# Imágenes en opciones, V/F múltiple y fin de la deformación

## 1) Imágenes en opciones de respuesta (con recorte visual)

Hoy `Option` solo tiene `{ id, text, correct }`. Las imágenes solo existen a nivel pregunta. Hay que extender el modelo y la UI.

**Schema (`src/lib/assessment-schema.ts`)**
- `Option` gana campo opcional `image?: QuestionImage | null`.

**Editor (`src/components/test-builder/QuestionEditor.tsx`)**
- Cada fila de opción muestra, debajo del input de texto, un `ImageCropEditor` colapsable ("Agregar imagen a esta opción"). Si la opción ya tiene imagen, se ve la miniatura recortada (la misma vista visual que ya tiene el editor de imagen de pregunta).
- Aplica para `multiple-choice` y para el nuevo modo V/F múltiple (cada afirmación puede tener imagen).

**Renderer (`src/lib/assessment-render.tsx`)**
- En el `<ol class="pa-options">`, después del texto de la opción, si `o.image` existe, renderizar el mismo bloque `pa-image-wrap`/`pa-image-crop` que ya se usa en preguntas, respetando `widthPct`, `alignment` y `crop`.

**DOCX (`src/lib/assessment-docx.ts`)**
- Insertar la imagen de la opción como párrafo siguiente a la línea de la opción, con el recorte aplicado (mismo helper que ya genera imágenes de pregunta).

## 2) Verdadero / Falso con múltiples afirmaciones

Hoy `true-false` se modela como una sola pregunta con dos opciones (Verdadero/Falso) — no permite "lista de afirmaciones" típica de un ítem V/F.

**Cambio de modelo**
- Nuevo campo opcional en `Question`: `statements?: TfStatement[]` donde `TfStatement = { id, text, answer: "V" | "F", image?: QuestionImage | null, points?: number }`.
- Cuando `type === "true-false"`, se usa `statements` en vez de `options`. Migración: si una pregunta vieja V/F llega sin `statements`, se inicializa con un statement vacío `answer: "V"`.

**Editor (`QuestionEditor.tsx`)**
- Para `true-false` se muestra una tabla/lista editable de afirmaciones:
  - Cada fila: número (1, 2, 3…), botón `V` / `F` (toggle exclusivo), `Textarea` de la afirmación, opcional imagen (con `ImageCropEditor`), eliminar.
  - Botón "Agregar afirmación".
- El campo "Puntaje" pasa a ser por afirmación (suma automática reflejada en el total).

**Renderer y DOCX**
- Para `true-false`, render no como `<ol>`, sino como lista numerada de afirmaciones precedidas por un par `( V ) ( F )` o el guion estándar institucional, con la imagen opcional debajo de cada afirmación.
- Numeración global de preguntas: cada pregunta V/F sigue contando como **una** pregunta numerada (consistente con la nomenclatura de "ítem II"); las afirmaciones se enumeran internamente con letras o números secundarios. Decisión: enumerar internamente con números (1.1, 1.2…) para mantener trazabilidad y total de puntos por afirmación.

## 3) Las imágenes se deforman

**Causa exacta** (en `assessment-render.tsx` `renderImageHtml` y en `ImageCropEditor` la miniatura):
Cuando hay crop se hace `<img style="width: X%; height: auto;">` envuelto en un `<span>` con `aspect-ratio: auto` pero la imagen interna recibe `width:(100/visibleW)*100%` SIN `height:auto`, y en el preview cuando NO hay crop el `<img>` recibe `width: widthPct%` y `height: auto`, lo cual es correcto — pero al recortar se forzan width y height en porcentajes distintos calculados independientemente, deformando.

**Arreglo del renderer**
- Sustituir el modelo de "ancho + alto en %" por un wrapper con `aspect-ratio` calculado a partir del `naturalWidth/naturalHeight` de la imagen y los porcentajes de crop, con la imagen interna en `width: 100%; height: auto;` y desplazada por `transform: translate(-L%, -T%) scale(1/(1-L-R), 1/(1-T-B))` o, más simple y robusto: `<span>` con `width: widthPct%`, `aspect-ratio: (origW*visibleW)/(origH*visibleH)`, `overflow:hidden`; dentro `<img>` con `width: (100/visibleW)*100%; height: auto; margin-left: -(L/visibleW)*100%; margin-top: -(T/visibleH)*100%`. Esto preserva proporción porque solo `width` define la escala; `height` se deduce.
- Para obtener `naturalWidth/Height`, almacenar `naturalW` y `naturalH` dentro de `QuestionImage` al cargar el archivo (en `ImageCropEditor.onPick` usar `new Image(); img.onload`).

**Arreglo del editor (miniatura)**
- Reemplazar el cálculo actual basado en `width:160 height:120` fijo por: contenedor con `aspect-ratio` derivado del crop y de la imagen natural; `<img>` solo con `width` calculado y sin `height` forzado. Así el thumbnail se ve fiel al PDF y nunca deformado.

**Arreglo del DOCX**
- En `assessment-docx.ts`, calcular `cx`/`cy` (EMU) a partir de `naturalW/H` reales y del `visibleW/H` post-crop manteniendo proporción (`cy = cx * (naturalH*visibleH) / (naturalW*visibleW)`). Hoy se usa una proporción fija o se deja a Word, que estira si los porcentajes de crop no coinciden.

## Archivos a modificar

- `src/lib/assessment-schema.ts` — `Option.image`, `TfStatement`, `Question.statements`, `QuestionImage.naturalW/naturalH`, migración de V/F existentes.
- `src/components/test-builder/ImageCropEditor.tsx` — capturar dimensiones naturales al subir; miniatura con `aspect-ratio` real.
- `src/components/test-builder/QuestionEditor.tsx` — imagen por opción; UI nueva para statements V/F.
- `src/lib/assessment-render.tsx` — render de imagen en opciones; render de statements V/F; markup de imagen sin deformación + CSS de `.pa-image-crop` con `aspect-ratio`.
- `src/lib/assessment-docx.ts` — soporte de imagen por opción y por statement; tamaño EMU proporcional.
- `src/lib/assessment-pdf.ts` — sin cambios de lógica (sigue tomando el HTML del renderer, hereda los fixes).

## Resultado esperado

- Cada opción (a, b, c, d) puede tener su propia imagen recortada, visible en preview y en PDF/DOCX.
- V/F se vuelve un ítem real de varias afirmaciones, cada una con su V/F correcto y su imagen opcional, totalizando puntos por afirmación.
- Las imágenes (en pregunta, en opción y en afirmación V/F) conservan proporción tanto en el editor como en preview, PDF y DOCX, incluso con recortes.

