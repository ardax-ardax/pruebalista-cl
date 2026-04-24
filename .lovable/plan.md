# Cerrar sesión + Configuración solo para admin

## Cambios

### 1. Menú de usuario en el header
En `src/components/AppLayout.tsx`, a la derecha de la navegación, agregar un `DropdownMenu` con:
- Avatar del usuario (foto de Google si existe, si no iniciales del email/nombre)
- Encabezado del menú con nombre + email + badge "Admin" si corresponde
- Item **"Cerrar sesión"** que llama a `signOut()` desde `useAuth` y redirige a `/auth`

### 2. Restringir `/configuracion` a administradores
- **Nuevo `src/components/AdminGuard.tsx`**: si `!isAdmin`, muestra un toast "Solo administradores" y redirige a `/`. Mientras `loading`, muestra el mismo spinner que `AuthGuard`.
- **`src/App.tsx`**: envolver la ruta `/configuracion` con `<AuthGuard><AdminGuard>…</AdminGuard></AuthGuard>`.
- **`src/components/AppLayout.tsx`**: ocultar el `NavItem` de "Configuración" cuando `!isAdmin` (los usuarios normales no lo ven en el nav).

## Archivos
- `src/components/AppLayout.tsx` (editar) — menú de usuario y ocultar nav de Configuración para no-admin
- `src/components/AdminGuard.tsx` (nuevo) — guard de rol admin
- `src/App.tsx` (editar) — aplicar `AdminGuard` a `/configuracion`

## Notas
- No se tocan tablas ni RLS: `isAdmin` ya viene de `useAuth` (consulta a `user_roles`).
- Los usuarios no-admin siguen pudiendo crear pruebas y ver "Mis pruebas".
