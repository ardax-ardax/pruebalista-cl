## Estado actual (verificado)

Buena noticia: gran parte del trabajo ya está hecho. Tras revisar la base de datos y el código:

- ✅ El ENUM `app_role` ya incluye `admin`, `utp_head`, `user`.
- ✅ `useAuth` ya expone `isAdmin`, `isUtpHead`, `isStaff` (admin OR utp_head).
- ✅ `AdminGuard.tsx` ya valida con `isStaff` (admin + utp_head pueden entrar a Configuración).
- ✅ Las RLS de `assessments` ya permiten a staff (`is_staff(auth.uid())`) hacer SELECT, UPDATE y DELETE de todas las pruebas.
- ✅ La tabla `teacher_assignments` existe con RLS correcta (docente lee las suyas, staff CRUD).
- ✅ `AssessmentMetaForm.tsx` ya filtra Curso/Asignatura cuando recibe `restrictedAssignments` (rol "user"), y muestra catálogo completo cuando es null (admin/UTP).
- ✅ `CrearPrueba.tsx` carga `restrictedAssignments` solo si NO es staff.
- ✅ `MisPruebas.tsx` ya tiene toggle "Ver todas / Ver solo mías" + filtro por docente para staff.

## Lo que falta construir

### 1. Panel "Gestión de Personal" en Configuración (solo Admin)

Crear componente nuevo `src/components/admin/StaffManager.tsx` y montarlo en `src/pages/Configuracion.tsx` dentro de `{isAdmin && ...}`. Incluye dos sub-secciones:

**A. Asignación de roles**
- Lista de todos los `profiles` (email + display_name) con su rol actual obtenido de `user_roles`.
- Por cada usuario, un `Select` con opciones: `user`, `utp_head`, `admin`.
- Al cambiar: reemplazar el rol existente del usuario en `user_roles` (delete + insert en una transacción lógica del cliente) usando el cliente Supabase. Las RLS ya permiten a admin gestionar roles ("Admins can manage roles").
- Toast de confirmación / error.

**B. Asignaciones docente ↔ curso ↔ asignatura**
- Selector "Docente" (de `profiles`), "Curso" (de `loadGrades()`), "Asignatura" (filtrada por nivel del curso vía `getSubjectsForGrade`).
- Botón "Agregar asignación" → `addAssignment()`.
- Tabla con las asignaciones existentes agrupadas por docente, con botón de eliminar por fila → `removeAssignment()`.
- Reutiliza helpers existentes en `src/lib/teacher-assignments.ts`.

### 2. Filtro adicional por asignatura en MisPruebas (UTP)

`MisPruebas.tsx` ya filtra por docente. Añadir además un `Select` "Asignatura" (visible solo cuando `isStaff && showAll`) para auditar contenido por asignatura. Las opciones se construyen a partir de las asignaturas presentes en `items`.

### 3. Botón Guardar habilitado en pruebas ajenas (UTP)

En `CrearPrueba.tsx`, cuando un staff abre una prueba con `?id=` que pertenece a otro `user_id`:
- El botón "Guardar" ya existe y llama `upsertAssessment`. Verificar que `upsertAssessment` (en `src/lib/assessment-storage.ts`) **no** sobrescriba el `user_id` original al actualizar (debe preservar el dueño). Si actualmente fuerza `user_id = auth.uid()`, ajustarlo a "preservar el existente en UPDATE; usar `auth.uid()` solo en INSERT".
- Mostrar un badge informativo en la cabecera ("Editando como UTP — autor: <email>") cuando `assessment.user_id !== current user.id`.

### 4. Verificación de RLS y flujo

- Confirmar mediante `supabase--linter` que no haya warnings nuevos.
- No se requieren migraciones SQL: la base de datos ya cumple los requisitos. Solo cambios en frontend.

## Detalles técnicos

**Archivos a crear:**
- `src/components/admin/StaffManager.tsx` — panel CRUD de roles + asignaciones.

**Archivos a modificar:**
- `src/pages/Configuracion.tsx` — montar `<StaffManager />` debajo de `<CurriculumManager />` con guard `{isAdmin && ...}`.
- `src/pages/MisPruebas.tsx` — añadir filtro por asignatura para staff.
- `src/pages/CrearPrueba.tsx` — badge "Editando prueba ajena" para staff cuando aplique.
- `src/lib/assessment-storage.ts` — asegurar que `upsertAssessment` preserva `user_id` original en UPDATE (revisar y ajustar si necesario).

**Helpers ya disponibles que reutilizaremos:**
- `listProfiles()` / `profileLabel()` — `src/lib/profiles.ts`
- `listAllAssignments()`, `addAssignment()`, `removeAssignment()` — `src/lib/teacher-assignments.ts`
- `loadGrades()`, `loadSubjects()`, `getSubjectsForGrade()` — `src/lib/catalog.ts`

**Operaciones Supabase nuevas (desde el cliente, autorizadas por RLS):**
- `supabase.from("user_roles").delete().eq("user_id", uid)` y luego `.insert({ user_id, role })` para cambiar el rol activo de un usuario.
- Lectura agregada: `supabase.from("user_roles").select("user_id, role")` para mostrar el rol actual de cada perfil.

**Diagrama de capas de permisos resultante:**

```text
                 ┌──────────────────────────────┐
   admin   ───►  │ Configuración completa       │
                 │  + Gestión de Personal       │
                 │  + Currículum + Pruebas all  │
                 └──────────────────────────────┘
                 ┌──────────────────────────────┐
   utp_head ──►  │ Configuración (sin Personal) │
                 │  + Pruebas all (audita+edita)│
                 └──────────────────────────────┘
                 ┌──────────────────────────────┐
   user    ───►  │ Solo sus pruebas             │
                 │ Curso/Asignatura restringidos│
                 │ a teacher_assignments        │
                 └──────────────────────────────┘
```

## Lo que NO cambia

- No se tocan migraciones de base de datos (todo el esquema necesario ya existe).
- No se modifica la carga de OAs ni el flujo de exportación PDF/DOCX.
- El nombre `AdminGuard` se conserva por compatibilidad, pero ya admite a UTP.
