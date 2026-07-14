## Diagnóstico

El código de `src/pages/Auth.tsx` ya tiene el formulario email + contraseña (pestañas "Iniciar sesión / Crear cuenta") **debajo** del botón "Continuar con Google", separados por una línea "o con email".

En la preview del editor sí aparecen. En `https://pruebalista-app.lovable.app/landing` **no** aparecen porque el bundle publicado es anterior a ese cambio — cuando se hizo la modificación, los últimos intentos de publicación quedaron a medias (pantalla en blanco por `supabaseUrl is required`, hardcodeo del fallback en `vite.config.ts`, etc.) y el deploy vigente no incluye el nuevo `Auth.tsx`.

## Acción

Re-publicar el proyecto para regenerar el bundle en `pruebalista-app.lovable.app` con la versión actual de `Auth.tsx`. No hay cambios de código — solo deploy.

## Verificación después del publish

1. Abrir `https://pruebalista-app.lovable.app/landing` en pestaña nueva (hard refresh: Cmd/Ctrl + Shift + R).
2. Ir al botón de acceso → confirmar que aparecen:
   - Botón "Continuar con Google" arriba
   - Separador "o con email"
   - Pestañas "Iniciar sesión" / "Crear cuenta" con campos email + contraseña
   - Enlace "¿Olvidaste tu contraseña?"

Si tras el republish sigue sin aparecer, revisamos si el navegador está cacheando la versión anterior (Service Worker / cache) e investigamos con Playwright contra la URL publicada.

## Fuera de alcance

- No se modifica el flujo de auth ni las plantillas de email.
- No se conecta el dominio custom (`pruebalista.cl`) — sigue pendiente de tu upgrade a Pro.
