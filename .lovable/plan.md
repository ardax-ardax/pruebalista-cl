
## Rediseño de Landing Page + Enrutamiento por Rol

### 1. Nueva Landing Page (`src/pages/Landing.tsx`)
Página pública (sin AuthGuard) con:

- **Hero Section**: Titulo "Potencia tu gestión pedagógica con IA alineada al Mineduc", subtitulo sobre estandarización y cobertura curricular, badge "Plataforma alineada al currículum Mineduc".
- **Dos tarjetas de acceso**:
  - "Acceso Docente" — icono GraduationCap, beneficios (IA, banco de preguntas, exportación), botón primario.
  - "Gestión Institucional / UTP" — icono Building2, beneficios (revisión, asignación, reportes), botón outline.
  - Ambos ejecutan `signInWithGoogle()`. Si el usuario ya está logueado, se redirige automáticamente según rol.
- **Sección de confianza**: "La primera plataforma que habla el lenguaje del Mineduc" con tres columnas: OAs Oficiales, IA Alineada, Flujo UTP.
- **Footer** simple.
- Usa tokens de diseño existentes (--primary, --success, --gradient-primary, --shadow-card, --shadow-elevated).

### 2. Lógica de Redirección por Rol
Función `resolveDestination(role, userId)` en Landing.tsx:

| Rol | Destino |
|-----|---------|
| `admin` | `/admin/dashboard` |
| `utp_head` | `/configuracion` |
| `docente` con `colegio_id` (institucional) | `/` (DashboardDocente) |
| `docente` sin `colegio_id` (independiente) | `/crear-prueba` |

Se ejecuta automáticamente al detectar usuario logueado en Landing.

### 3. Actualización de Rutas (`src/App.tsx`)
- `/landing` → `<Landing />` (público, sin AuthGuard)
- `/auth` → redirige a `/landing` (mantener compatibilidad)
- `/` → `<AuthGuard><DashboardDocente /></AuthGuard>` (sin cambio)
- Resto de rutas sin cambio.

### 4. Auth.tsx
- El redirect post-login usa `resolveDestination` para ir al destino correcto según rol en vez de siempre ir a `/`.

### 5. AuthGuard.tsx
- Redirige a `/landing` en vez de `/auth` cuando no hay sesión.

### Archivos afectados
| Archivo | Cambio |
|---------|--------|
| `src/pages/Landing.tsx` | Nuevo — landing page pública |
| `src/App.tsx` | Agregar ruta `/landing`, actualizar `/auth` |
| `src/pages/Auth.tsx` | Redirect post-login por rol, redirect base a `/landing` |
| `src/components/AuthGuard.tsx` | Redirigir a `/landing` en vez de `/auth` |
