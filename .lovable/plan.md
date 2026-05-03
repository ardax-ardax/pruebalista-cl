
## Problemas y soluciones

### 1. Créditos muestran 20 brevemente al cambiar de página

**Causa**: El hook `useUserUsage` inicializa el estado con `creditsAvailable: 20` (valor por defecto). Al navegar, el componente se monta, muestra 20 y luego la consulta a la base de datos devuelve el valor real.

**Solución**: No mostrar el badge de créditos mientras el hook está en estado `loading`. En `AppLayout.tsx`, agregar la condición `!usageLoading` antes de renderizar los badges de créditos/plan.

**Archivo**: `src/components/AppLayout.tsx`, `src/hooks/useUserUsage.ts` (exponer `loading`)

---

### 2. Banco de preguntas no muestra contenido completo

**Causa**: En `BancoPreguntas.tsx`, cada pregunta se muestra con `truncate` (línea 164) y no se renderiza el contenido de `question_data` (alternativas, opciones V/F, etc.).

**Solución**: Expandir cada tarjeta para mostrar:
- El enunciado completo (quitar `truncate`)
- Las alternativas (para selección múltiple) con indicador de cuál es correcta
- Las afirmaciones V/F (para verdadero/falso)
- Un estado expandir/colapsar por pregunta para no saturar la vista

**Archivo**: `src/pages/BancoPreguntas.tsx`

---

### 3. Botón "Hoja OMR" siempre visible

**Causa**: El botón OMR en `CrearPrueba.tsx` (línea 467) se muestra incondicionalmente.

**Solución**: Solo mostrarlo cuando la plantilla seleccionada tiene `essayMode === "simce"` o `essayMode === "paes"`. La variable `template` ya está disponible en el componente.

**Archivo**: `src/pages/CrearPrueba.tsx`

---

### 4. Pie de página mal ubicado en la previsualización paginada

**Causa**: En `PaginatedAssessmentPreview.tsx`, el código clasifica los hijos de `.pa-page` en "headerBlocks" (todo lo que no es `.pa-content`) y "contentBlocks" (hijos de `.pa-content`). El footer (`.pa-footer`) y el watermark son hermanos después de `.pa-content`, pero se agregan a `headerBlocks` porque el código no los distingue. Resultado: el footer aparece al inicio de la primera página.

**Solución**: Separar los bloques en tres categorías: header (antes de `.pa-content`), content (hijos de `.pa-content`), y footer (`.pa-footer` y `.pa-watermark`, después de `.pa-content`). El footer se agrega solo al final de la última página.

**Archivo**: `src/components/test-builder/PaginatedAssessmentPreview.tsx`

---

## Resumen de cambios

| Archivo | Cambio |
|---------|--------|
| `AppLayout.tsx` | Ocultar badge de créditos mientras `loading` es true |
| `useUserUsage.ts` | (ya expone `loading`, solo verificar que se use) |
| `BancoPreguntas.tsx` | Mostrar enunciado completo + alternativas/opciones con expandir/colapsar |
| `CrearPrueba.tsx` | Condicionar botón OMR a `template?.essayMode === "simce" \|\| "paes"` |
| `PaginatedAssessmentPreview.tsx` | Separar footer de headerBlocks y colocarlo al final de la última página |
