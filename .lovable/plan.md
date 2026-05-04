
## Resumen

Tres cambios principales:
1. Nueva pestaña "Cursos" en el panel Admin para gestionar cursos y sus asignaturas (persiste en BD)
2. Asignar cursos permitidos a cada plan
3. Campo de letra/sección (A-F) en la asignación docente y al crear evaluación

---

## 1. Base de datos (migraciones SQL)

### Tabla `admin_courses`
Cursos maestros definidos por el admin (separados de los `courses` existentes que son para roster de estudiantes):

```sql
CREATE TABLE public.admin_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_value text NOT NULL UNIQUE,  -- ej: "1ºBásico"
  label text NOT NULL,               -- ej: "1° Básico"
  level text NOT NULL DEFAULT 'Básica', -- Básica, Media, ElectivoMedia
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Tabla `admin_course_subjects` (relación curso → asignaturas)
```sql
CREATE TABLE public.admin_course_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES admin_courses(id) ON DELETE CASCADE NOT NULL,
  subject_value text NOT NULL,
  subject_label text NOT NULL,
  UNIQUE(course_id, subject_value)
);
```

### Tabla `plan_allowed_courses` (relación plan → cursos permitidos)
```sql
CREATE TABLE public.plan_allowed_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES admin_courses(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(plan_id, course_id)
);
```

### Columna `section_letter` en `teacher_assignments`
```sql
ALTER TABLE teacher_assignments ADD COLUMN section_letter text NOT NULL DEFAULT 'A';
```

RLS: admin CRUD en las 3 tablas nuevas, authenticated SELECT. `teacher_assignments` ya tiene RLS adecuado.

Se insertarán los cursos y asignaturas existentes de `DEFAULT_GRADES` y `DEFAULT_SUBJECTS` como datos iniciales.

---

## 2. Panel Admin — Pestaña "Cursos y Asignaturas"

Nueva pestaña en `AdminDashboard.tsx` con un componente `AdminCoursesManager`:

- Lista de cursos existentes (tabla), cada uno expandible para ver/editar sus asignaturas
- Crear/editar/eliminar cursos (label, grade_value, level)
- Asignar asignaturas a cada curso (checkboxes del catálogo de asignaturas disponibles)
- Los cursos existentes en `catalog.ts` se usarán como seed inicial

---

## 3. Asignar cursos a planes

En `PlansManager.tsx`, agregar al diálogo de edición de plan:
- Sección "Cursos permitidos" con checkboxes de todos los cursos de `admin_courses`
- Si ninguno está marcado = todos permitidos (sin restricción)
- Se guarda en la tabla `plan_allowed_courses`

---

## 4. Letra de sección para docentes

### En la asignación (UTP/Admin asigna docente a curso)
- Agregar campo `section_letter` (Select: A-F, default A) en el formulario de asignación de `teacher_assignments`
- Se muestra como "1° Básico A" en las listas

### Al crear evaluación (`AssessmentMetaForm`)
- Agregar selector de letra (A-F, default A) junto al selector de curso
- El valor por defecto viene de la asignación del docente si existe
- El label completo se forma como "1° Básico A"

---

## 5. Integración con catálogo UTP

- El catálogo UTP en Configuración sigue existiendo para personalización local
- Los cursos del admin sirven como catálogo global/maestro
- Cuando existen cursos en `admin_courses`, se usan como fuente principal; el UTP puede seguir editando su catálogo local como complemento

---

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| Migración SQL | 3 tablas nuevas + columna section_letter + RLS + seed |
| `src/components/admin/AdminCoursesManager.tsx` | Nuevo componente |
| `src/pages/AdminDashboard.tsx` | Nueva pestaña "Cursos" |
| `src/components/admin/PlansManager.tsx` | Sección "Cursos permitidos" en diálogo |
| `src/components/test-builder/AssessmentMetaForm.tsx` | Campo letra de sección |
| `src/pages/Configuracion.tsx` | Ajustar asignación docente con section_letter |
| `src/lib/teacher-assignments.ts` | Agregar section_letter |
| `src/hooks/usePlans.tsx` | Cargar cursos permitidos por plan |
| `src/integrations/supabase/types.ts` | Auto-actualizado |
