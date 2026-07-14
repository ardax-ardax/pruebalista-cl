
# Landing de marketing + `/auth` separado

## Decisiones confirmadas
- Diseño directo: limpio, profesional, edtech chileno (sin ronda de direcciones visuales).
- Planes leídos dinámicamente de la tabla `plans`.

## Cambios

### 1. `src/pages/Landing.tsx` (reescribir)
Quitar todo el bloque de autenticación. Nueva estructura:

```text
Header sticky:  [Logo Pruebalista]        Cómo funciona · Planes · [Ingresar]
Hero:           Titular + subtítulo + [Comenzar gratis] + mockup
Cómo funciona:  3 pasos (Elige OA → Genera → Descarga PDF)
Características: grid con IA · OA MINEDUC · SIMCE/PAES · OMR · Panel UTP · Reportes
Para quién:     Docente autónomo · Colegios (UTP)
Planes:         3 tarjetas leídas de `plans` (nombre, precio, límites, is_default)
FAQ:            4-5 preguntas
CTA final + Footer
```

Todos los CTA ("Ingresar", "Comenzar gratis", "Empezar ahora") → `navigate("/auth")`; el CTA de un plan pago → `navigate("/auth?tab=signup")`.

Estilo: usar tokens del design system existente (nada de colores hardcoded), tipografía y paleta actuales del proyecto, tarjetas con `Card` de shadcn, íconos de `lucide-react`. Responsive mobile-first.

### 2. `src/pages/Auth.tsx` (compactar)
- Card centrado ~420px, no full-screen.
- Botón Google arriba → separador "o" → tabs Iniciar sesión / Crear cuenta con email+password → link "¿Olvidaste tu contraseña?".
- Link "← Volver al inicio" hacia `/`.
- Leer `?tab=signup` del query string para abrir la pestaña correcta.
- Si ya hay sesión activa, redirige a la ruta post-login que ya usa el proyecto.

### 3. `src/App.tsx`
Confirmar rutas públicas:
- `/` y `/landing` → nuevo `Landing`
- `/auth` → `Auth` compacto
- `/reset-password` → sin cambios

### 4. Hook para planes
Reutilizar el `usePlans` existente (memoria: planes dinámicos). La sección Pricing itera sobre `plans` activos ordenados por precio, muestra `name`, `price`, `default_credits`, `max_assignments`, features y marca el `is_default` como "Recomendado".

## Fuera de alcance
- Sin cambios de auth backend, roles, RLS ni tabla `plans`.
- Sin nuevas rutas privadas.
- Sin cambios de branding/logo del proyecto.

## Verificación
Tras implementar: cargar `/landing` (marketing sin formulario), click en "Ingresar" → `/auth` compacto con Google + email/password funcionando, y las tarjetas de planes reflejando la tabla real.
