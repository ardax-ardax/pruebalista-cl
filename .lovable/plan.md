# Filtro por docente para el administrador

Permite que el administrador filtre la lista de "Mis pruebas" por un docente concreto, mostrando nombre/email en lugar de UUIDs.

## Cambios

### 1. Backend — tabla `profiles`

Migración SQL nueva:
- Tabla `public.profiles` (`id` referenciando `auth.users(id) on delete cascade`, `email`, `display_name`, `avatar_url`, `created_at`, `updated_at`).
- RLS habilitada con políticas:
  - SELECT/UPDATE/INSERT: `id = auth.uid() OR has_role(auth.uid(), 'admin')`.
- Trigger `trg_profiles_updated_at` con `set_updated_at()`.
- Reemplazo de `handle_new_user()` para que, además de asignar rol, inserte una fila en `profiles` con datos de `raw_user_meta_data` (`full_name` / `name` / fallback al local-part del email) y `avatar_url`.
- Backfill: insertar perfiles para los usuarios ya existentes en `auth.users`.

### 2. Frontend — `MisPruebas.tsx`

- Cuando el admin tiene "Ver todas" activo, mostrar un nuevo selector **"Docente"** con:
  - Opción "Todos los docentes" (estado actual).
  - Una opción por cada autor presente en la lista de pruebas, con su `display_name` (o email si no hay nombre).
- Al elegir un docente, filtrar `visible` a `userId === selectedTeacherId`.
- Mostrar el nombre del autor en cada tarjeta cuando es de otro docente (sustituye al texto "otro docente").

### 3. Carga de perfiles

- Nueva función `listProfiles()` en `src/lib/profiles.ts` que hace `select id, email, display_name, avatar_url from profiles`.
- En `MisPruebas`, si `isAdmin`, cargar perfiles una vez y mantener un mapa `userId -> profile`.
- Para no-admins no se cargan perfiles (RLS solo deja ver el suyo).

## Archivos afectados

- Migración SQL nueva (vía herramienta de migración).
- `src/lib/profiles.ts` (nuevo).
- `src/pages/MisPruebas.tsx` (selector + uso de nombres).

¿Apruebas?