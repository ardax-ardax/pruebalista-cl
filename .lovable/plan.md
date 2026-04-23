

# Recortador visual estilo Lightbox + layout dos columnas (opciones a la izquierda, imagen a la derecha)

## 1) Editor visual de recorte (estilo Lightbox)

Hoy el recorte se hace con 4 sliders numéricos (top/bottom/left/right %) y se ve solo en una miniatura. No hay manipulación directa sobre la imagen.

**Nuevo componente** `src/components/test-builder/ImageCropDialog.tsx`:
- Se abre como `Dialog` modal grande (max-w-4xl) al pulsar "Recortar".
- Muestra la imagen completa en grande, sobre fondo oscuro semi-transparente (estilo lightbox).
- Encima dibuja un **rectángulo de recorte arrastrable y redimensionable** con 8 manijas (esquinas + lados).
- El área **fuera** del rectángulo se ve oscurecida (overlay con `box-shadow: 0 0 0 9999px rgba(0,0,0,.6)` o 4 divs perimetrales).
- Cursor: `move` dentro, `nwse-resize`/`nesw-resize`/`ns-resize`/`ew-resize` en manijas.
- Footer: **Cancelar**, **Restablecer** (limpia crop), **Aplicar** (guarda los % al `QuestionImage`).
- Internamente trabaja en píxeles del contenedor mostrado y al "Aplicar" convierte a porcentajes (0–100) usando las dimensiones renderizadas.
- Implementación con eventos pointer (no librería externa): `onPointerDown` en manija/área → `onPointerMove` actualiza rect → `onPointerUp` finaliza. Restringe el rect dentro de los límites de la imagen y respeta tamaño mínimo (5%).

**`ImageCropEditor.tsx`** se modifica:
- El botón "Recortar" abre el `ImageCropDialog` en vez de mostrar/ocultar 4 sliders.
- Se mantienen los sliders como modo avanzado/colapsable opcional (acordeón "Ajustes finos") por si el usuario quiere precisión numérica.
- La miniatura existente sigue mostrando el resultado del crop (ya sin deformación, gracias al fix previo).

## 2) Layout de dos columnas en selección múltiple

Hoy, en `multiple-choice` con imagen de pregunta, la imagen va arriba (sobre las opciones, ocupando ancho completo). Cuando es una imagen pequeña/media (ej. mapa, gráfico), desperdicia espacio.

**Schema (`src/lib/assessment-schema.ts`)**
- `Question` gana campo opcional `imageLayout?: "block" | "side-right" | "side-left"`. Default: `"block"` (comportamiento actual).
- Solo aplica visualmente cuando `type === "multiple-choice"` y existe `q.image`.

**Editor (`QuestionEditor.tsx`)**
- Cuando hay imagen y la pregunta es selección múltiple, aparece un selector adicional debajo del control de alineación: **"Disposición"** con opciones:
  - Imagen arriba (block)
  - Imagen a la derecha (opciones a la izquierda)
  - Imagen a la izquierda (opciones a la derecha)

**Renderer (`assessment-render.tsx`)**
- Si `q.type === "multiple-choice"` y `q.image` y `q.imageLayout` ∈ `{side-right, side-left}`:
  - Usar una `<table class="pa-mc-split">` de dos columnas (60% texto / 40% imagen, o invertido), `vertical-align: top`, sin bordes.
  - La columna de texto contiene el `<ol class="pa-options">`.
  - La columna de imagen contiene el bloque `pa-image-wrap` ya existente (con su crop correcto).
  - El enunciado de la pregunta sigue arriba, ocupando ancho completo.
- Si no, comportamiento actual (imagen arriba, opciones debajo).
- CSS nuevo en `ASSESSMENT_CSS`:
  ```
  .pa-mc-split { width:100%; border-collapse:collapse; margin-top:4pt; }
  .pa-mc-split td { vertical-align:top; padding:0; border:0; }
  .pa-mc-split .pa-mc-text { width:60%; padding-right:8pt; }
  .pa-mc-split .pa-mc-image { width:40%; }
  ```
  Para `side-left`, intercambiar el orden de las celdas.

**DOCX (`assessment-docx.ts`)**
- Replicar misma estructura con `Table` de dos columnas, sin bordes, columna texto y columna imagen.
- Las opciones se generan como `Paragraph[]` dentro de la celda izquierda; la imagen como `Paragraph` con `ImageRun` en la derecha.
- Anchos: 60/40 del `contentWidthCm`. La imagen recibe como `contentWidthCm` solo el ancho de su columna para que el `widthPct` siga siendo relativo a esa columna.

## 3) Archivos a modificar/crear

- **Nuevo**: `src/components/test-builder/ImageCropDialog.tsx` — modal de recorte interactivo.
- `src/components/test-builder/ImageCropEditor.tsx` — botón "Recortar" abre el diálogo; sliders pasan a sección "Ajustes finos" colapsable.
- `src/lib/assessment-schema.ts` — `Question.imageLayout` opcional.
- `src/components/test-builder/QuestionEditor.tsx` — selector de "Disposición" cuando aplica.
- `src/lib/assessment-render.tsx` — layout split + CSS nuevo.
- `src/lib/assessment-docx.ts` — tabla de dos columnas para split en multiple-choice.

## 4) Consideraciones técnicas

- **Recorte sobre imagen ya recortada**: el diálogo abre siempre la imagen original (`img.src`) y muestra el rect actual reconstruido desde `img.crop`. Editar reemplaza, no acumula.
- **Miniatura post-crop**: ya correcta tras el fix previo de aspect-ratio.
- **Imagen muy alta**: el diálogo limita altura del visor a `70vh` y escala la imagen a `object-fit: contain`; los % se calculan sobre el tamaño renderizado, no sobre el natural — son independientes del zoom.
- **Touch / pointer**: usar `setPointerCapture` para arrastres confiables en táctil.
- **Responsive del diálogo**: en pantallas pequeñas, sliders accesibles también dentro del modal como fallback.
- **Layout split + recorte**: el `widthPct` de la imagen se mantiene; en modo split la columna ya define el ancho disponible, así que un `widthPct: 100` llena la columna del 40%, y se ve correctamente proporcionada.
- **Compatibilidad**: borradores/pruebas guardadas sin `imageLayout` siguen funcionando (fallback a `"block"`).

## Resultado esperado

- Recortar una imagen se hace **arrastrando** sobre la imagen real, no escribiendo porcentajes.
- En selección múltiple, el docente puede colocar la imagen al costado de las opciones, ahorrando una franja vertical importante de página.
- Preview, PDF y DOCX reflejan exactamente lo mismo.

