
## Problema

El filtro de cursos por plan no funciona porque `plan_allowed_courses` no tiene foreign key hacia `admin_courses`, entonces el join via PostgREST (`admin_courses!inner(grade_value)`) falla silenciosamente y devuelve datos vacíos → se interpreta como "sin restricción" → el docente ve todos los cursos.

## Solución

### 1. Migración: agregar FK de `plan_allowed_courses.course_id` → `admin_courses.id`

También agregar FK de `admin_course_subjects.course_id` → `admin_courses.id` (que también le falta).

### 2. Actualizar `src/pages/CrearPrueba.tsx`

Simplificar la lógica de filtrado para que sea más robusta:
- Consultar `plan_allowed_courses` para el plan del usuario
- Luego consultar `admin_courses` con los IDs obtenidos para obtener los `grade_value`
- Filtrar `grades` con ese set

Esto funciona con o sin FK, pero con el FK también habilita el join para futuros usos.

### Archivos afectados

| Archivo | Cambio |
|---------|--------|
| Nueva migración | FK en `plan_allowed_courses` y `admin_course_subjects` |
| `src/pages/CrearPrueba.tsx` | Arreglar lógica de filtrado (dos queries separadas) |
