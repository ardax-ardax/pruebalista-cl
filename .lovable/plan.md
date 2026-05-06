
## Plan: Limpieza de Roles y Vistas

### 1. Restricciones para Admin puro

**AppLayout.tsx** - Sidebar/nav:
- El `isAdminOnly` ya oculta "Crear prueba", "Banco" y "Mis pruebas". Adicionalmente ocultar "Cursos" para admin puro (actualmente solo se muestra si `isUtpHead`, ya correcto).
- Confirmar que el menú admin solo muestra: Inicio, Configuración, Admin.

**Configuracion.tsx** - Pestaña Admin:
- Eliminar la sección "Datos de Colegio" (`renderColegioData()`) del tab "Colegio" del admin. Mantener solo `ColegiosManager` (gestión de colegios de terceros).
- Renombrar el tab "Colegio" a "Colegios" para reflejar que gestiona colegios ajenos.

**Perfil.tsx** - Para admin puro:
- Ocultar las pestañas "Branding" y "Mis cursos".
- Ocultar la card "Plan y cuenta" (créditos, plan asociado). El admin es usuario de sistema.

**AdminDashboard.tsx** - Filtrado de usuarios:
- En la pestaña "Usuarios", filtrar la lista para mostrar solo Docentes Autónomos (`colegio_id = NULL`) y usuarios con rol `utp_head`. Los docentes institucionales (con `colegio_id`) no aparecen aquí.
- Esto requiere cargar `colegio_id` y `role` junto con los profiles/usage.

### 2. Mejoras en Gestión de Colegios (ColegiosManager.tsx)

- **Buscador de colegios**: Agregar un input de búsqueda por nombre de colegio en la parte superior de la lista.
- **Selector de vinculación**: Filtrar el dropdown para mostrar solo usuarios con `colegio_id = NULL` (Docentes Autónomos y UTPs sin colegio).
- **RUT en listado**: Mostrar el campo `document_id` (RUT) junto al nombre/email en el selector y en la lista de miembros del colegio. Esto requiere que el campo exista en `profiles` (ver punto 3).
- **Fix de invitaciones pendientes**: Al cargar invitaciones pendientes de un colegio, cruzar con `profiles` por email. Si el perfil ya existe, marcar la invitación como consumida automáticamente (`consumed_at = now()`).

### 3. Nuevos campos en perfil Docente

**Migración SQL** - Añadir dos columnas a `profiles`:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secondary_email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS document_id text;
```

**Perfil.tsx** - Tab "Datos":
- Agregar campos editables "Correo electrónico adicional" (`secondary_email`) y "RUT" (`document_id`) en la card de datos personales.
- Usar `updateMyProfile` extendido para guardar estos campos.
- Visible solo para docentes (no admin).

**profiles.ts** - Extender las interfaces y queries para incluir `secondary_email` y `document_id`.

### 4. Lógica de asignaciones

- Las asignaciones docente-curso-asignatura ya no aparecen en el Admin Dashboard (no hay tab de asignaciones allí actualmente).
- Confirmar que la gestión de asignaciones solo existe en:
  - **Perfil.tsx** tab "Mis cursos" (para docentes autónomos e institucionales).
  - **UTP panel** (Configuracion.tsx tab "equipo" via UtpTeamManager).
- No se requieren cambios adicionales aquí; el admin ya no tiene acceso a estas tablas desde la UI.

### 5. Limpieza visual (UX)

- Verificar que el nav del Admin solo muestre: Inicio, Configuración, Admin.
- Los badges de rol ya usan colores consistentes (rojo/azul/verde) en ColegiosManager.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/AppLayout.tsx` | Confirmar restricciones nav admin |
| `src/pages/AdminDashboard.tsx` | Filtrar usuarios (solo autónomos + UTP) |
| `src/pages/Configuracion.tsx` | Eliminar "Datos de Colegio" del admin |
| `src/pages/Perfil.tsx` | Ocultar branding/plan para admin, agregar campos RUT y email secundario |
| `src/components/admin/ColegiosManager.tsx` | Buscador, filtro vinculación, RUT, fix invitaciones |
| `src/lib/profiles.ts` | Extender con secondary_email y document_id |

### Cambios de base de datos

Una migración para agregar `secondary_email` y `document_id` a la tabla `profiles`.
