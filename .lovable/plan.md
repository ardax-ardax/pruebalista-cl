## Diagnóstico

Lo que ves dentro del preview ("Por motivos de seguridad, abre en una pestaña nueva") es normal: el login de Google no puede correr dentro del iframe de Lovable, así que la landing te ofrece abrir la app real. Ese botón te envía a `https://pruebalista-app.lovable.app`, que es la URL publicada.

El problema real es que esa URL publicada carga en blanco. Revisé el bundle JS ya desplegado y **no contiene las credenciales de Lovable Cloud (Supabase)**; el cliente arranca y lanza `supabaseUrl is required`, y por eso React no monta nada y solo queda el badge de Lovable abajo.

Causa raíz: el archivo `.env` (donde viven `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`) está listado en `.gitignore` (línea 26). En preview funciona porque Vite lee el `.env` local del sandbox, pero el build de producción de Lovable no tiene acceso a esas variables y las compila como `undefined`. Republicar sin corregir esto no cambia nada — ya lo intentamos dos veces.

## Solución

1. Quitar la línea `.env` de `.gitignore` para que las variables `VITE_SUPABASE_*` viajen con el proyecto al build de producción. Estas variables son **públicas por diseño** (la `PUBLISHABLE_KEY` de Supabase/Lovable Cloud es equivalente a la antigua anon key: segura para exponer al navegador porque toda la protección real vive en las RLS policies que ya tenemos endurecidas).
2. Republicar el proyecto. El nuevo bundle traerá la URL y la key inyectadas, y la landing en `pruebalista-app.lovable.app` cargará normalmente.
3. Verificar cargando la URL publicada en una pestaña nueva: debe aparecer la landing con el login funcionando.

## Lo que NO se toca

- Ninguna lógica de la app, ni RLS, ni edge functions.
- El archivo `.env` en sí no cambia; solo se deja de ignorar.
- La `SUPABASE_SERVICE_ROLE_KEY` y demás secretos privados **no** están en `.env`, viven como secrets de edge functions y siguen protegidos.

## Detalles técnicos

- Archivo a editar: `.gitignore` — eliminar la línea `.env` (línea 26).
- Después de aprobar el plan, ejecuto la edición y llamo a `preview_ui--publish` para regenerar el bundle.
- Verificación: `curl` al JS publicado buscando el string `ddhrrgsejpebblarzmsj.supabase.co` para confirmar que las variables quedaron inyectadas.
