

# Diagnóstico del archivo + endurecer el procesador para tolerar este caso

## Lo que muestra tu archivo

Inspeccioné el `.docx` que subiste (Ciencias Naturales 2° Básico). El documento es válido — no tiene elementos exóticos como SmartArt, controles de formulario ni text boxes flotantes. Pero sí tiene tres patrones que hoy hacen al procesador frágil:

1. **Imágenes reutilizadas en varias celdas**: las imágenes de animales (mosca/perro/murciélago, etc.) usan la misma referencia interna (`r:embed` repetido). Cuando una pasada toca `<w:drawing>` y ya pasó por uno, el siguiente puede quedar sin contexto válido.
2. **Listas con doble numeración**: hay párrafos con `<w:numPr>` nativo Y además texto plano `1)`, `2)` al inicio (se ve en el parse como `* 1) Identifica...`). La pasada `normalizeNumbering` actual asume uno u otro, no los dos juntos.
3. **Tablas pegadas entre sí sin párrafo separador**: `</w:tbl>` seguido directamente de `<w:p>` con texto `2) ¿Cuál...` — Word lo permite, pero algunas regex de normalización de párrafos esperan separación.

Cuando el procesador falla por cualquiera de estos casos, el mensaje genérico **"El documento contiene elementos avanzados…"** se dispara desde `src/pages/Index.tsx` (línea 165) porque el filtro de error solo distingue entre dos categorías muy amplias (`/body element|docx/i`). No te dice realmente qué elemento falló.

## Plan en 2 partes

### Parte A — Mensaje de error útil (no más "elementos avanzados" genérico)

`src/pages/Index.tsx`:
- Reemplazar el toast genérico por uno que muestre **qué pasada falló** y **qué elemento la rompió** (nombre de la función + tag XML problemático).
- Agregar un botón "Copiar detalle técnico" en el toast para que puedas pegármelo si vuelve a fallar.

`src/lib/docx-processor.ts`:
- Envolver cada pasada (`normalizeNumbering`, `forceDirectFontFormatting`, `fitOversizedImagesString`, `optimizeTablesString`, banner, etc.) en `try/catch` individual.
- Si una pasada falla, registrar el error en `diagnostics.warnings` con el nombre de la pasada y **continuar con el resto en lugar de abortar todo el documento**.
- Solo abortar si falla algo crítico (lectura del ZIP, escritura del blob).

### Parte B — Tolerancia para los 3 patrones detectados

`src/lib/docx-processor.ts`:

1. **Imágenes con `r:embed` repetido**:
   - En `fitOversizedImagesString`, dejar de procesar cada `<w:drawing>` de forma independiente. En su lugar, agrupar por `r:embed` y aplicar el ajuste una sola vez por imagen única.
   - Si un drawing no tiene transform completo, saltarlo en silencio (warning, no error).

2. **Listas con doble numeración (numPr nativo + texto plano "1)")**:
   - Detectar el patrón: párrafo con `<w:numPr>` cuyo primer `<w:t>` empieza con `\d+\)` o `[a-z]\)`.
   - Resolución segura: **eliminar la numeración manual del texto**, dejar solo la nativa (porque ésa Word ya la pinta visualmente). Esto evita ver `1) 1) Identifica…` después de la normalización.
   - Reportar en `autoFixesApplied`: "Se eliminó numeración manual duplicada en N párrafos".

3. **Tablas adyacentes sin separador**:
   - En la pasada de banner / formato de párrafos, no asumir que cada `<w:tbl>` está rodeado de `<w:p>`. Usar selector que tolere `<w:tbl>` consecutivos.

### Parte C — Validación previa del .docx (al subir)

Antes de invocar `applyTemplate`, hacer un check rápido:
- Verificar que el ZIP contiene `word/document.xml` y `[Content_Types].xml`.
- Detectar si es un `.doc` renombrado (firma binaria `D0CF11E0` en lugar de `PK`).
- Detectar elementos no soportados explícitamente: `<w:sdt>` (controles de contenido), `<mc:AlternateContent>` con fallback de SmartArt, `<v:shape>` (VML legacy).
- Mostrar un diálogo previo **antes de procesar** con la lista exacta de elementos riesgosos: "Tu documento contiene 3 controles de contenido y 2 SmartArt. La estandarización puede dejarlos sin formato. ¿Continuar?"

## Cambios técnicos resumidos

- `src/lib/docx-processor.ts`:
  - Nueva función `validateDocxStructure(zip)` que se ejecuta primero.
  - Cada pasada envuelta en `try/catch` con registro en `diagnostics.warnings`.
  - `fitOversizedImagesString`: agrupar por `r:embed`.
  - `normalizeNumbering`: detectar y limpiar numeración manual duplicada en párrafos con `<w:numPr>`.

- `src/pages/Index.tsx`:
  - Mostrar el detalle real del error (no mensaje genérico).
  - Si `validateDocxStructure` reporta elementos riesgosos, abrir un `AlertDialog` de confirmación antes de procesar.

- `src/components/PreflightDialog.tsx` (nuevo):
  - Diálogo modal que lista los elementos detectados en el .docx y pregunta si seguir.

## Resultado esperado con tu archivo

- El archivo de Ciencias Naturales 2° Básico se procesará completo, sin caer al fallback genérico.
- Las imágenes reutilizadas en las tablas de la página 2 se mantendrán visibles sin reescalado erróneo.
- Los párrafos `* 1) Identifica…` saldrán como `1) Identifica…` (una sola numeración).
- Si otro archivo tuyo trae algo realmente no soportado, el toast te dirá exactamente qué pasada falló y en qué elemento, en lugar de "elementos avanzados".

