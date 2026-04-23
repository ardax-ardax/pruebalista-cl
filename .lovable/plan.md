

# Reiniciar numeración por sección + instrucciones bajo título de sección

## Cambios

### 1) Numeración reinicia tras `section-title`

**`src/components/test-builder/QuestionList.tsx`** — `visibleNumber(qs, i)`: contar solo desde el último `section-title` previo (inclusive el inicio). Recorrer de `0` a `i`, reiniciar `n = 0` cada vez que se encuentre un `section-title`, e incrementar para cualquier item contado posterior.

**`src/lib/assessment-render.tsx`** — En el `.map` que arma `questionsHtml`, cuando `q.type === "section-title"` setear `qNum = 0` antes de devolver el bloque. Lo mismo aplicar a `renderQuestionNumber()` (usado externamente).

**`src/lib/assessment-docx.ts`** — En el bucle `for (const q of assessment.questions)` (línea ~512), si `q.type === "section-title"` resetear `qN = 0`.

Esto hace que cada sección numere desde 1 en preview, PDF y Word.

### 2) Instrucciones opcionales bajo el título de sección

**`src/lib/assessment-schema.ts`** — Reutilizar el campo existente `Question.title` para el título corto y `Question.prompt` para las instrucciones del bloque. Es decir, para `section-title`:
- `prompt` → título de la sección (ya existe)
- agregar uso de `instructions?: string` como **nuevo campo opcional** en `Question` (más limpio que reutilizar `title`, que ya tiene otro uso semántico).

**`src/components/test-builder/QuestionEditor.tsx`** — Cuando `question.type === "section-title"`, además del Input del título, mostrar un `Textarea` opcional debajo con placeholder "Instrucciones de la sección (opcional)", enlazado a `question.instructions`.

**`src/lib/assessment-render.tsx`** — En el branch `section-title`, si `q.instructions` existe, renderizar después del título un `<div class="pa-section-instructions">…</div>`. Agregar regla CSS:
```css
.pa-section-instructions { font-size: 10pt; font-style: italic; margin: 2pt 0 8pt; break-after: avoid; page-break-after: avoid; }
```

**`src/lib/assessment-docx.ts`** — En el branch `section-title`, si hay `q.instructions`, devolver un segundo `Paragraph` con `italics: true`, `keepNext: true`, mismo tamaño base.

## Resultado

- Tras agregar una sección, la siguiente pregunta numerada empieza en **1** (en editor, preview, PDF y Word).
- El título de sección permite añadir un texto en cursiva debajo, útil para instrucciones específicas del ítem.

