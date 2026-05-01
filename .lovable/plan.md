
## Plan: Panel de Administración Global

### 1. Base de Datos (Migraciones)

**Tabla `global_settings`** (single-row, similar a `app_settings`):
- `id` boolean PK default true
- `enable_payments` boolean default false
- `default_free_credits` int default 20
- `maintenance_mode` boolean default false
- `updated_at` timestamptz
- RLS: solo admin puede leer/escribir

**Columna nueva en `user_usage`:**
- `plan_expires_at` timestamptz nullable default null

**RLS para `global_settings`:**
- SELECT/UPDATE solo para admin (`has_role(auth.uid(), 'admin')`)

**Actualizar `handle_new_user`:**
- Leer `default_free_credits` desde `global_settings` al crear el registro en `user_usage`, en vez de hardcodear 20.

### 2. Nueva Página `/admin/dashboard`

Accesible solo para rol `admin` (reutilizando `AdminGuard` ajustado o un nuevo guard que solo permita admin, no UTP).

**Tres secciones con tabs:**

**a) Ajustes Globales:**
- Switch para `enable_payments` y `maintenance_mode`
- Campo numérico para `default_free_credits`
- Botón guardar

**b) Gestión de Usuarios:**
- Tabla con búsqueda que muestra: email, display_name, plan_type, credits_available, plan_expires_at
- Consulta join entre `profiles`, `user_usage` y `user_roles`
- Acciones inline por usuario:
  - Selector para cambiar `plan_type` (free/pro/institucional)
  - Botón "Recargar Créditos" (dialog con input numérico)
  - Date picker para establecer/quitar `plan_expires_at`

**c) Control de Instituciones:**
- Nota: actualmente la app es mono-institución (no existe tabla de instituciones ni `institution_id` en profiles). Se implementará una vista simplificada que permita al admin seleccionar múltiples usuarios y asignarles masivamente el plan "institucional".
- Tabla de usuarios con checkboxes + botón "Asignar Plan Institucional" masivo.

### 3. Lógica de Respeto a Membresía

- En `useUserUsage`, agregar `planExpiresAt` al estado.
- El plan efectivo se calcula así: si `plan_expires_at` existe y es futuro, se respeta el `plan_type` guardado. Si ya venció, se trata como `free` en el cliente.
- La edge function `generate-question` también verificará la expiración antes de otorgar beneficios del plan.

### 4. Navegación

- Agregar enlace "Admin Panel" en `AppLayout` visible solo para `isAdmin`.
- Registrar ruta `/admin/dashboard` en `App.tsx` con guard de admin.

### 5. Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `supabase/migrations/...sql` | Crear `global_settings`, agregar `plan_expires_at` |
| `src/pages/AdminDashboard.tsx` | Nueva página completa |
| `src/lib/global-settings.ts` | CRUD para global_settings |
| `src/hooks/useUserUsage.ts` | Agregar `planExpiresAt` y lógica de expiración |
| `src/components/AppLayout.tsx` | Enlace a admin panel |
| `src/App.tsx` | Nueva ruta |
| `supabase/functions/generate-question/index.ts` | Verificar expiración de plan |

### Notas técnicas

- La RLS de `user_usage` ya permite admin full access, así que las actualizaciones de plan/créditos desde el panel funcionarán.
- No se necesita tabla de instituciones adicional dado que la app es mono-colegio; la asignación masiva se hace por selección manual de usuarios.
