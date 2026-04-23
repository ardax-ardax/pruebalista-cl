

# Aplicar layout en columna también a Verdadero/Falso con imagen

## Diagnóstico

La captura muestra una pregunta de **Verdadero/Falso**, no de selección múltiple. El layout en 2 columnas (texto izq / imagen der centrada) hoy solo se aplica a `multiple-choice`. Para V/F la imagen sigue cayendo como bloque centrado debajo del enunciado y arriba de las afirmaciones.

Además, en V/F con imagen el editor sigue mostrando los controles de ancho y alineación, que el usuario no quiere.

## Solución

Extender el comportamiento de "imagen en columna derecha, centrada, sin controles" a Verdadero/Falso, replicando exactamente la lógica que ya tiene multiple-choice. La altura de la columna de imagen se iguala automáticamente a la altura del bloque de afirmaciones (mismo mecanismo de tabla con `height:1px` que ya usa MC).

### 1) `src/lib/assessment-render.tsx`

- Cambiar `isSplit` para incluir V/F:
  ```
  const isSplit = (q.type === "multiple-choice" || q.type === "true-false") && !!q.image;
  ```
- En la rama `q.type === "true-false"`, si `isSplit`, envolver la lista `<ol class="pa-statements">` en la misma tabla `pa-mc-split` (celda izquierda con las afirmaciones, celda derecha con `renderContainedImageHtml(q.image)`).
- Reutilizar el mismo CSS `.pa-mc-split` / `.pa-mc-text` / `.pa-mc-image` (60% / 40%) que ya existe — sirve igual para V/F.

### 2) `src/lib/assessment-docx.ts`

- Aplicar el mismo cambio en `isSplit` (MC o V/F con imagen).
- Extender la rama de generación de tabla split para que, cuando `q.type === "true-false"`, la celda izquierda contenga los párrafos de las afirmaciones (en lugar de las opciones MC) y la celda derecha la imagen centrada con `widthPct` clampeado a 10–100.
- Reutilizar el mismo cálculo 60/40 ya existente.

### 3) `src/components/test-builder/QuestionEditor.tsx`

- Cambiar la condición que pasa `allowFullWidth` y muestra el mensaje informativo: aplicar tanto a `multiple-choice` como a `true-false`.
- Cuando se sube imagen en una pregunta V/F, asignar también `imageLayout: "side-right"` automáticamente (paralelo a lo que ya se hace para MC).
- Texto informativo actualizado: "La imagen se ubica en una columna a la derecha de las afirmaciones, centrada. Usá el control de ancho para ajustar su tamaño dentro de la columna."

### 4) `src/components/test-builder/ImageCropEditor.tsx`

- Cuando `allowFullWidth` está activo, **ocultar el selector de alineación** (la imagen siempre va centrada en su columna en este modo). Mantener visible solo el slider de ancho y el editor de recorte.
- Al activarse `allowFullWidth`, forzar internamente `alignment: "center"` en el `onChange` para que el valor quede consistente en el schema.

## Sin cambios de schema

`imageLayout` y `alignment` siguen existiendo. En V/F y MC con imagen se ignoran (siempre side-right + center). Otros tipos de pregunta no se ven afectados.

## Resultado esperado

- En V/F con imagen: afirmaciones a la izquierda (60%), imagen centrada en columna derecha (40%), altura de la columna igual a la del bloque de afirmaciones — idéntico al comportamiento de MC.
- El editor ya no muestra alineación en MC ni en V/F con imagen; solo el ancho dentro de la columna.
- Preview, PDF y Word consistentes.

