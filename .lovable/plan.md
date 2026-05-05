
## Estado actual

La columna `can_use_response_sheet` ya existe en la tabla `plans` y el toggle ya está en el PlansManager de admin. El hook `useUserUsage` ya expone `canUseResponseSheet`. Existe un `ResponseSheetDialog` que abre una ventana de impresión separada. **No se necesitan cambios en la base de datos.**

Lo que falta: integrar la hoja de respuestas como contenido inline al final de la evaluación (preview, PDF, DOCX), con un checkbox gated por plan.

---

## Plan de implementación

### 1. Crear `src/lib/response-sheet-html.ts` — Generador HTML inline

Nuevo archivo que genera el HTML de la hoja de respuestas para inyectar al final del assessment:
- Encabezado: Nombre del Estudiante, Curso, Fecha, recuadro Puntaje/Nota
- Cuerpo: lista numerada de burbujas (A/B/C/D para MC, V/F para true-false)
- Organización automática en 2-3 columnas según cantidad de preguntas
- CSS con `break-before: page` para que aparezca en página nueva al imprimir
- Exporta una función `renderResponseSheetHtml(assessment, institutionName): string`

### 2. Modificar `src/lib/assessment-render.tsx` — Inyectar al final del HTML

- Extender `RenderContext` con `includeResponseSheet?: boolean`
- En `renderAssessmentHtml()`, si `includeResponseSheet` es true, anexar el HTML de la hoja de respuestas al final (con `break-before: page`)
- El CSS de la hoja se agrega a `ASSESSMENT_CSS`

### 3. Modificar `src/lib/assessment-pdf.ts` — PDF incluye hoja automáticamente

Sin cambios adicionales necesarios: como `renderAssessmentHtml` ya incluirá la hoja cuando `includeResponseSheet: true`, el PDF la hereda automáticamente.

### 4. Modificar `src/lib/assessment-docx.ts` — Sección final en DOCX

- Al final de la generación del documento, si `includeResponseSheet` está activo, agregar una sección con page break que contenga:
  - Tabla de encabezado (Nombre, Curso, Fecha, Puntaje)
  - Tabla de burbujas organizada en columnas

### 5. Modificar `src/pages/CrearPrueba.tsx` — Checkbox gated + estado

- Agregar estado `includeResponseSheet` (boolean, default false)
- En la barra de herramientas de la pestaña preview, agregar un checkbox "Incluir Hoja de Respuestas":
  - Si `canUseResponseSheet` es true: checkbox funcional
  - Si es false: checkbox deshabilitado con icono de candado y tooltip "Disponible en Planes Superiores"
- Pasar `includeResponseSheet` al `RenderContext` que se usa en preview, PDF y DOCX
- Eliminar el botón separado de "Hoja de Respuestas" (reemplazado por el checkbox inline)

### 6. Ajustes al `PaginatedAssessmentPreview`

- La hoja de respuestas se renderizará como un bloque con `break-before: page`, por lo que el paginador la colocará automáticamente en una página nueva en el preview.

---

## Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `src/lib/response-sheet-html.ts` | Crear (generador HTML) |
| `src/lib/assessment-render.tsx` | Editar (inyectar hoja, extender RenderContext) |
| `src/lib/assessment-docx.ts` | Editar (sección DOCX al final) |
| `src/pages/CrearPrueba.tsx` | Editar (checkbox gated, pasar flag al contexto) |

No se requieren migraciones de base de datos.
