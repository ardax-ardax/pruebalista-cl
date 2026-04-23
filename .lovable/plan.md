

# Evitar cortes de bloque entre páginas

## Problema

Hoy en preview/PDF/DOCX un bloque de pregunta puede partirse: el título y enunciado quedan al final de una hoja y las opciones (o la imagen, o las afirmaciones V/F) saltan a la siguiente. También puede ocurrir que `info-block` (instrucciones de un texto) quede al final de hoja y la pregunta asociada caiga en la siguiente.

## 1) Preview web + PDF (`src/lib/assessment-render.tsx`)

El CSS ya tiene `.pa-question { page-break-inside: avoid; }`, pero es insuficiente:
- Falta la propiedad moderna `break-inside: avoid` (Chrome/Edge la usan al imprimir).
- `info-block` y `section-title` no tienen regla de "mantener junto con lo siguiente".
- El título del enunciado (`pa-question-title`) y su `pa-question-header` están fuera del wrapper `.pa-question` en algunos flujos.

**Cambios CSS en `ASSESSMENT_CSS`:**
```
.pa-question { break-inside: avoid; page-break-inside: avoid; }
.pa-question-title, .pa-question-header { break-after: avoid; page-break-after: avoid; }
.pa-info-block { break-inside: avoid; page-break-inside: avoid; break-after: avoid; page-break-after: avoid; }
.pa-section-title { break-after: avoid; page-break-after: avoid; }
.pa-options, .pa-statements, .pa-mc-split, .pa-image-wrap { break-inside: avoid; page-break-inside: avoid; }
```

Resultado: cada pregunta completa (título + enunciado + imagen + opciones/afirmaciones) viaja como una unidad. Si no entra en la página actual, salta entera. Un `info-block` tampoco se separa de la pregunta que lo sigue.

## 2) DOCX (`src/lib/assessment-docx.ts`)

En Word el equivalente es la propiedad `keepLines` (no partir el párrafo) y `keepNext` (mantener junto con el siguiente). Hoy esto no se está aplicando.

**Estrategia:** marcar todos los párrafos que componen una pregunta con `keepNext: true`, **excepto el último**, que lleva solo `keepLines: true`. Así Word trata el bloque como una unidad indivisible.

**Implementación dentro de `questionParagraphs(q, ...)`:**
- Recolectar los párrafos en un array `out` (ya se hace).
- Al final de la función, recorrer `out` y aplicar `keepNext: true` y `keepLines: true` a todos menos al último; al último solo `keepLines: true`.
- Para tablas (split layout), envolver con párrafos vacíos antes/después no funciona bien; en su lugar, marcar la fila de la tabla con `cantSplit: true` (propiedad de `TableRow` en docx-js) y al párrafo previo (header) con `keepNext: true`.

**Para `info-block`:** el párrafo del bloque informativo recibe `keepNext: true` para que no se separe de la pregunta siguiente.

**Para `section-title`:** mismo `keepNext: true` para que el título de sección no quede huérfano al final de hoja.

**Helper:** crear pequeña función `applyKeepTogether(paragraphs)` que itera y reemplaza cada `Paragraph` por uno equivalente con las propiedades `keepLines`/`keepNext` añadidas (docx-js no permite mutar; hay que reconstruir o pasar la propiedad al crear).

Mejor enfoque: **pasar las flags al construir** cada `Paragraph` dentro de `questionParagraphs`. Añadir a cada `new Paragraph({ ..., keepLines: true, keepNext: true })` y, después de generar todos los párrafos de la pregunta, sobrescribir el último para quitar `keepNext`. Para evitar reconstruir, se puede simplemente dejar `keepNext: true` en todos los párrafos internos de la pregunta y `keepNext: false, keepLines: true` en el último — esto se logra construyendo la lista y, en el último paso, usando `out[out.length-1]` regenerado con las flags correctas.

Más simple aún: construir todos los párrafos sin `keepNext`, y al final del `questionParagraphs` reconstruir cada uno usando un helper que clone con las flags. Dado que `Paragraph` no expone clonado, la solución limpia es **pasar las flags directamente en cada `new Paragraph(...)`** y aceptar que el último también lleve `keepNext: true` — el efecto secundario es que la pregunta tiende a pegarse a la siguiente, lo cual no es deseable.

**Solución final adoptada:** añadir un parámetro opcional `keepWithNext?: boolean` a cada `new Paragraph` durante la construcción, y al final marcar el último como `keepNext: false`. Para lograrlo sin reconstruir, los párrafos se crean con una función local `mkP(opts, isLast)` que decide las flags según `isLast`. Se reescribe `questionParagraphs` para usar `mkP` en cada push, calculando `isLast` con un patrón de "post-procesado": primero se acumulan descriptores `{opts}`, luego se mapean a `Paragraph` con las flags correctas.

## 3) Archivos a modificar

- `src/lib/assessment-render.tsx` — añadir reglas CSS de `break-inside`/`break-after` a `ASSESSMENT_CSS`.
- `src/lib/assessment-docx.ts` — refactor menor de `questionParagraphs` para aplicar `keepLines`/`keepNext`; marcar `TableRow` del split con `cantSplit: true`; `info-block` y `section-title` con `keepNext: true`.

## Resultado esperado

- En PDF (vía print) y en preview web, cada pregunta y su bloque de instrucciones asociado se mantienen en la misma página. Si no caben, saltan completos a la siguiente.
- En DOCX, Word respeta el mismo comportamiento gracias a `keepLines` + `keepNext` y `cantSplit` en filas de tabla.
- No se altera el contenido visual ni el layout: solo cambia el comportamiento ante saltos de página.

