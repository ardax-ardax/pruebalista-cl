
# Límite de 5 asignaciones para plan free

## Para el usuario
Los docentes podrán seleccionar sus cursos y asignaturas desde su perfil. En plan free, el máximo es 5 combinaciones. Pueden agregar y eliminar libremente, pero no exceder el límite. Al crear una prueba, solo verán los cursos/asignaturas que seleccionaron.

## Cambios

### 1. Migración de base de datos
- Crear función `validate_teacher_assignment_limit()` que verifica el plan del docente en `user_usage`. Si es free y ya tiene 5, rechaza el insert.
- Crear trigger `BEFORE INSERT` en `teacher_assignments` que ejecuta esa validación.
- Agregar 2 políticas RLS en `teacher_assignments`:
  - Docentes pueden insertar sus propias asignaciones
  - Docentes pueden eliminar sus propias asignaciones

### 2. Perfil.tsx — Nueva card "Mis cursos y asignaturas"
- Solo visible para docentes (no staff).
- Muestra contador: "3 de 5 asignaciones (plan free)" o "N asignaciones (sin límite)".
- Lista de asignaciones actuales con badges y botón X para eliminar.
- Selectores de Curso → Asignatura (filtrado por nivel) → botón Agregar.
- Mensaje de límite alcanzado cuando hay 5 en plan free.
- Validación de duplicados antes de agregar.

### 3. CrearPrueba.tsx — Sin cambios
Ya carga las asignaciones del docente y las pasa a `AssessmentMetaForm` como `restrictedAssignments`. Si el docente tiene asignaciones, solo ve esos cursos/asignaturas al crear prueba.

### Archivos afectados
- `supabase/migrations/` — nueva migración SQL
- `src/pages/Perfil.tsx` — agregar card de asignaciones
