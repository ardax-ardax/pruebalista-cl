

# Las imágenes envuelven el texto: forzar layout vertical y dar aire entre preguntas

## Diagnóstico

Comparando las dos imágenes que enviaste:

- **Imagen 1 (mal, post-proceso)**: las imágenes (mosca/perro/murciélago, etc.) están **flotando** y el texto de la siguiente pregunta se acomoda al costado. Por eso "2) ¿Cuál de estos animales se desplaza con sus aletas?" aparece a la derecha de las primeras imágenes, y "4) ¿Qué común lagarto?" queda partido a la izquierda con "tienen en el tiburón y el pelos" a la derecha.
- **Imagen 2 (bien, deseado)**: cada pregunta y sus imágenes ocupan filas completas, sin envolver texto.

## Causa exacta en el código

En `src/lib/docx-processor.ts` línea 1397, `fitOversizedImagesString` tiene esta regla:

```ts
if (/<wp:anchor\b/.test(drawingXml)) return drawingXml;
```

Las imágenes del archivo original están como **`<wp:anchor>`** (ancladas/flotantes) con `<wp:wrapSquare>` o `<wp:wrapTight>`. La pasada las preserva tal cual, conservando el wrapping cuadrado que envuelve al texto.

Además, mi último cambio `applyQuestionRhythm` puso `before=160, after=60` (8pt antes / 3pt después) a las preguntas. Combinado con `collapseBlankParagraphs` que elimina los párrafos vacíos, las preguntas quedan **demasiado pegadas**, contribuyendo al "amontonamiento".

## Plan de arreglo

### Parte A — Forzar layout vertical en imágenes flotantes (causa raíz del caos)

Nueva pasada `unfloatImagesForLinearLayout(xml)` que se ejecuta **antes** que `fitOversizedImagesString`:

Para cada `<w:drawing>` que contenga `<wp:anchor>`:

1. **Conservar tamaño y la imagen misma** (`<a:blip>`, `<wp:extent>`, `<a:srcRect>` si hay recorte real).
2. **Reescribir el contenedor**: cambiar `<wp:anchor ...>...</wp:anchor>` por `<wp:inline distT="0" distB="0" distL="0" distR="0">...</wp:inline>`, eliminando:
   - `<wp:positionH>`, `<wp:positionV>` (anclaje a página/párrafo)
   - `<wp:wrapSquare>`, `<wp:wrapTight>`, `<wp:wrapThrough>`, `<wp:wrapNone>`, `<wp:wrapTopAndBottom>` (todas las variantes de wrapping)
   - Atributos `behindDoc`, `simplePos`, `relativeHeight`, etc.
3. **Aislar la imagen en su propio párrafo**: si el `<w:drawing>` resultante está dentro de un `<w:p>` que también contiene texto, dividir ese párrafo en tres: texto antes / imagen sola / texto después. Así cada imagen ocupa su propia línea, sin que el texto la rodee.
4. Reportar en `changes[]`: "Se convirtieron N imagen(es) flotante(s) a layout en línea para evitar texto rodeando."

**Por qué no perdemos información visual**: el wrapping flotante en una guía/evaluación casi nunca es intencional — viene de pegar imágenes desde Internet o de otros documentos. La intención del autor es siempre "imagen debajo de la pregunta, opciones debajo de la imagen". Forzar `wp:inline` realiza exactamente esa intención.

**Excepción razonable**: si la imagen tiene `behindDoc="1"` (marca de agua / fondo) la dejamos intacta — esa sí es decorativa intencional. Heurística simple.

### Parte B — Reservar espacio vertical entre preguntas (que respiren sin amontonarse)

Ajustar `applyQuestionRhythm`:

| Elemento | spacing actual | spacing nuevo |
|---|---|---|
| Pregunta numerada (`1)`, `2)`...) | before 160, after 60 | **before 240, after 120** (12pt antes, 6pt después) |
| Opción (`a)`, `b)`...) | before 0, after 0 | before 0, after 40 (mantener pegadas pero sin solapar) |
| Párrafo con imagen inline (después de la conversión de Parte A) | (no se tocaba) | **before 80, after 80** (3pt antes y después: separa la imagen de pregunta y opciones sin alejarla) |

Detección del párrafo-con-imagen: si el `<w:p>` contiene `<w:drawing>` y nada de texto significativo (post-Parte A muchas imágenes están solas en su párrafo), aplicar el spacing de imagen.

### Parte C — Permitir un párrafo vacío como separador entre preguntas

`collapseBlankParagraphs` hoy colapsa **todas** las secuencias de párrafos vacíos a uno solo. Pero ese único párrafo sobreviviente recibe `spacing before=0 after=0 line=240`, así que mide ~10pt. Combinado con `applyQuestionRhythm` que ahora dará 12pt antes de cada pregunta, **eso es suficiente** para que se vea aireado pero no separado de más.

No hace falta cambiar `collapseBlankParagraphs`, pero sí asegurar que **no se ejecute dentro de tablas** (regiones donde colapsar rompe layout). Ya lo hace via `withProtectedRegions` parcialmente, pero las tablas no son regiones protegidas hoy. Agregar un filtro: no procesar párrafos vacíos que estén dentro de `<w:tc>` (celda).

### Parte D — Validar que las pasadas no rompan el XML

Después de la conversión flotante→inline, correr el validador `validateProcessedDocx` ya existente garantiza que si la reescritura genera XML inválido (por ejemplo un `<wp:inline>` sin namespace en algún archivo), el frontend lo detecta y avisa antes de descargar.

## Archivos a modificar

- **`src/lib/docx-processor.ts`**:
  - Nueva función `unfloatImagesForLinearLayout(xml): { xml: string; converted: number }`. Invocada en el pipeline justo antes de `fitOversizedImagesString`.
  - Helper `splitParagraphAroundDrawing(paragraphXml): string` para aislar imagen en su propio `<w:p>`.
  - Ajustar `applyQuestionRhythm`: spacings nuevos, detectar párrafos-con-imagen.
  - Ajustar `collapseBlankParagraphs`: excluir párrafos dentro de `<w:tc>`.
  - Reportar las nuevas acciones en `changes[]`.

## Resultado esperado

Tu archivo de Ciencias Naturales 1° Básico debería verse así después del proceso:

```text
1) ¿Cuál de estos animales tiene 4 patas?

   [mosca]  [perro]  [murciélago]

2) ¿Cuál de estos animales se desplaza con sus aletas?

   [caballito]  [ardilla]  [tortuga]

3) ¿Cuál de estos animales tiene escama?

   [leopardo]  [pez payaso]  [mariposa]

4) ¿Qué tienen en común el tiburón y el lagarto?
   a) Tienen pelos.
   b) Pueden volar.
   c) ...
```

Layout vertical limpio (como la imagen 2), con cada pregunta separada por un espacio cómodo de su anterior, las imágenes propias debajo, y las opciones pegadas a su pregunta.

