# Plan: Alineación curricular OA + generación de preguntas con IA

Implementaremos la integración con las Bases Curriculares de Chile (Objetivos de Aprendizaje, OA) y un generador de preguntas asistido por IA, manteniendo la arquitectura actual del proyecto (Vite + React + TS, Lovable Cloud, esquema único `Assessment`).

## 1. Base de datos curricular (mock inicial)

Nuevo archivo **`src/lib/curriculum-data.ts`**:

- Estructura indexada `Record<gradeValue, Record<subjectValue, OA[]>>` (claves alineadas con `DEFAULT_GRADES.value` y `DEFAULT_SUBJECTS.value` ya existentes en `catalog.ts`).
- Tipo:
  ```ts
  export interface OA {
    code: string;        // "OA 03"
    description: string; // texto oficial Mineduc
    eje?: string;        // eje temático (opcional)
  }
  ```
- Helper `getOAs(gradeValue, subjectValue): OA[]` con fallback a `[]`.
- Datos de muestra: 5 OAs reales por combinación para **Lenguaje** y **Matemática** en `5ºBásico` y `6ºBásico` (cobertura inicial; ampliable después). Ejemplos: OA 03 (Lenguaje 5º — comprensión de textos narrativos), OA 05 (Matemática 5º — multiplicación), etc.

## 2. Schema y formulario de metadatos

**`src/lib/assessment-schema.ts`**:
- Añadir `linkedOA: string[]` (array de `code`) a `AssessmentMeta`.
- Inicializar `linkedOA: []` en `emptyAssessment`.

**`src/components/test-builder/AssessmentMetaForm.tsx`**:
- Nuevo bloque **"Objetivos de Aprendizaje (OA)"** debajo de Curso/Asignatura.
- Lista filtrada dinámicamente con `getOAs(meta.gradeValue, meta.subjectValue)`.
- UI: lista de checkboxes con `<Checkbox>` de shadcn, mostrando `code — description` (truncado).
- Mensaje informativo si la combinación curso/asignatura aún no tiene OAs cargados.
- Al cambiar curso o asignatura: limpiar `linkedOA` automáticamente para evitar códigos huérfanos.

## 3. Generación con IA en el editor

**Nuevo edge function `supabase/functions/generate-question/index.ts`**:
- Recibe `{ oaCode, oaDescription, gradeLabel, subjectLabel, questionType }`.
- Llama a Lovable AI Gateway (`google/gemini-3-flash-preview` por defecto) usando **tool calling** para devolver JSON estricto que cumpla la interfaz `Question`:
  ```ts
  // tool schema (resumido)
  {
    name: "emit_question",
    parameters: { prompt, points, options?:[{text,correct}], statements?:[{text,answer,points}], answerLines? }
  }
  ```
- System prompt: rol de docente chileno, redacción acorde al curso, distractores plausibles, marcar 1 sola correcta en MC, 3-4 alternativas, español de Chile.
- Manejo explícito de 429 (rate limit) y 402 (sin créditos), reenviando mensaje al cliente.
- CORS estándar.

**Nuevo componente `src/components/test-builder/AIGenerateDialog.tsx`**:
- Dialog (shadcn) abierto desde `QuestionList`.
- Selector de OA (limitado a `meta.linkedOA`; aviso si está vacío y el usuario debe ir a "Datos").
- Selector de tipo de pregunta (multiple-choice / true-false / short-answer).
- Botón "Generar" → invoca la edge function con `supabase.functions.invoke('generate-question', ...)`.
- Al recibir respuesta: parte de `newQuestion(type)` (factory) y mezcla los campos generados; valida con guard rails (puntaje numérico, opciones array, etc.) antes de inyectar.
- Toasts de éxito/error.

**`src/components/test-builder/QuestionList.tsx`**:
- Botón **"Generar con IA"** (icono `Sparkles`) en la barra "Agregar:".
- Estado local que abre `AIGenerateDialog`; al confirmar, recibe el `Question` y hace `onChange([...questions, generated])`.
- Recibe `meta` por props (extender la interfaz) para conocer `linkedOA`, `gradeValue`, `subjectValue`.

**`src/pages/CrearPrueba.tsx`**:
- Pasar `meta` a `<QuestionList ... meta={assessment.meta} />`.

## 4. Exportación: incluir OAs en encabezado

**`src/lib/assessment-render.tsx`**:
- En el banner (debajo de Asignatura/Curso) añadir fila **"OA evaluados:"** con `meta.linkedOA.join(", ")` cuando no esté vacío.
- Solo se muestra el código (`OA 03, OA 05`) para no saturar el encabezado.

**`src/lib/assessment-docx.ts`**:
- Mismo agregado en la generación nativa: nuevo `Paragraph` o celda dentro de la tabla del banner con los códigos OA.
- Mantener fuente y tamaño consistentes con el resto del header.

## 5. Detalles técnicos

- **Sin migraciones SQL**: `linkedOA` viaja dentro del `jsonb` de `assessments.data`, no requiere cambio de tabla.
- **Retrocompatibilidad**: al cargar un assessment antiguo sin `linkedOA`, normalizar a `[]` en el effect que setea el state.
- **Validación IA**: pequeña función `coerceGeneratedQuestion(raw, type)` en `src/lib/assessment-ai.ts` que asegura forma válida y aplica `newId()` a todos los IDs.
- **Lovable AI**: usar el `LOVABLE_API_KEY` ya configurado (visible en secrets). Modelo por defecto `google/gemini-3-flash-preview`.
- **No tocar**: `client.ts`, `types.ts`, `supabase/config.toml` (la función desplegará con `verify_jwt = false` por default; la llamamos desde el cliente autenticado vía SDK).

## Archivos a crear / editar

**Crear:**
- `src/lib/curriculum-data.ts`
- `src/lib/assessment-ai.ts`
- `src/components/test-builder/AIGenerateDialog.tsx`
- `supabase/functions/generate-question/index.ts`

**Editar:**
- `src/lib/assessment-schema.ts` (campo `linkedOA`)
- `src/components/test-builder/AssessmentMetaForm.tsx` (selector OA)
- `src/components/test-builder/QuestionList.tsx` (botón IA + dialog)
- `src/pages/CrearPrueba.tsx` (pasa `meta` a QuestionList)
- `src/lib/assessment-render.tsx` (OA en header HTML/PDF)
- `src/lib/assessment-docx.ts` (OA en header docx)

¿Apruebas el plan?
