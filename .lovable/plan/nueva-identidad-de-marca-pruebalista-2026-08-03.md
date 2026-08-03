# Nueva identidad de marca PruebaLista

Se aplica la paleta, tipografía e isotipo de la guía de marca a todo el sistema de diseño. El nombre visible sigue siendo **PruebaLista.cl**; solo cambia el lenguaje visual.

## Paleta

| Rol | Color | HEX |
| --- | --- | --- |
| Primario (CTA, botones principales) | Turquesa de contraste | #00C6AB |
| Secundario (encabezados, navegación) | Púrpura principal | #3D2C6F |
| Acento (elementos interactivos, selección) | Púrpura de interfaz | #7E67A8 |
| Fondo de secciones y tarjetas suaves | Lavanda suave | #EDE7F6 |
| Fondo principal | Blanco puro | #FFFFFF |
| Texto de párrafo | Negro | #000000 |

## Isotipo y logo

- Genero un isotipo nuevo: recuadro con marca de verificación, degradado púrpura → turquesa, esquinas redondeadas, fondo transparente.
- El logo completo en el header y la portada = isotipo + texto "PruebaLista.cl" en sans-serif limpia (reemplaza el icono de libro actual dentro del cuadro azul).
- El mismo isotipo se usa como favicon y en los estados de carga (`Cargando…` y `ErrorBoundary`).

## Tipografía

- Fuente sans-serif moderna (Inter) cargada para todo el app.
- H1 en púrpura principal, bold. H2–H6 en púrpura principal o púrpura de interfaz, peso medio. Párrafos en negro, peso regular.

## Estilo

- Fondo blanco por defecto, secciones alternadas en lavanda suave, mucho aire y espacio en blanco.
- Bordes redondeados consistentes con el isotipo en botones y tarjetas.
- Botones primarios en turquesa; secundarios/outline en púrpura.

## Detalle técnico

- `src/index.css`: reescribir los tokens HSL en `:root` — `--primary: 172 100% 39%`, `--primary-foreground` oscuro para contraste sobre turquesa, `--secondary: 264 45% 94%` (lavanda), `--secondary-foreground: 255 43% 30%`, `--accent: 261 27% 53%`, `--muted` lavanda claro, `--background: 0 0% 100%`, `--foreground: 0 0% 0%`, `--ring` turquesa, `--radius` ligeramente mayor. Nuevos tokens `--brand-purple`, `--brand-purple-soft`, `--brand-teal`, `--brand-lavender` y `--gradient-brand` (púrpura → turquesa) para el isotipo y detalles. Ajustar el bloque `.dark` a la misma familia (base púrpura oscuro, primario turquesa) para que el modo oscuro siga legible.
- `tailwind.config.ts`: exponer `brand.purple`, `brand.purpleSoft`, `brand.teal`, `brand.lavender`, `bg-gradient-brand` y la familia tipográfica `sans` → Inter.
- `index.html`: `<link>` a Inter, `<link rel="icon" href="/favicon.png" type="image/png">`, y actualizar title/description/OG a la marca.
- Generar `src/assets/isotipo-pruebalista.png` (transparente) y crear `public/favicon.png` cuadrado desde ese asset; borrar `public/favicon.ico`.
- `src/components/AppLayout.tsx`: sustituir el bloque `BookOpen` sobre `bg-gradient-primary` por el isotipo generado; headers/nav en púrpura.
- `src/pages/Landing.tsx`: logo nuevo en el header, secciones alternando blanco / lavanda, H1–H2 en púrpura, CTAs en turquesa, tarjetas con radio redondeado.
- `src/pages/Auth.tsx`: mismo logo en la tarjeta de acceso y botones primarios en turquesa.
- `src/App.tsx` (`RouteFallback`) y `ErrorBoundary`: isotipo en la pantalla de carga/error.
- Revisión final de contraste en claro y oscuro (texto sobre turquesa y sobre lavanda) sin introducir clases de color fijas — todo vía tokens semánticos.
