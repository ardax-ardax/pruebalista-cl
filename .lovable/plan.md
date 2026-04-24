## Objetivo

1. Permitir que el bloque informativo se muestre como **destacado** (estilo actual con fondo gris y barra lateral) o como **texto normal** (sin recuadro).
2. Agregar un **pie de página estandarizado** que aparezca en el preview, en el PDF y en el .docx.

---

## 1. Bloque informativo: variante normal vs. destacado

**Esquema** (`src/lib/assessment-schema.ts`)
- Agregar campo opcional `infoStyle?: "highlighted" | "plain"` en `Question` (default: `"highlighted"` para compatibilidad con bloques ya creados).

**Editor** (`src/components/test-builder/QuestionEditor.tsx`)
- En el bloque del tipo `info-block`, agregar un selector compacto (Switch o Select con dos opciones) sobre el textarea:
  - "Destacado (recuadro gris)"
  - "Texto normal"
- Setea `infoStyle` en la pregunta.

**Render HTML/Preview** (`src/lib/assessment-render.tsx`)
- Añadir clase CSS `.pa-info-block-plain` con: sin background, sin border, sin padding, sin italic, margen estándar (`margin: 6pt 0;`), justificado.
- En el render del `info-block`, elegir clase según `q.infoStyle`:
  - `"plain"` → `<div class="pa-info-block-plain">…</div>`
  - en otro caso → `<div class="pa-info-block">…</div>` (actual)

**DOCX** (`src/lib/assessment-docx.ts`)
- En el bloque `if (q.type === "info-block")`, si `infoStyle === "plain"`:
  - Generar un `Paragraph` justificado, sin `shading`, sin `border`, texto no italic, mismo `keepLines`/`keepNext` y spacing similar.
- En otro caso, mantener el render destacado actual.

---

## 2. Pie de página estandarizado

**Contenido del footer** (idéntico en preview, PDF y .docx):
- Línea superior fina (border-top) que separa del contenido.
- Texto centrado en una sola línea, tamaño 8pt, color gris/negro:
  - `{Nombre del colegio} · {Asignatura} · {Curso}  —  Página X de Y`
- Si no hay nombre de colegio configurado, omitir esa parte y conservar el resto.

**Preview / PDF** (`src/lib/assessment-render.tsx`)
- Agregar regla CSS `.pa-footer` (border-top 0.5pt, font-size 8pt, text-align center, padding-top 4pt, margin-top 12pt, color #444).
- En `renderAssessmentHtml`, agregar al final del `.pa-page` un `<div class="pa-footer">…</div>` con el texto. Para PDF la paginación X/Y se omite (el HTML→PDF actual no tiene contadores nativos); en su lugar mostrar solo el texto institucional.
  - Nota: si más adelante se quiere paginación real en PDF, requeriría un motor distinto. Por ahora el preview y el PDF muestran el footer "fijo" al pie del contenido.

**DOCX** (`src/lib/assessment-docx.ts`)
- Aprovechar el footer nativo de Word: en `sections[0]`, agregar la propiedad `footers: { default: new Footer({ children: [...] }) }`.
- El Footer contiene un único `Paragraph` centrado con:
  - `TextRun` con el texto institucional (`institutionName · subjectLabel · gradeLabel`), seguido de `  —  Página `, luego `PageNumber.CURRENT`, `" de "`, `PageNumber.TOTAL_PAGES` (usando `new TextRun` con `children: [PageNumber.CURRENT]`).
- Importar `Footer`, `PageNumber` desde `docx`.
- Tamaño 8pt (16 half-points), color "555555".

---

## Detalles técnicos

**Archivos a modificar**
- `src/lib/assessment-schema.ts` — campo `infoStyle`.
- `src/components/test-builder/QuestionEditor.tsx` — selector en info-block.
- `src/lib/assessment-render.tsx` — CSS + render condicional + footer HTML.
- `src/lib/assessment-docx.ts` — render condicional + footer nativo de Word.

**Compatibilidad**
- Bloques existentes sin `infoStyle` se renderizan como `"highlighted"` (comportamiento actual).
- El footer aparece automáticamente sin configuración adicional; usa los datos ya cargados en `RenderContext` / `BuildContext`.
