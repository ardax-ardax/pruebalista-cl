# Diagnóstico

No hay "variables de entorno" ni "orígenes autorizados" que yo pueda tocar para arreglar esto. El problema es de **arquitectura de hosting**, no de configuración.

**Estado actual verificado:**
- URL publicada en Lovable: `https://pruebalista-cl.lovable.app` ✅ (funciona)
- Custom domains conectados en Lovable: **ninguno** ❌
- `pruebalista.cl` está sirviéndose desde **Vercel** (hosting externo)

**Por qué da 404 el login con Google:**
Lovable Cloud Auth (managed Google OAuth) funciona a través de un proxy interno en las rutas `/~oauth/initiate` y `/~oauth/callback`. Ese proxy **solo existe en la infraestructura de hosting de Lovable** (worker que redirige a `oauth.lovable.app`). Vercel no tiene ese worker → cuando Google intenta devolver al usuario a `https://pruebalista.cl/~oauth/callback`, Vercel responde 404 porque esa ruta no existe en tu deploy.

Esto **no** se arregla:
- Agregando `pruebalista.cl` a una lista de orígenes autorizados (no existe tal lista editable en Cloud managed OAuth).
- Cambiando `redirect_uri` en el código.
- Configurando nada en Google Cloud Console.
- Agregando variables de entorno en Vercel.

# Solución: mover el dominio a Lovable

Hay que desconectar `pruebalista.cl` de Vercel y conectarlo como Custom Domain dentro de Lovable. Es la única forma de que el broker OAuth funcione en tu dominio.

## Pasos que harás tú (yo no puedo tocar DNS ni Vercel)

1. **En Vercel**: eliminar el dominio `pruebalista.cl` del proyecto (Project Settings → Domains → Remove). Esto libera el dominio.
2. **En tu registrador de DNS**: eliminar los registros A/CNAME que apuntan a Vercel.
3. **En Lovable**: Project Settings → Project → Domains → **Connect Domain** → `pruebalista.cl`. Añadir también `www.pruebalista.cl` como entrada separada.
4. **En tu registrador de DNS**: crear los registros que te muestra Lovable:
   - `A @ → 185.158.133.1`
   - `A www → 185.158.133.1`
   - `TXT _lovable → <valor de verificación que muestre Lovable>`
   - Si usas Cloudflare proxy, marca la casilla "Domain uses Cloudflare or a similar proxy" en el diálogo (usa CNAME en vez de A).
5. Esperar propagación DNS (minutos a 72h, normalmente <1h) y que Lovable emita SSL automáticamente. Estado en Domains debe pasar por: Verifying → Setting up → **Active**.
6. Probar login con Google en `https://pruebalista.cl` — funcionará sin ningún cambio de código.

## Qué NO necesitas hacer

- No hay que tocar `useAuth.tsx`, `Landing.tsx`, ni `lovable.auth.signInWithOAuth`. El código ya usa `redirect_uri: window.location.origin`, que es la forma correcta.
- No hay que crear credenciales OAuth propias en Google Cloud Console.
- No hay que pedir a Lovable que "autorice" el dominio: al conectarlo como Custom Domain, queda auto-incluido en el allowlist del broker OAuth.

## Alternativa (si quieres seguir en Vercel)

No es viable con Lovable Cloud managed OAuth. Tendrías que:
- Migrar a Supabase auto-gestionado (desconectar Cloud, no soportado en este proyecto una vez habilitado), y
- Configurar credenciales OAuth propias en Google Cloud Console con `https://pruebalista.cl` como Authorized redirect URI.

**No lo recomiendo**: es un desmontaje mayor y perderías la gestión unificada.

## Mi rol en el siguiente turno

Una vez que digas "listo, ya moví el dominio a Lovable", yo puedo:
- Verificar con `project_urls--get_urls` que el custom domain aparece como Active.
- Reejecutar `supabase--debug_oauth_server` para confirmar que el Site URL y el consent path están correctos.
- Ayudar a debuggear si sale un error distinto al 404.

No modifico código en este plan porque el fix no es de código.
