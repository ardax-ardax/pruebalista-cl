## Problema

En la página de Perfil → "Mis cursos", el docente ve todos los cursos disponibles en el dropdown, sin respetar la restricción de cursos del plan (`plan_allowed_courses`). El filtro ya se aplicó en `CrearPrueba.tsx` pero falta replicarlo en `Perfil.tsx`.

## Solución

### Archivo: `src/pages/Perfil.tsx`

Agregar la misma lógica de filtrado que ya existe en `CrearPrueba.tsx`:

1. Convertir `grades` de `useMemo` a `useState` (para poder filtrarlo después).
2. Agregar un `useEffect` que, si el usuario no es staff y tiene un `effectivePlan`:
   - Consulta `plan_allowed_courses` para obtener los `course_id` permitidos.
   - Consulta `admin_courses` con esos IDs para obtener los `grade_value`.
   - Filtra el estado `grades` dejando solo los cursos permitidos.
   - Si no hay restricciones (`allowed.length === 0`), no filtra (comportamiento actual).

No se requieren cambios en base de datos ni en otros archivos.
