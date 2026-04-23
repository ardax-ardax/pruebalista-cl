

# Detectar banner/títulos existentes y colapsar espacios entre preguntas

## Problema 1 — La app duplica el banner

Hoy `insertInstitutionBanner` (línea 1704 de `src/lib/docx-processor.ts`) **siempre** inyecta su tabla institucional justo después de `<w:body>`, sin revisar si el documento original ya tenía un encabezado equivalente. Si el archivo ya traía:

- Una tabla con logo + Profesor/Asignatura/Curso, o
- Un título tipo "EVALUACIÓN SUMATIVA Nº1 — CIENCIAS NATURALES — 2° BÁSICO"

el resultado queda con **dos versiones**: la del colegio recién insertada y la que ya tenía el archivo.

### Fix

Nueva función `detectExistingBanner(docContent)` que se ejecuta al inicio de `insertInstitutionBanner` y revisa solo los **primeros ~6 elementos** del `<w:body>` (suficiente para abarcar tabla + título de portada, sin tocar el resto del documento). Devuelve uno de tres veredictos:

| Veredicto | Heurística | Acción |
|---|---|---|
| `none` | No hay tabla en los primeros elementos y no hay texto con palabras clave de banner | Inyectar banner como hoy |
| `table-banner` | Hay un `<w:tbl>` en los primeros 3 elementos del body **y** su texto contiene 2 de estos: "profesor", "asignatura", "curso", "calificación", "puntaje", "fecha", "nombre" | **Reemplazar** esa tabla por la del colegio (preservando el logo si el original tenía un `<w:drawing>` y la plantilla no aporta uno propio) |
| `title-only` | Hay 1–4 párrafos al inicio cuyo texto contiene "evaluación", "guía", "prueba" + nombre de asignatura/curso, sin tabla previa | **Eliminar** esos párrafos de portada y poner el banner del colegio en su lugar |

Adicionalmente, después de insertar el banner, ejecutar una pasada `dedupeAdjacentTitles`: si los siguientes 3 párrafos al banner contienen texto que **ya aparece dentro del banner** (asignatura, curso, profesor, "EVALUACIÓN SUMATIVA"), eliminarlos. Esto cubre el caso en que el título flotante esté después de una tabla pre-existente.

Reportar la acción tomada en el `changes[]` del resultado: "Banner institucional reemplazó la portada existente del documento" o "Se eliminaron 3 párrafos de portada duplicada".

## Problema 2 — Demasiado espacio vertical entre preguntas

### Causa

`applyParagraphFormattingString` (línea 1473) aplica el mismo `<w:spacing w:before="..." w:after="..." w:line="..."/>` a **todos** los párrafos, incluyendo los **párrafos vacíos** (saltos de línea que el autor usó como separadores manuales). El archivo original tenía probablemente 1–2 párrafos vacíos entre cada pregunta. Después de la pasada cada uno mide:
- altura de línea (interlineado 1.15 × 10pt) +
- 6pt de spacing-after.

Multiplicado por 2 saltos × 20 preguntas = espacio enorme.

### Fix — pasada `collapseBlankParagraphs`

Nueva pasada que se ejecuta **después** de `applyParagraphFormattingString` y **antes** de `forceDirectFontFormatting`:

1. Identifica párrafos vacíos: aquellos cuyo `extractParagraphText(p).trim() === ""` y que **no** contienen `<w:drawing>`, `<w:tbl>`, `<w:pict>`, ni `<w:sectPr>` (estos no se tocan).
2. **Colapsa secuencias**: si hay N párrafos vacíos consecutivos, deja solo **uno** (preserva el primero, elimina el resto).
3. **Reduce su spacing**: al párrafo vacío sobreviviente le aplica `<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>` (sencillo, sin extra). Así un salto en blanco mide solo el alto natural de una línea, sin sumar paragraphSpacing.
4. Excluir de la pasada los párrafos vacíos que estén dentro de regiones protegidas (`mc:AlternateContent`, text boxes) usando `withProtectedRegions`.

Reportar en `changes[]`: "Se colapsaron N líneas en blanco entre preguntas para mejorar la densidad."

### Fix complementario — espaciado por defecto del cuerpo

Para evitar que un futuro archivo "muy aireado" siga viéndose espaciado aunque no tenga párrafos vacíos: revisar las plantillas `Ev_Sumativa` / `Ev_Formativa_Formal` / `Guia_Portafolio` en `src/lib/templates.ts`. Hoy `paragraphSpacingAfter: 6`. Lo dejamos en 6 (útil para separar preguntas), pero `paragraphSpacingBefore: 0` (ya está). Sin cambios aquí — el problema real son los párrafos vacíos.

### Fix opcional para preguntas numeradas

Detectar párrafos cuyo texto empieza con `^\s*\d+[\)\.]` (es una pregunta) y aplicar `<w:spacing w:before="120" w:after="60"/>` (6pt antes, 3pt después) en lugar del genérico. Las opciones (a/b/c/d) reciben `<w:spacing w:before="0" w:after="0"/>`. Esto da un ritmo visual: pregunta separada del bloque anterior, opciones pegadas a su pregunta. Activarlo solo si la plantilla tiene `fileNaming.prefix` que comience con `Ev_` (es una evaluación).

## Archivos a modificar

- **`src/lib/docx-processor.ts`**:
  - Nueva `detectExistingBanner(docContent): "none" | "table-banner" | "title-only"` y nuevas utilidades `removeFirstBodyTable`, `removeCoverParagraphs`, `dedupeAdjacentTitles`.
  - `insertInstitutionBanner`: invocar la detección y elegir entre insertar / reemplazar / limpiar antes de inyectar.
  - Nueva pasada `collapseBlankParagraphs(xml, t)` invocada en el pipeline de `applyTemplate` después de `applyParagraphFormattingString`.
  - Nueva pasada `applyQuestionRhythm(xml, t)` (opcional, activa solo para evaluaciones) invocada después de `collapseBlankParagraphs`.
  - Reportar las acciones en `changes[]`.

## Resultado esperado

- Si subes un archivo que ya tenía banner/portada, el de la app **lo reemplaza** en lugar de agregarse encima. Si solo tenía un título tipo "EVALUACIÓN SUMATIVA…", se elimina y queda solo el banner institucional.
- Las líneas en blanco entre preguntas se colapsan a una sola y sin spacingAfter, recuperando varias líneas de espacio por página.
- Si la plantilla es de evaluación, las preguntas reciben un ritmo visual propio (pregunta separada, opciones pegadas).

