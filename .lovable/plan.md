
# Plan: Banco de Preguntas Institucional

## Resumen

Implementar un banco de preguntas institucional donde la UTP puede destacar preguntas para compartirlas (anónimamente) con docentes del mismo colegio. Las preguntas importadas del banco institucional son de solo lectura.

## Cambios

### 1. Migración de Base de Datos

Agregar columna `is_public_institution` (boolean, default false) a `question_bank`. Crear índice parcial para queries eficientes. Agregar política RLS para que staff pueda actualizar el flag en preguntas de su colegio.

### 2. Schema (`src/lib/assessment-schema.ts`)

Agregar campo opcional `readOnly?: boolean` a la interfaz `Question` para marcar preguntas importadas del banco institucional.

### 3. Funciones de Banco (`src/lib/question-bank.ts`)

- Agregar función `searchInstitutionalBank(filters)` que consulta preguntas con `is_public_institution = true` del mismo colegio del usuario actual (via join con profiles), excluyendo `user_id` del resultado.
- Agregar función `togglePublicInstitution(questionId, value)` para que UTP active/desactive el flag.

### 4. UTP Review Center (`src/components/admin/UtpReviewCenter.tsx`)

En el diálogo de revisión, cuando la evaluación está aprobada, mostrar las preguntas individuales con un switch "Destacar en Banco Institucional" junto a cada una. Al activar/desactivar el switch, llamar `togglePublicInstitution`.

### 5. Question Bank Dialog (`src/components/test-builder/QuestionBankDialog.tsx`)

Agregar tabs "Mis Preguntas" y "Banco del Colegio":
- **Mis Preguntas**: funcionalidad actual sin cambios.
- **Banco del Colegio**: llama a `searchInstitutionalBank`, oculta autor, filtra por grado y OA. Al importar, marca las preguntas con `readOnly: true`.

### 6. QuestionEditor (`src/components/test-builder/QuestionEditor.tsx`)

Si `question.readOnly === true`:
- Ocultar botones de Editar, Duplicar, mover arriba/abajo.
- Mostrar solo el botón Eliminar (de la prueba actual).
- Renderizar el contenido en modo vista (campos deshabilitados o solo texto).

### 7. Seguridad

- La query institucional filtra por `colegio_id` del usuario via join con profiles, garantizando aislamiento entre colegios.
- El campo `user_id` no se expone en la UI del banco institucional (anonimato).
- Solo staff puede modificar `is_public_institution` (política RLS).

## Detalle técnico

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/...` | ALTER TABLE + índice + RLS policy |
| `src/lib/assessment-schema.ts` | `readOnly?: boolean` en Question |
| `src/lib/question-bank.ts` | `searchInstitutionalBank()`, `togglePublicInstitution()` |
| `src/components/admin/UtpReviewCenter.tsx` | Switch por pregunta en diálogo de revisión |
| `src/components/test-builder/QuestionBankDialog.tsx` | Tab "Banco del Colegio" |
| `src/components/test-builder/QuestionEditor.tsx` | Modo readOnly |
