## Objetivo
Eliminar la duplicación de gestión de cursos. Toda la administración para UTP vive solo en **Configuración → pestaña Cursos**, usando el asistente de 3 pasos (Nivel → Grado → Letra) que ya genera el nombre automáticamente.

## Cambios

### 1. Eliminar el menú "Cursos" del header
- `src/components/AppLayout.tsx`: quitar el `<NavItem to="/cursos" label="Cursos" .../>` que se muestra a `isUtpHead`. El acceso queda solo por Configuración.

### 2. Deshabilitar la ruta `/cursos`
- `src/App.tsx`: eliminar la ruta `/cursos` y el `import` lazy de `Cursos`.
- Borrar `src/pages/Cursos.tsx` (página legacy que usaba la tabla `courses` con creación manual de nombres arbitrarios).

### 3. Preservar la gestión de estudiantes (roster)
La página `Cursos.tsx` no solo creaba cursos: también administraba el roster de estudiantes (`StudentImporter`, listado, eliminación). Ese roster es usado por la hoja OMR (`OmrSheetDialog`). Para no perderlo, mover ese bloque a una **subsección dentro de la misma pestaña "Cursos" de Configuración**, debajo del `UtpCoursesManager`:
  - Nuevo componente `src/components/utp/StudentRosterPanel.tsx` extraído de `CursosInner` (selector de curso desde `admin_courses` ahora, no `courses`; importador CSV; tabla con eliminar).
  - Insertarlo en `src/pages/Configuracion.tsx` dentro del `TabsContent value="cursos"`, después de `<UtpCoursesManager />`.

> Nota técnica: el roster legacy referenciaba la tabla `courses` (id uuid). Hoy los cursos institucionales viven en `admin_courses`. El nuevo panel debe vincular estudiantes a `admin_courses.id`. Como `students.course_id` apunta a `courses`, mantenemos por ahora la tabla `courses` solo como destino de los rosters y dejamos el selector apuntando a ella; **no** se permite crear nuevos `courses` desde la UI (la creación queda 100% bajo `admin_courses` vía el asistente). Si más adelante se desea unificar tablas, será una migración aparte.

### 4. Confirmar el flujo automatizado en `UtpCoursesManager`
Ya cumple los requisitos solicitados; verificar y dejar explícito:
- Botón "Nuevo curso" abre solo el asistente (Nivel/Grado/Letra) — ✅ ya está así.
- No hay input de texto manual para el nombre — ✅ el campo "Nombre" es `readOnly disabled` y se computa con `buildCourseLabels`.
- Vista previa del nombre antes de guardar — ✅ ya se muestra ("1º Básico A") junto al slug interno.
- `refresh()` se llama tras guardar para actualizar la tabla sin recargar — ✅ ya implementado.
Solo añadir un pequeño badge "Vista previa" sobre el input para reforzar la claridad UX.

### 5. Limpieza de referencias y código legacy
- `src/lib/courses.ts`: marcar `createCourse`, `updateCourse`, `deleteCourse` como deprecated o eliminarlas. Conservar solo `listCourses`, `listStudentsByCourse`, `bulkInsertStudents`, `deleteStudent` (las usa el roster y OMR).
- Buscar referencias residuales a `/cursos` en navegación/dashboards y reemplazarlas por `/configuracion?tab=cursos` cuando aplique.
- Verificar `DashboardDocente`, `MisPruebas` y filtros: las listas de cursos se cargan desde `admin_courses` vía `useAdminCourses` (ya unificado), no requieren cambios.

### 6. QA manual sugerido
- Como UTP: el header ya no muestra "Cursos". Configuración → Cursos abre el asistente, crea "2º Básico B", aparece de inmediato en la tabla.
- Visitar `/cursos` redirige a NotFound.
- OMR sigue funcionando porque `OmrSheetDialog` consume `listCourses()` y `listStudentsByCourse()` del roster.

## Archivos afectados
- Editar: `src/App.tsx`, `src/components/AppLayout.tsx`, `src/pages/Configuracion.tsx`, `src/components/utp/UtpCoursesManager.tsx`, `src/lib/courses.ts`
- Crear: `src/components/utp/StudentRosterPanel.tsx`
- Eliminar: `src/pages/Cursos.tsx`
