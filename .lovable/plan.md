
## Plan: Correcciones de flujo Docente Institucional y Revisión UTP

### 1. Herencia de branding para docentes institucionales

**Archivos**: `src/pages/CrearPrueba.tsx`, `src/pages/Perfil.tsx`, `src/components/AppLayout.tsx`

- **CrearPrueba.tsx**: Cuando el docente tiene `colegioId`, cargar `nombre` y `logo_url` de la tabla `colegios` (en vez del branding personal del perfil). Consultar `supabase.from("colegios").select("nombre, logo_url").eq("id", colegioId)`.
- **Perfil.tsx**: Ocultar la pestaña "Branding" si `profile.colegioId` existe (el docente institucional hereda el branding del colegio, no necesita configurarlo). Mostrar un aviso informativo en su lugar.
- **Perfil.tsx** (Plan y cuenta): Para institucionales, ocultar créditos personales y "Plan Free". Mostrar "Cuenta Institucional" y el nombre del colegio.
- **AppLayout.tsx**: Si el usuario tiene `colegioId`, reemplazar el badge de créditos/plan por "Cuenta Institucional" o el nombre del colegio. Requiere cargar el perfil (ya se carga `hideCredits`; ampliar para verificar `colegioId`).

### 2. Bug: curso desaparece en pruebas rechazadas

**Archivo**: `src/pages/CrearPrueba.tsx`, `src/components/test-builder/AssessmentMetaForm.tsx`

- **Causa raíz**: Al cargar una prueba existente, el `gradeValue` almacenado en `assessment.meta` es correcto, pero el componente `AssessmentMetaForm` filtra `availableGrades` según `restrictedAssignments`. Si las asignaciones del docente cambiaron o el grade no coincide exactamente, el Select no encuentra el valor y se resetea.
- **Fix en AssessmentMetaForm**: Si `meta.gradeValue` ya tiene valor (prueba existente) pero no está en `availableGrades`, incluirlo como opción adicional (modo lectura) para que no desaparezca. Misma lógica para `subjectValue` en `availableSubjects`.
- **Fix en validate()** (líneas 447-448): Los sets `SIMCE_ALLOWED` y `PAES_ALLOWED` usan valores con letra de sección (`IIMedioA`, `IIIMedioA`, etc.) — deben corregirse a `IIMedio`, `IIIMedio`, `IVMedio` para coincidir con los valores reales de la BD (mismo fix que se hizo en el form pero no en validate).

### 3. Permisos de edición UTP

**Archivo**: `src/pages/CrearPrueba.tsx`

- La UTP ya puede editar (línea 250: `if (isStaff) return false`). Los cambios se guardan via autosave (upsert). Verificar que el `ownerId` se preserva correctamente en `upsertAssessment` — ya lo hace (línea del existing check). **No requiere cambios**, solo confirmar que funciona.

### 4. Filtrar asignaturas por carga académica + aviso sin asignaciones

**Archivo**: `src/pages/CrearPrueba.tsx`

- El aviso "Configura tus cursos primero" ya existe (líneas 346-361), pero solo para pruebas nuevas y redirige a Perfil. Para docentes institucionales (con `colegioId`), cambiar el mensaje a: "Pide a tu UTP que te asigne cursos y asignaturas" (ya que la asignación la hace la UTP, no el docente).
- El filtrado por `restrictedAssignments` ya funciona correctamente en `AssessmentMetaForm`.

### 5. Botón "Re-enviar a Revisión"

**Archivo**: `src/pages/CrearPrueba.tsx`

- Línea 588-591: El botón dice "Enviar a Revisión UTP" tanto para borradores como para rechazados.
- Cambiar: si `assessmentStatus === "rechazado"`, mostrar "Re-enviar a Revisión" en lugar de "Enviar a Revisión UTP".

---

### Resumen de archivos a modificar

| Archivo | Cambios |
|---|---|
| `src/pages/CrearPrueba.tsx` | Branding institucional desde `colegios`, fix validate(), texto botón re-envío, mensaje docente institucional sin asignaciones |
| `src/components/test-builder/AssessmentMetaForm.tsx` | Preservar grade/subject de prueba existente en selects |
| `src/pages/Perfil.tsx` | Ocultar tab Branding si institucional, ajustar sección Plan |
| `src/components/AppLayout.tsx` | Badge "Cuenta Institucional" para docentes con colegioId |

No se requieren migraciones de base de datos.
