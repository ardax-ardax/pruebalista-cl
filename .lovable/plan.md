
## Plan: Jerarquía institucional y persistencia de datos

### 1. Restricción de carga académica para docente institucional (`Perfil.tsx`)

**Problema**: En la pestaña "Mis cursos", el docente institucional (con `colegio_id`) puede agregar y eliminar sus propias asignaciones. Solo deberia ver las que la UTP le asignó, en modo lectura.

**Cambios**:
- En `Perfil.tsx`, cuando `isInstitutional` es `true`:
  - Ocultar el formulario de "Agregar asignación" (selectores de curso/asignatura/letra + botón).
  - Ocultar los botones de eliminar (X) en cada badge de asignación.
  - Cambiar el texto descriptivo a: "Tu carga académica es asignada por tu UTP. Contacta a tu jefe de UTP para modificarla."
  - Si no tiene asignaciones: mostrar "No tienes carga académica asignada. Contacta a tu UTP."

### 2. Bug de persistencia de `gradeValue` al editar pruebas (`CrearPrueba.tsx`)

**Problema**: Al cargar una prueba existente (especialmente rechazada), el `gradeValue` se pierde porque el autosave se dispara durante la carga inicial antes de que los datos estén completos, sobrescribiendo con valores parciales.

**Cambios en `CrearPrueba.tsx`**:
- Mover `initialLoadRef.current = false` para que solo se setee a `false` DESPUES del primer render completo con datos cargados (no en el primer efecto de autosave).
- Agregar una guarda en el `useEffect` de autosave: si `initialLoadRef.current` es `true`, no ejecutar upsert ni saveDraft. Solo marcar como loaded.
- En el `useEffect` que carga asignaciones (linea 123-139): cuando `isDocente` y se está editando (`editingId`), NO setear `hasZeroAssignments = true` si hay asignaciones = 0, ya que la prueba ya existe y el docente debe poder verla.

**Cambios en `AssessmentMetaForm.tsx`**:
- Ya se preserva `meta.gradeValue` en `availableGrades` (linea 159-163) — verificar que funciona correctamente.
- Agregar protección adicional: no resetear `gradeValue`/`subjectValue` en `handleFormatChange` si estamos en modo edición (cuando `meta.gradeValue` ya tiene valor y no estamos cambiando de formato activamente).

### 3. Herencia institucional (ya implementada, ajustes menores)

**Verificación**: La herencia de branding del colegio ya está implementada en `CrearPrueba.tsx` (lineas 151-160) y `AppLayout.tsx`. El branding tab ya se oculta en `Perfil.tsx` para institucionales (linea 226-230, 480).

**Ajuste menor en `Perfil.tsx`**:
- En la sección "Plan y cuenta" para institucionales: agregar el rol "Docente institucional" en lugar de solo mostrar "Cuenta Institucional".

### 4. Flujo de revisión UTP (ya implementado, verificación)

- El autosave ya guarda cambios de UTP via `upsertAssessment` (linea 279).
- El botón "Re-enviar a Revisión" ya está implementado (linea 610).
- No requiere cambios adicionales.

### 5. Visibilidad de asignaciones — RLS ya correcto

Las policies de `teacher_assignments` ya restringen INSERT/DELETE/UPDATE a `is_staff()` o `teacher_user_id = auth.uid()`. El docente institucional técnicamente puede insertar sus propias asignaciones via RLS. 

**Cambio en RLS** (migración):
- Remover las policies "Teachers can delete own assignments" y "Teachers can insert own assignments" para docentes que tengan `colegio_id`. Alternativa más simple: dejar el RLS como está pero bloquear completamente desde la UI (punto 1), ya que el RLS actual permite self-assignment para docentes autónomos que sí lo necesitan.

**Decision**: Bloquear solo desde UI para institucionales, mantener RLS actual para no romper flujo de autónomos.

---

### Archivos a modificar

| Archivo | Cambios |
|---|---|
| `src/pages/Perfil.tsx` | Ocultar form de asignaciones para institucionales, mensaje "contacta tu UTP" |
| `src/pages/CrearPrueba.tsx` | Fix initialLoadRef para evitar autosave prematuro, no bloquear edición de prueba existente cuando asignaciones=0 |
| `src/components/test-builder/AssessmentMetaForm.tsx` | Protección adicional contra reset de gradeValue en edición |

No se requieren migraciones de base de datos.
