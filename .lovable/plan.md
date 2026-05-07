
## Plan: Corrección de bugs críticos de carga y header institucional

### Problema 1: Selectores de Curso/Asignatura vacíos al editar

**Causa raíz**: La evaluación se carga desde la BD correctamente (con `gradeValue` y `subjectValue`), pero el componente `Select` muestra "Selecciona" porque la lista de `grades` (de `useAdminCourses`) aún no ha terminado de cargarse desde Supabase. El `Select` de Radix no muestra el valor si no encuentra un `SelectItem` correspondiente en sus opciones.

**Corrección en `CrearPrueba.tsx`**:
- Usar el flag `loading` de `useAdminCourses()` (ya existe pero no se usa).
- Retrasar la carga de la evaluación hasta que `grades` estén listos: agregar `grades.length > 0` o `!gradesLoading` como condición antes de llamar `getAssessment(editingId)`.
- Alternativamente, si la evaluación ya se cargó pero `grades` llega después, no hay problema porque React re-renderiza. El verdadero fix es en `AssessmentMetaForm`: asegurar que `availableGrades` incluya el `gradeValue` actual aunque `grades` aún esté vacío (ya hay lógica para preservar el grade actual en línea 160-163, pero falla si `grades` está vacío porque `grades.find()` no encuentra nada).

**Corrección en `AssessmentMetaForm.tsx`** (líneas 150-165):
- En el `useMemo` de `availableGrades`, si `meta.gradeValue` existe pero no está en `grades`, crear una opción temporal `{ value: meta.gradeValue, label: meta.gradeValue, level: "Básica" }` como fallback hasta que las grades reales carguen.
- Misma lógica para `availableSubjects` (líneas 169-187): si `meta.subjectValue` no se encuentra, agregar un fallback temporal.

### Problema 2: Flickering de créditos en header institucional

**Causa raíz**: `isInstitutional` inicia en `false` y cambia a `true` solo después de que `getMyProfile()` resuelve. Durante ese tiempo (~200-500ms), se renderiza el badge de créditos.

**Corrección en `AppLayout.tsx`**:
- Agregar un estado `profileLoaded` (o `institutionalChecked`) que inicie en `false`.
- En el `useEffect` que llama a `getMyProfile()`, setear `profileLoaded = true` al final (en el `.then`).
- Cambiar las condiciones de renderizado de los badges (líneas 111-120): no renderizar NINGÚN badge hasta que `profileLoaded` sea `true`. Esto elimina el flickering completamente.

### Problema 3: Persistencia completa de metadatos

**Causa raíz**: Mismo problema que #1 — los campos N° de evaluación, semestre, letra, instrucciones se guardan correctamente en `data.meta` de la BD, pero al cargar, si la evaluación se setea antes de que los catálogos estén listos, el componente no muestra los valores.

**Corrección**: Ya cubierta por el fix del Problema 1. Los campos de texto (N°, título, instrucciones, sectionLetter) no dependen de catálogos, así que ya deberían funcionar. Verificaremos que `sectionLetter` tenga valor por defecto "A" en el schema.

### Problema 4: Botón Re-enviar a Revisión

**Estado actual**: Ya implementado correctamente (línea 634-637). `handleSubmitForReview` llama `updateAssessmentStatus(assessment.id, "pendiente_revision")` que no toca los datos del curso. Verificado que funciona.

**Verificación**: Revisar que el `upsertAssessment` llamado por autosave antes del re-envío preserve el `gradeValue` y `subjectValue`. Con el fix del Problema 1, esto queda asegurado.

---

### Archivos a modificar

1. **`src/components/AppLayout.tsx`** — Agregar `profileLoaded` state, no renderizar badges hasta que se complete la verificación de perfil.
2. **`src/pages/CrearPrueba.tsx`** — Usar `gradesLoading` del hook para mostrar loading state hasta que los catálogos estén disponibles.
3. **`src/components/test-builder/AssessmentMetaForm.tsx`** — Agregar fallback en `availableGrades` y `availableSubjects` para valores ya guardados que aún no aparecen en los catálogos cargados.

No se requieren migraciones de base de datos.
