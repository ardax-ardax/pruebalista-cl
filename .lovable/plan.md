# Compactar la landing page

La landing actual usa mucho padding vertical (`py-14 sm:py-20`), tarjetas grandes y secciones apiladas de ancho completo. En móvil eso obliga a mucho scroll. Propuesta: reducir aire, densificar tarjetas y colapsar contenido secundario en móvil — sin cambiar el contenido ni el diseño visual base.

## Cambios propuestos en `src/pages/Landing.tsx`

**1. Reducir padding vertical global**
- Secciones: `py-14 sm:py-20` → `py-8 sm:py-14`.
- Hero: `pt-14 pb-16 sm:pt-20 sm:pb-24` → `pt-8 pb-10 sm:pt-16 sm:pb-20`.
- Encabezados de sección: margen inferior `mb-10` → `mb-6 sm:mb-8`.

**2. Hero más compacto en móvil**
- Título `text-3xl sm:text-5xl` → `text-2xl sm:text-5xl`, quitar `<br/>` en móvil (una sola línea fluida).
- Bajar tamaño del párrafo en móvil (`text-sm sm:text-lg`).
- Botones en fila desde móvil (`flex-row`, tamaño `default` en móvil, `lg` en desktop).

**3. Densificar tarjetas**
- Features grid: pasar a 2 columnas en móvil (`grid-cols-2 lg:grid-cols-3`), padding `p-5` → `p-4`, icono más chico.
- Cómo funciona: en móvil, layout horizontal (icono/número a la izquierda, texto a la derecha) en lugar de tarjetas apiladas grandes.
- "Para quién": `p-6` → `p-5`, gap reducido.

**4. Planes: carrusel horizontal en móvil**
- En móvil, mostrar los 3 planes en scroll horizontal con snap (`flex overflow-x-auto snap-x`) en lugar de apilados verticalmente. En desktop se mantiene el grid de 3 columnas.

**5. FAQ colapsable**
- Reemplazar las tarjetas expandidas por un `<Accordion>` de shadcn — solo se ve la pregunta, se abre al tocar. Reduce muchísimo el scroll en móvil.

**6. CTA final más discreto**
- Quitar el ícono grande, reducir a un bloque compacto de ~1/3 del tamaño actual.

**7. Header más apretado**
- Altura `h-14` → `h-12` en móvil.

## Fuera de alcance
- No cambio contenido (textos, features, FAQ, planes).
- No cambio la paleta ni tipografía.
- No toco `/auth` ni otras rutas.

## Resultado esperado
Landing con ~40% menos scroll vertical en móvil, misma información, misma jerarquía visual. Desktop prácticamente igual (los ajustes se concentran en breakpoints `< sm`).
