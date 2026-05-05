
## Plan: Hoja de Respuestas Básica

### 1. Base de datos
- Migración: agregar columna `can_use_response_sheet boolean NOT NULL DEFAULT false` a la tabla `plans`.

### 2. Tipos y hooks
- **`usePlans.tsx`**: Agregar `can_use_response_sheet` al interface `Plan` y al `DEFAULT_PLAN_LIMITS`.
- **`useUserUsage.tsx`**: Agregar `canUseResponseSheet` al interface `UserUsage`, derivado del plan efectivo.

### 3. Panel Admin (PlansManager)
- Agregar un Switch "Hoja de Respuestas" en el diálogo de edición de plan (junto a los otros toggles como OMR, docx, etc.).
- Incluir `can_use_response_sheet` en el objeto que se guarda/inserta.

### 4. Página CrearPrueba
- Extraer `canUseResponseSheet` de `useUserUsage()`.
- Agregar estado `responseSheetOpen` y un botón "Hoja de Respuestas" en la barra de acciones (visible solo si `canUseResponseSheet === true` y hay preguntas de selección múltiple o V/F).
- Crear un diálogo `ResponseSheetDialog` que permita imprimir la hoja.

### 5. Componente ResponseSheetDialog + generación visual
- Nuevo archivo `src/components/response-sheet/ResponseSheetDialog.tsx`.
- Recibe la evaluación (assessment) y genera una grilla de respuestas.
- Diseño:
  - Encabezado: Nombre del Estudiante, Curso, Fecha (campos en blanco para rellenar a mano).
  - Grilla multi-columna (3-4 columnas) con formato `1. A B C D` para cada pregunta de selección múltiple, y `1. V F` para verdadero/falso.
  - Solo incluye preguntas evaluables (excluye section-title, info-block, short-answer).
  - Abre ventana de impresión (mismo patrón que `exportAssessmentToPdf`).

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| (migración SQL) | Nueva columna `can_use_response_sheet` |
| `src/hooks/usePlans.tsx` | Agregar campo al interface y default |
| `src/hooks/useUserUsage.tsx` | Exponer `canUseResponseSheet` |
| `src/components/admin/PlansManager.tsx` | Switch en diálogo + campo en save |
| `src/pages/CrearPrueba.tsx` | Botón + estado + diálogo |
| `src/components/response-sheet/ResponseSheetDialog.tsx` | Nuevo componente |
