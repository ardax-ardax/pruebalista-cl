

# Enunciado sin negrita + mini editor de texto enriquecido

## Problema

Hoy el enunciado de cada pregunta se imprime entero en negrita (la regla CSS `.pa-question-header { font-weight: bold }` afecta todo el texto, no solo el número). Tampoco hay forma de destacar palabras dentro del enunciado.

## Solución

1. **Quitar negrita global** del enunciado: solo el número `N)` y el puntaje quedan en negrita; el texto del enunciado va en peso normal.
2. **Convertir el campo `prompt`** en un editor de texto enriquecido **mínimo** (negrita, cursiva, subrayado) que guarda HTML simple. Aplica solo al `prompt` de preguntas contables (`multiple-choice`, `true-false`, `short-answer`). El título del enunciado y el resto de campos siguen siendo texto plano.

## 1) Schema (`src/lib/assessment-schema.ts`)

- Sin cambio de tipos: `prompt` sigue siendo `string`. Pasa a contener HTML reducido (subset permitido: `<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<br>`).
- Compatibilidad: textos planos antiguos siguen renderizándose tal cual (no se escapan los caracteres ya válidos; ver siguiente punto).

## 2) Sanitización (`src/lib/assessment-render.tsx` y `assessment-docx.ts`)

Crear helper `sanitizeRichText(s: string): string` en un nuevo archivo `src/lib/rich-text.ts`:
- Acepta solo tags de la whitelist: `b, strong, i, em, u, br`. Cualquier otro tag y atributo se elimina.
- Escapa el resto del texto para evitar XSS.
- Retorna HTML seguro para inyectar.

Helper adicional `richTextToRuns(html: string, baseStyle): TextRun[]` para DOCX:
- Parsea el HTML mínimo y produce un array de `TextRun` con flags `bold`, `italics`, `underline` según los tags activos.
- `<br>` produce un `TextRun({ break: 1 })`.

## 3) Mini editor (`src/components/test-builder/RichTextInput.tsx` — nuevo)

Componente ligero basado en `contenteditable` (sin librerías externas):
- Toolbar con 4 botones: **B**, *I*, U, "limpiar formato". Cada uno usa `document.execCommand('bold' | 'italic' | 'underline' | 'removeFormat')`.
- `<div contenteditable="true">` con clases tailwind para verse igual que un `Textarea` (mismo borde, padding, focus ring).
- `onInput` extrae `innerHTML`, lo pasa por `sanitizeRichText`, y dispara `onChange(html)`.
- Soporta `placeholder` con un `:empty::before { content: attr(data-placeholder) }`.
- Acepta `value` (HTML) y monta el contenido inicial; preserva la posición del cursor durante edición (no reinicializa el DOM si `value` no cambió externamente).
- Props: `{ value, onChange, placeholder, rows?: number }`.

## 4) Editor de pregunta (`src/components/test-builder/QuestionEditor.tsx`)

- Reemplazar el `Textarea` del campo "Enunciado" (líneas 119–123) por `<RichTextInput value={question.prompt} onChange={(html) => update({ prompt: html })} placeholder="..." rows={3} />`.
- El resto del editor (título, opciones, afirmaciones V/F, etc.) **no cambia** — siguen siendo texto plano. (Si más adelante se quiere extender a opciones, es trivial.)

## 5) Renderer web/PDF (`src/lib/assessment-render.tsx`)

**CSS:**
- `.pa-question-header { font-weight: normal; ... }` (quitar `bold` global).
- Nueva clase `.pa-question-number { font-weight: bold; }` para el `N)`.
- `.pa-question-points { font-weight: normal; ... }` (ya estaba).
- El texto del enunciado mantiene `b/strong/i/em/u` que respetan el peso/estilo solo en las palabras marcadas.

**HTML:**
- Línea 153: cambiar `${escape(q.prompt)}` por `${sanitizeRichText(q.prompt)}` y envolver el número:
  ```
  <div class="pa-question-header">${pts}<span class="pa-question-number">${qNum})</span> ${sanitizeRichText(q.prompt)}</div>
  ```

## 6) DOCX (`src/lib/assessment-docx.ts`)

En la construcción de `headerRuns` (línea 267):
- Mantener `new TextRun({ text: ${qNumber}), bold: true, size: baseSize })` para el número.
- Reemplazar el `TextRun` plano del prompt por `...richTextToRuns(q.prompt, { size: baseSize, bold: false })` que expande a múltiples `TextRun` con los formatos correspondientes.
- Para `info-block` (línea 249) **no aplicar** rich text — sigue siendo texto plano (ya que el editor del bloque informativo es un Textarea simple). Si se quiere extender en el futuro, se reusa el mismo helper.

## 7) Migración

- Borradores existentes con `prompt` en texto plano siguen renderizándose: `sanitizeRichText` deja el texto como está (escapando `<`, `>`, `&`).
- Si el texto antiguo contiene caracteres `<` literales, ahora se escapan correctamente — no se rompe nada.

## Archivos a crear/modificar

- **Crear** `src/lib/rich-text.ts` — helpers `sanitizeRichText` y `richTextToRuns`.
- **Crear** `src/components/test-builder/RichTextInput.tsx` — editor `contenteditable` con toolbar B/I/U.
- **Modificar** `src/components/test-builder/QuestionEditor.tsx` — usar `RichTextInput` para el campo enunciado.
- **Modificar** `src/lib/assessment-render.tsx` — quitar bold global, separar `.pa-question-number`, inyectar HTML sanitizado.
- **Modificar** `src/lib/assessment-docx.ts` — usar `richTextToRuns` para el prompt en `headerRuns`.

## Resultado esperado

- El enunciado se ve en peso normal; el número de pregunta y el puntaje se mantienen en negrita.
- El docente puede seleccionar palabras dentro del enunciado y aplicar **negrita**, *cursiva* o subrayado con la toolbar.
- El énfasis aparece idéntico en preview, PDF y DOCX.
- Sin librerías externas; el editor pesa unos pocos KB.

