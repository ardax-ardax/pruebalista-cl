

# Mammoth no encuentra `<w:body>` en el archivo procesado: hay regex que están corrompiendo el XML

## Lo que muestra el error

El mensaje **"Could not find the body element: are you sure this is a docx file?"** lo lanza **mammoth.js**, no nuestro procesador. En `src/pages/Index.tsx`:

- Línea 219: mammoth corre sobre el **buffer original**, pero está envuelto en `.catch(() => ({ value: "" }))` → no puede mostrar este toast.
- Línea 223: mammoth corre sobre el **blob procesado**, sin try/catch propio → este es el que falla.

Eso significa: **una de nuestras pasadas de regex deja el `document.xml` malformado**. Mammoth abre el ZIP, encuentra `word/document.xml`, pero al parsearlo no puede ubicar un `<w:body>` válido (probablemente porque las etiquetas quedaron desbalanceadas).

## Causa probable en este archivo

Tres pasadas usan regex sobre `<w:p>...</w:p>` o `<w:r>...</w:r>` con cuantificadores `[\s\S]*?` no codiciosos:

- `forceDirectFontFormatting` (línea 930): `<w:r\b([^>]*)>([\s\S]*?)</w:r>`
- `applyParagraphFormattingString` (línea 985): `<w:p\b([^>]*)>([\s\S]*?)</w:p>`
- `normalizeNumbering` (línea 1508): `<w:p\b[^>]*>[\s\S]*?</w:p>`

Estas regex asumen que **`<w:p>` y `<w:r>` no se anidan**. En la realidad sí se anidan en estos casos:

1. **Cuadros de texto** (`<w:txbxContent>`): contiene `<w:p>` dentro de un `<w:r>` dentro del cuerpo.
2. **`<mc:AlternateContent>` / `<mc:Fallback>`**: reproduce un párrafo alternativo para versiones viejas de Word.
3. **Notas al pie embebidas inline**: idem.

Cuando el regex no codicioso `[\s\S]*?</w:p>` se encuentra una `<w:p>` anidada, **cierra en la `</w:p>` interior**, deja el `</w:p>` exterior huérfano, y a partir de ahí el resto del XML queda con etiquetas desbalanceadas. Mammoth no logra encontrar `<w:body>` y aborta.

Además, `forceDirectFontFormatting` (línea 970) usa un patrón **codicioso** `(<w:body\b[^>]*>)[\s\S]*(<\/w:body>)` que, al reescribir el body, si el contenido nuevo tiene tags huérfanos, propaga el daño.

## Plan en 3 partes

### Parte A — Detectar paragraphs/runs anidados antes de tocarlos

En `src/lib/docx-processor.ts`, antes de aplicar `forceDirectFontFormatting`, `applyParagraphFormattingString` y `normalizeNumbering`:

- **Saltar bloques que contienen anidamiento conocido**. Antes de cada pasada, "ocultar" temporalmente las regiones peligrosas reemplazándolas con un placeholder único (token aleatorio), correr la pasada sobre el resto, y restaurarlas al final.
- Regiones a aislar:
  - `<mc:AlternateContent>...</mc:AlternateContent>` (incluye `<mc:Choice>` y `<mc:Fallback>`).
  - `<w:txbxContent>...</w:txbxContent>` (cuadros de texto).
  - `<w:sdt>...</w:sdt>` (controles de contenido) — ya los detectamos en preflight, pero pueden pasar.
- Implementación: nueva utilidad `withProtectedRegions(xml, protectors, fn)` que:
  1. Reemplaza cada bloque con un token tipo `__LOV_PROTECTED_<uuid>__`.
  2. Llama `fn(maskedXml)`.
  3. Restaura los bloques exactamente como estaban.

Esto evita que cualquier regex `<w:p>...</w:p>` o `<w:r>...</w:r>` toque contenido anidado.

### Parte B — Validar el XML después de cada pasada y revertir si quedó malformado

En `runPass` (línea 196), agregar una verificación liviana **post-pasada**:

- Contar `<w:p` vs `</w:p>` y `<w:r` vs `</w:r>` y `<w:body` vs `</w:body>` antes y después.
- Si los conteos cambian de forma inesperada (delta de `<w:body>` ≠ 0, o delta de aperturas vs cierres aparece), **descartar el resultado de esa pasada** y mantener el XML previo, registrando un warning legible.
- Si el balance se rompe, también registrar el primer fragmento donde se ve el desbalance (~120 caracteres alrededor) para que el toast técnico tenga pista útil.

### Parte C — Pre-chequeo de mammoth y mensaje útil al usuario

En `src/pages/Index.tsx` línea 222–223:

- Envolver `mammoth.convertToHtml({ arrayBuffer: previewBuffer })` en su propio try/catch.
- Si mammoth falla con "Could not find the body element", **no abortar**: el `.docx` probablemente sigue siendo válido para Word (mammoth es más estricto). Mostrar:
  - Un warning amarillo en la tarjeta de Auto-QA: *"La previsualización HTML no se pudo generar (mammoth no soporta algunos elementos del documento), pero el `.docx` está listo para descargar y abrir en Word."*
  - Permitir igualmente la descarga del `.docx` (botón habilitado).
  - El comparador lado a lado mostrará la columna del procesado en blanco con un mensaje "No previsualizable, descarga el .docx para verlo en Word".

También extender el preflight (`validateDocxStructure`) para detectar `<w:txbxContent>` y `<mc:AlternateContent>` — ahora mismo solo detectamos `<w:sdt>`, SmartArt, VML, OLE y altChunk.

## Cambios técnicos resumidos

`src/lib/docx-processor.ts`:
- Nueva utilidad `withProtectedRegions` que enmascara bloques `<mc:AlternateContent>`, `<w:txbxContent>` y `<w:sdt>` con tokens, y los restaura.
- `forceDirectFontFormatting`, `applyParagraphFormattingString` y `normalizeNumbering` (las tres pasadas que iteran `<w:p>`/`<w:r>`) llaman a la utilidad.
- `runPass` valida balance de tags `<w:body>`, `<w:p>`, `<w:r>` post-pasada y revierte si está roto, agregando warning con fragmento del XML problemático.
- `validateDocxStructure` añade detección de `<w:txbxContent>` y `<mc:AlternateContent>` con `<mc:Fallback>` no trivial.

`src/pages/Index.tsx`:
- `processDocument` envuelve la conversión a HTML del procesado en try/catch.
- Si mammoth falla, deja `previewHtml = ""`, marca el documento como descargable igualmente, y agrega un warning a `diagnostics.warnings`.
- El step "ready" ya no requiere `previewHtml`; basta con tener `resultBlob`.

`src/components/DocumentPreview.tsx`:
- Si `processedHtml` está vacío, mostrar un placeholder explicando que la previsualización no está disponible pero el archivo es descargable.

## Resultado esperado

- En el archivo que el usuario subió, las regiones con cuadros de texto o `mc:AlternateContent` quedan protegidas: las pasadas no las tocan, no se rompe el XML, mammoth puede previsualizar.
- Si aún así mammoth no logra renderizar (porque tiene un elemento que mammoth simplemente no soporta para HTML, como un `<w:object>` complejo), la app **no se queda atascada**: el toast informa el caso y permite descargar el `.docx` corregido.
- En el diagnóstico Auto-QA, el usuario ve exactamente qué tipo de elemento causó el problema (text box, mc:AlternateContent, etc.) en lugar del mensaje genérico de mammoth.

