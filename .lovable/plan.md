
## Objetivo

Crear una pestaña "Asignaturas" en el panel de administración para gestionar un catálogo maestro de asignaturas, indicando en qué niveles se dicta cada una. Luego, en la pestaña "Cursos", al asignar asignaturas a un curso, solo mostrar las que correspondan según el nivel del curso.

---

## 1. Nueva tabla `admin_subjects` (migración)

- Campos: `subject_value` (slug único), `subject_label` (nombre visible), `levels` (array de texto: Básica, Media, ElectivoMedia), `sort_order`
- RLS: admin puede crear/editar/eliminar, cualquier autenticado puede leer
- Se pre-carga con las ~40 asignaturas que hoy están hardcodeadas en `DEFAULT_SUBJECTS` de `catalog.ts`

## 2. Nuevo componente `AdminSubjectsManager.tsx`

- Tabla con todas las asignaturas mostrando nombre, valor interno y niveles como badges
- Botón "Nueva asignatura" abre diálogo con: nombre, valor (slug), checkboxes de niveles (Básica/Media/ElectivoMedia), orden
- Botones editar y eliminar en cada fila
- CRUD contra la tabla `admin_subjects`

## 3. Actualizar `AdminDashboard.tsx`

- Agregar pestaña "Asignaturas" (con icono `BookOpen`) en el `TabsList`

## 4. Actualizar `AdminCoursesManager.tsx`

- En vez de usar `ALL_SUBJECTS` (derivado de `DEFAULT_SUBJECTS` hardcodeado), cargar asignaturas desde la tabla `admin_subjects`
- Al expandir un curso, filtrar por las asignaturas cuyo array `levels` contenga el nivel del curso
- Así solo aparecen las asignaturas relevantes para cada curso

---

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Tabla `admin_subjects` + seed con asignaturas actuales |
| `src/components/admin/AdminSubjectsManager.tsx` | Nuevo componente CRUD |
| `src/pages/AdminDashboard.tsx` | Nueva pestaña "Asignaturas" |
| `src/components/admin/AdminCoursesManager.tsx` | Cargar asignaturas desde DB en vez de constante |
