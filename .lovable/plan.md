
## Pauta de Corrección — Plan de implementación

### 1. Base de datos: nueva columna `can_use_answer_key`

Migración SQL:
```sql
ALTER TABLE plans ADD COLUMN can_use_answer_key boolean NOT NULL DEFAULT false;
```

### 2. PlansManager (Admin) — toggle

En `src/components/admin/PlansManager.tsx`:
- Agregar `can_use_answer_key` al `emptyPlan`, al objeto `row` en `handleSave`, y al `SortableRow` si corresponde.
- Agregar un toggle "Pauta de Corrección" debajo del toggle de "Hoja de Respuestas Básica".

### 3. Hooks: exponer `canUseAnswerKey`

- **`usePlans.tsx`**: Agregar `can_use_answer_key: boolean` a la interfaz `Plan` y al `DEFAULT_PLAN_LIMITS`.
- **`useUserUsage.tsx`**: Agregar `canUseAnswerKey: boolean` a `UserUsage`, `DEFAULT_USAGE`, y al cálculo derivado.

### 4. Crear `src/lib/answer-key-html.ts` — Generador HTML

Nueva función `renderAnswerKeyHtml(ctx: RenderContext)` que genera HTML con:
- **Mismo encabezado institucional** que la evaluación (reutilizando el banner de `renderAssessmentHtml`): logo, nombre institución, profesor, asignatura, curso, fecha.
- **Título central**: "Pauta de Corrección / Solucionario".
- **Contenido por tipo de pregunta**:
  - Selección múltiple: `N. [X] Letra — Texto de la opción correcta`, organizado en columnas si hay muchas.
  - Verdadero/Falso: `N. V/F — Texto de la afirmación`.
  - Desarrollo (short-answer): `N. [Criterios]` mostrando `rubric` o `rubricExplanation`.
- **CSS**: `break-before: page` para página nueva.
- Exporta también `ANSWER_KEY_CSS`.

### 5. Modificar `src/lib/assessment-render.tsx`

- Extender `RenderContext` con `includeAnswerKey?: boolean`.
- Importar `renderAnswerKeyHtml` y `ANSWER_KEY_CSS`.
- En `renderAssessmentHtml()`, si `includeAnswerKey` es true, anexar el HTML de la pauta después del response sheet (si existe).
- Agregar `ANSWER_KEY_CSS` a `ASSESSMENT_CSS`.

### 6. Modificar `src/lib/assessment-docx.ts`

- Extender `BuildContext` con `includeAnswerKey?: boolean`.
- Crear `buildAnswerKeySection(ctx)` que genera una sección DOCX con:
  - Mismo banner institucional (reutilizando `bannerTable`).
  - Título "Pauta de Corrección / Solucionario".
  - Tabla con respuestas correctas por tipo de pregunta, organizada en columnas.
- Agregar la sección al array de secciones del documento.

### 7. Modificar `src/pages/CrearPrueba.tsx`

- Agregar estado `includeAnswerKey` (boolean, default false).
- En la barra de preview, agregar checkbox "Pauta de Corrección" con gating idéntico al de Hoja de Respuestas:
  - Activo si `canUseAnswerKey` es true.
  - Deshabilitado con icono de candado si es false.
- Pasar `includeAnswerKey` al `RenderContext`.

### Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| Migración SQL | Crear (`can_use_answer_key` en `plans`) |
| `src/lib/answer-key-html.ts` | Crear (generador HTML) |
| `src/hooks/usePlans.tsx` | Editar (interfaz Plan) |
| `src/hooks/useUserUsage.tsx` | Editar (exponer canUseAnswerKey) |
| `src/components/admin/PlansManager.tsx` | Editar (toggle + emptyPlan + save) |
| `src/lib/assessment-render.tsx` | Editar (inyectar pauta, extender RenderContext) |
| `src/lib/assessment-docx.ts` | Editar (sección DOCX) |
| `src/pages/CrearPrueba.tsx` | Editar (checkbox gated, estado, pasar flag) |
