# Guía paso a paso: mover `pruebalista.cl` de Vercel a Lovable

Voy a acompañarte en cada paso. No toco código — todo el trabajo es en 3 paneles externos: **Vercel**, tu **registrador de DNS** (donde compraste el dominio), y **Lovable**.

---

## Paso 1 — Averiguar dónde tienes el DNS

Antes de empezar, necesito saber dónde compraste `pruebalista.cl` (NIC Chile, GoDaddy, Namecheap, Cloudflare, etc.). Ahí es donde vas a editar los registros DNS.

👉 Si no estás seguro, dime el nombre del proveedor y te doy instrucciones específicas de dónde está el panel de DNS.

---

## Paso 2 — Quitar el dominio de Vercel

1. Entra a [vercel.com](https://vercel.com) y abre tu proyecto.
2. Menú superior → **Settings** → **Domains**.
3. Busca `pruebalista.cl` y `www.pruebalista.cl` en la lista.
4. Clic en el botón `⋯` a la derecha de cada uno → **Remove**.
5. Confirma. Vercel dejará de responder para ese dominio (el sitio en `pruebalista.cl` empezará a fallar temporalmente — es esperado, dura hasta que termines el paso 4).

---

## Paso 3 — Borrar los registros DNS viejos que apuntan a Vercel

En el panel de tu registrador de DNS (paso 1), busca la zona DNS de `pruebalista.cl` y **elimina** cualquier registro que apunte a Vercel:

- Cualquier `A` con valor `76.76.21.21` (IP de Vercel).
- Cualquier `CNAME` con valor que termine en `.vercel-dns.com` o `cname.vercel-dns.com`.
- Registros para `@` (raíz) y `www` que apunten a Vercel.

⚠️ **No borres** los registros `MX`, `TXT` de correo (SPF/DKIM/DMARC), ni nada relacionado a email si usas correo en ese dominio.

---

## Paso 4 — Conectar el dominio en Lovable

1. En Lovable, arriba a la izquierda, clic en el **nombre del proyecto** → **Settings**.
2. En la sección **Project** → **Domains** → botón **Connect Domain**.
3. Escribe `pruebalista.cl` → Continuar.
4. Repite y añade también `www.pruebalista.cl` como entrada separada.
5. Lovable te mostrará los registros DNS que debes crear. Serán algo así:

   ```
   Tipo   Nombre     Valor
   A      @          185.158.133.1
   A      www        185.158.133.1
   TXT    _lovable   lovable_verify=XXXXXXXX   (el valor exacto lo muestra Lovable)
   ```

6. Si usas Cloudflare (o cualquier proxy DNS), en el diálogo de conectar dominio marca la casilla **"Domain uses Cloudflare or a similar proxy"** — cambia de A a CNAME.

---

## Paso 5 — Crear los registros DNS nuevos

Vuelve al panel de tu registrador y crea los 3 registros del paso anterior con los valores exactos que te mostró Lovable.

---

## Paso 6 — Esperar propagación

- Normalmente **5–30 minutos**, máximo 72 horas.
- En Lovable, la pantalla de Domains mostrará el estado: **Verifying → Setting up → Active**.
- Puedes verificar propagación en [dnschecker.org](https://dnschecker.org) buscando `pruebalista.cl` tipo A — debe mostrar `185.158.133.1` desde varias regiones.

---

## Paso 7 — Marcar `pruebalista.cl` como Primary

Cuando ambos (raíz y www) estén **Active** en Lovable, marca `pruebalista.cl` como **Primary domain** para que `www` redirija al dominio principal.

---

## Paso 8 — Avisarme

Cuando el estado sea **Active**, dime "listo" y yo verifico:
- Que el custom domain aparezca correctamente conectado.
- Que el broker OAuth de Google responda bien en `pruebalista.cl`.
- Pruebo el flujo de login con Google.

---

## Si te trabas en algún paso

Dime en cuál y qué ves en pantalla (o pega una captura). Los puntos más comunes donde la gente se atasca:
- **No encuentran dónde editar DNS** → dime el registrador y te guío.
- **Cloudflare naranja/gris (proxy)** → hay que decidir si mantener proxy o no.
- **NIC Chile** → el panel es peculiar, te doy instrucciones específicas si es tu caso.

¿Empezamos? Cuéntame en qué registrador tienes el dominio y arrancamos por el paso 1.
