

# Arreglar previsualización en blanco: falta dependencia `@tanstack/query-core`

## Diagnóstico

La previsualización no carga porque el build de Vite falla con este error:

```
[vite]: Rollup failed to resolve import "@tanstack/query-core"
from "node_modules/@tanstack/react-query/.../index.js"
```

`@tanstack/react-query@5.83.0` (usado en `src/App.tsx` para envolver la app con `QueryClientProvider`) tiene a `@tanstack/query-core` como dependencia interna, pero ese paquete no está instalado en el `package.json` del proyecto. Sin él, Rollup no puede resolver el import y la build se rompe → la app no se renderiza y solo se ve pantalla en blanco.

Esto no es un problema de tu código (no hiciste cambios en `App.tsx` recientemente); es un desajuste en las dependencias del lockfile que aparece al regenerar el entorno.

## Solución

Instalar `@tanstack/query-core` como dependencia explícita del proyecto, en la versión compatible con `react-query 5.83.0` (la `5.83.x`). Una vez agregada, Rollup la resuelve correctamente, Vite termina la build y la previsualización vuelve a renderizarse normalmente.

No se requieren cambios de código fuente — solo agregar la dependencia.

## Cambios

- `package.json`: añadir `"@tanstack/query-core": "^5.83.0"` en `dependencies`.

## Verificación posterior

- La build de Vite completa sin errores.
- La previsualización muestra de nuevo la pantalla principal del Estandarizador (paso 1: elegir plantilla).
- Toda la funcionalidad existente (banner, optimización de tablas, escalado de imágenes, descarga .docx) sigue intacta.

