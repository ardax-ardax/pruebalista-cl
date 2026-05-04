
## Problema

Los cursos de Media aparecen duplicados (A y B) en el perfil docente porque el dropdown se alimenta de `DEFAULT_GRADES` en `catalog.ts`, que tiene entradas como `IMedioA`, `IMedioB`, etc. Pero `admin_courses` en la base de datos define un solo curso por nivel: `IMedio`, `IIMedio`, etc.

El filtro por `plan_allowed_courses` compara `admin_courses.grade_value` ("IMedio") contra el `value` del catálogo ("IMedioA"), no hace match, y las entradas pasan sin filtrar. Resultado: aparecen dos de cada medio (A y B) del catálogo hardcodeado.

## Solución

Reemplazar `loadGrades()` (localStorage/hardcoded) por una carga directa desde `admin_courses` como fuente de verdad en las páginas que muestran el dropdown de cursos. La sección (A-F) ya se maneja por separado con `section_letter` en `teacher_assignments`.

### Cambios

**1. `src/pages/Perfil.tsx`**
- Eliminar la importación de `loadGrades` del catálogo.
- Cargar cursos desde `admin_courses` (ordenados por `sort_order`), mapeando a `{ value: grade_value, label, level }`.
- Si hay `effectivePlan`, filtrar por `plan_allowed_courses` como ya se hace.
- El dropdown mostrará exactamente lo que el admin definió (sin duplicados A/B).

**2. `src/pages/CrearPrueba.tsx`**
- Mismo cambio: reemplazar `loadGrades()` por consulta a `admin_courses`.
- El filtro por plan ya existente seguirá funcionando porque ahora los `grade_value` coincidirán.

**3. Verificar otras páginas** que usan `loadGrades()`:
- `BancoPreguntas.tsx`, `MisPruebas.tsx`, `DashboardDocente.tsx`, `Configuracion.tsx`, `StaffManager.tsx`, `CurriculumManager.tsx`, `QuestionBankDialog.tsx` -- migrar también a `admin_courses` para consistencia.
- Crear un hook reutilizable `useAdminCourses()` que cargue desde la tabla y aplique el filtro de plan si corresponde, para no repetir la lógica en cada página.

### Sin cambios en base de datos

No se requieren migraciones. La tabla `admin_courses` ya tiene los datos correctos.
