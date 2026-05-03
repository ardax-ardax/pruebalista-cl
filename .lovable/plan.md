# Plan completado

## Cambios implementados

1. **Créditos visibles en generación IA** — `AIGenerateDialog` muestra créditos disponibles, deshabilita si 0, y refresca tras generar.
2. **Preview paginación corregida** — `PaginatedAssessmentPreview` ahora descompone `.pa-content` en bloques individuales para paginar correctamente.
3. **Guardado con indicador y protección de navegación** — Indicador permanente de estado (Al día / Sin guardar / Guardando / Error), `beforeunload` y `useBlocker` con diálogo de confirmación.
4. **Banco de preguntas con detalle expandible** — Cada pregunta se puede expandir para ver enunciado completo, alternativas con correcta marcada, afirmaciones V/F, y metadata.
