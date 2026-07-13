## Objetivo
Permitir que usuarios se registren e inicien sesión con **email + contraseña**, en paralelo con el botón "Continuar con Google" ya existente. Confirmación por email activa, recuperación de contraseña habilitada, y las invitaciones UTP funcionan por ambos métodos.

## Cambios

### 1. Página de autenticación (`src/pages/Auth.tsx`)
Reorganizarla con:
- **Tabs**: "Iniciar sesión" / "Crear cuenta"
- **Botón Google** arriba (ya existe) + separador "o"
- **Formulario email/password**:
  - Login: email, contraseña → `supabase.auth.signInWithPassword`
  - Signup: nombre, email, contraseña, confirmar contraseña → `supabase.auth.signUp` con `emailRedirectTo: window.location.origin`
- **Enlace "¿Olvidaste tu contraseña?"** → abre modal/pantalla que llama `resetPasswordForEmail` con `redirectTo: ${origin}/reset-password`
- **Validaciones**: email válido, contraseña mínima 8 chars, coincidencia de contraseñas
- **Estados**:
  - Tras signup: mensaje "Te enviamos un correo de confirmación. Revisa tu bandeja para activar la cuenta."
  - Errores en español (`Invalid credentials` → "Email o contraseña incorrectos", `User already registered` → "Este email ya está registrado", etc.)

### 2. Nueva página `/reset-password` (`src/pages/ResetPassword.tsx`)
- Ruta pública (fuera del guard de auth)
- Detecta `type=recovery` en el hash de la URL
- Formulario: nueva contraseña + confirmación
- Llama `supabase.auth.updateUser({ password })`
- Redirige a `/` con toast de éxito
- Registrar en `src/App.tsx` como ruta pública

### 3. Configuración de Auth (`supabase--configure_auth`)
- `auto_confirm_email: false` → confirmación por email activa
- `disable_signup: false` → registro público habilitado
- `password_hibp_enabled: true` → bloquea contraseñas filtradas (seguridad extra)

### 4. Plantillas de email de autenticación
El proyecto ya tiene `auth-email-hook` scaffolded. Verificar que las 3 plantillas relevantes estén brandeadas:
- `signup.tsx` (confirmación de cuenta)
- `recovery.tsx` (recuperación de contraseña)
- `invite.tsx` (invitaciones UTP)

Si el texto está en inglés genérico, adaptarlo al español y al branding "PruebaLista".

### 5. Flujo de invitaciones UTP (sin cambios de código)
El trigger `handle_new_user` ya lee `pending_invitations` por email — funciona igual con Google o con email/password. El usuario invitado:
- **Con Google**: entra con la cuenta de Google que use el email invitado.
- **Con email/password**: se registra en el mismo formulario, recibe email de confirmación, y al confirmar queda vinculado al colegio y con rol `docente` o `utp_head`.

No requiere migración. Solo asegurar que el texto del email de invitación (`invite.tsx`) mencione que puede usar cualquiera de los dos métodos.

## Notas técnicas
- `signUp` con `emailRedirectTo: window.location.origin` es obligatorio para que el link del correo vuelva al dominio correcto (`pruebalista-app.lovable.app`, y más adelante `pruebalista.cl`).
- No se toca `handle_new_user` ni RLS: el flujo institucional ya está cubierto.
- El `AuthProvider` existente ya escucha `onAuthStateChange`, así que el login por password se propaga automáticamente al resto de la app.
- `/reset-password` debe montarse **antes** que cualquier guard en `App.tsx`, si no el usuario recién llegado con recovery token queda bloqueado.

## Fuera de alcance
- No se implementa "magic link" (login sin contraseña) — solo password + Google.
- No se cambia el branding de las plantillas más allá de asegurar español y consistencia (si quieres rediseñarlas te lo propongo aparte).
