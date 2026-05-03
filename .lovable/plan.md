
## Problemas y soluciones

### 1. Créditos no visibles al generar preguntas con IA

**Problema**: El diálogo de generación IA (`AIGenerateDialog.tsx`) no muestra cuántos créditos tiene el docente ni indica que se descuenta uno por pregunta generada.

**Solución**: Pasar `creditsAvailable` y `effectivePlan` como props al `AIGenerateDialog`. Mostrar un texto informativo tipo "Créditos disponibles: X" y tras generar, llamar `refreshUsage()` para actualizar el contador. Si los créditos son 0, deshabilitar el botón de generar con mensaje explicativo.

---

### 2. Preview: preguntas se mueven todas a la segunda hoja

**Problema**: En `PaginatedAssessmentPreview.tsx`, la medición de bloques para paginación usa `getBoundingClientRect()` sobre un contenedor oculto cuyo ancho es `geom.usableWidthPx`. Si el encabezado del template (logo, nombre, datos) ocupa espacio pero no se contabiliza en la primera página, todos los bloques de contenido "no caben" y se desplazan a la página 2. Además, el contenedor de medición solo tiene el ancho de contenido útil pero el render real incluye paddings, lo que puede causar diferencias en el cálculo de alturas.

**Solución**: Revisar la lógica de paginación para que el encabezado se incluya como parte del contenido de la primera página (restando su altura del espacio disponible). Asegurar que el contenedor de medición replica fielmente las condiciones del render final (mismo ancho, mismos estilos). Si el encabezado es generado por `renderAssessmentHtml`, verificar que sus bloques hijo se midan correctamente.

---

### 3. Sin aviso al cambiar de página con cambios sin guardar

**Problema**: No existe ningún mecanismo que avise al docente cuando navega fuera de la página de edición con cambios pendientes. El autosave actual solo funciona para pruebas ya guardadas en la nube (`editingId`); para pruebas nuevas solo guarda en localStorage.

**Solución**:
- Agregar un indicador visual permanente del estado de guardado (ya existe parcialmente con `saveStatus`, pero solo aparece brevemente).
- Implementar `beforeunload` para el navegador (cierre de pestaña).
- Usar `useBlocker` de react-router para interceptar la navegación interna y mostrar un diálogo de confirmación cuando hay cambios sin guardar.
- Hacer el indicador de guardado siempre visible: icono de nube con estado (guardado/pendiente/error).

---

### 4. Banco de preguntas: no se ven preguntas completas ni alternativas

**Problema**: En `QuestionBankDialog.tsx`, cada pregunta se muestra con `truncate` (una línea truncada) y solo el `prompt_preview` (máximo 120 caracteres). No se ven las alternativas, enunciado completo, ni datos de V/F.

**Solución**: Agregar un panel de detalle expandible (acordeón o panel lateral) dentro del diálogo. Al hacer clic en una pregunta (o un botón "Ver"), se expande para mostrar:
- Enunciado completo (`question_data.prompt`)
- Alternativas con indicador de correcta (para selección múltiple)
- Afirmaciones V/F (para verdadero/falso)
- Líneas de respuesta (para desarrollo)
- Dificultad y OA asociado

Se quita el `truncate` del prompt y se permite ver el texto completo.

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/components/test-builder/AIGenerateDialog.tsx` | Recibir props de créditos, mostrar contador, deshabilitar si créditos = 0, callback para refresh |
| `src/pages/CrearPrueba.tsx` | Pasar créditos al AIGenerateDialog, agregar `useBlocker` + `beforeunload`, indicador de guardado persistente |
| `src/components/test-builder/PaginatedAssessmentPreview.tsx` | Corregir medición de bloques para incluir encabezado en primera página |
| `src/components/test-builder/QuestionBankDialog.tsx` | Agregar vista expandida de preguntas con enunciado completo y alternativas |

No se requieren migraciones de base de datos.
