# Plan: Adaptar la app para funcionar embebida (iframe) en WordPress

## Objetivo

Permitir que la app se inserte dentro de una página de WordPress mediante un `<iframe>` y que la experiencia sea correcta a pesar de las limitaciones que impone estar embebida (sobre todo el login con Google, que Google bloquea dentro de iframes).

## Qué hará el usuario final

1. En WordPress pegará un bloque HTML con el iframe apuntando a `https://pruebas-nlc.lovable.app`.
2. La app detectará automáticamente que está embebida y se adaptará:
   - Header más compacto.
   - Botón visible de "Abrir en pantalla completa".
   - En la pantalla de login, aviso claro y botón para abrir la app en una pestaña nueva (necesario para Google OAuth).
3. Una vez autenticado en la pestaña nueva, el usuario puede volver al iframe y la sesión funcionará (siempre que el navegador permita cookies de terceros; en Safari puede no persistir).

---

## Cambios técnicos

### 1. Hook `useIsEmbedded`
Nuevo archivo `src/hooks/useIsEmbedded.ts` que devuelve `true` si `window.self !== window.top`.

### 2. `Auth.tsx` — login adaptado al iframe
Cuando esté embebido:
- Mostrar aviso: *"Por motivos de seguridad de Google, el inicio de sesión no funciona dentro de marcos. Abre la app en pantalla completa para iniciar sesión."*
- Botón principal: **"Abrir en pantalla completa"** → abre `window.top.location` o nueva pestaña con la URL pública.
- Botón secundario (texto pequeño): "Intentar igualmente con Google" por si funciona en algún navegador.

Cuando NO esté embebido: comportamiento actual (botón Google directo).

### 3. `AppLayout.tsx` — header con botón "Abrir en pantalla completa"
- Cuando `isEmbedded` sea `true`, añadir un botón en el header con icono `ExternalLink` que abre la app en una pestaña nueva (rompiendo el iframe).
- Opcional: ocultar el footer "Procesamiento 100% en el navegador..." para ganar espacio vertical cuando esté embebida.

### 4. Snippet de WordPress (entrega)
Te entregaré el HTML listo para pegar en un bloque "HTML personalizado" de WordPress, con versión responsive:

```html
<div style="position:relative;width:100%;height:90vh;min-height:600px;">
  <iframe
    src="https://pruebas-nlc.lovable.app"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;"
    allow="clipboard-write"
    loading="lazy"
    title="Sistema de Pruebas">
  </iframe>
</div>
```

---

## Archivos a crear / editar

- `src/hooks/useIsEmbedded.ts` (nuevo)
- `src/pages/Auth.tsx` (editar)
- `src/components/AppLayout.tsx` (editar)

## Lo que NO se hará en este plan

- No se configura subdominio personalizado (`app.tudominio.com`). Si más adelante quieres esa opción (que resolvería el problema de cookies en Safari y haría que Google login funcione dentro del iframe), lo abordamos en un plan aparte.
- No se modifica la lógica de autenticación ni la base de datos.

## Limitaciones que persisten (informativas)

- **Safari + cookies de terceros**: la sesión puede no persistir dentro del iframe para algunos usuarios. Mitigación real = subdominio propio (Opción C en la conversación previa).
- **Google OAuth dentro del iframe**: bloqueado por Google. Por eso el flujo será "abrir en pestaña nueva para login".

¿Apruebas el plan?
