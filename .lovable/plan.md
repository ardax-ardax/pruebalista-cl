
## Fix: Redirigir a `/landing` al cerrar sesión

Actualmente, al presionar "Salir", el código en `AppLayout.tsx` hace `navigate("/auth")`. Esto lleva a la página `/auth` que es un formulario simple, en lugar de la Landing Page principal.

### Cambio

**`src/components/AppLayout.tsx` (línea 48)**: Cambiar `navigate("/auth", { replace: true })` por `navigate("/landing", { replace: true })`.

Esto hará que al cerrar sesión el usuario vuelva a la Landing Page pública con las tarjetas de acceso y el hero section.

Un cambio de una sola línea.
