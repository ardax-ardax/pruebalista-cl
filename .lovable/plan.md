## Problema

La landing sigue con mucho aire vertical en móvil y desktop: cada sección tiene su propio `py-8 sm:py-14` + `border-t` + encabezado centrado con subtítulo + grid con `gap` grande. Son 7 bloques apilados (Hero, Cómo funciona, Características, Para quién, Planes, FAQ, CTA, Footer) — mucho scroll para poca información.

## Cambios en `src/pages/Landing.tsx`

**1. Reducir padding vertical de todas las secciones**
- `py-8 sm:py-14` → `py-6 sm:py-10` en Cómo funciona, Características, Para quién, Planes, FAQ.
- Hero: `pt-8 pb-10 sm:pt-16 sm:pb-20` → `pt-6 pb-8 sm:pt-12 sm:pb-14`.
- CTA final: `py-8 sm:py-12` → `py-6 sm:py-10`.
- Encabezados de sección: `mb-6 sm:mb-8` → `mb-4 sm:mb-6`.

**2. Hero más denso**
- Quitar el badge "Alineado al currículum MINEDUC" (redundante con lo que dice el título/features).
- `space-y-4 sm:space-y-6` → `space-y-3 sm:space-y-4`.
- Quitar el `<p>` "Sin tarjeta de crédito…" (ya se ve en Planes).

**3. Fusionar "Cómo funciona" + "Características" en una sola sección**
- Un solo encabezado ("Cómo funciona"), 3 pasos arriba como fila compacta (icono + texto en una línea, sin Card), y debajo la grilla de features 2 col móvil / 3 col desktop. Elimina un `border-t`, un encabezado y un bloque de padding completo.

**4. "Para quién": convertir a 2 tarjetas horizontales compactas**
- Quitar botones internos (el CTA final ya cumple esa función).
- `p-5 space-y-2` → `p-4 space-y-1.5`, icono `h-10 w-10` → `h-8 w-8`.

**5. Planes más compactos**
- Card padding `p-5 sm:p-6` → `p-4 sm:p-5`, `space-y-4` → `space-y-3`.
- Precio `text-2xl sm:text-3xl` → `text-xl sm:text-2xl`.
- Lista de features: máximo 4 items visibles (truncar el resto con "y más").

**6. Fusionar CTA final + Footer**
- Eliminar la sección CTA final independiente. Mover un botón compacto "Comenzar gratis" al Footer, en la fila derecha junto a los links.

**7. Ancho máximo unificado**
- Pasar todas las secciones a `max-w-5xl` (hoy mezcla `max-w-3xl`, `max-w-5xl`, `max-w-6xl`) — visualmente más consistente y evita "columnas vacías" en desktop.

## Fuera de alcance
- No cambia contenido textual (features, FAQ, planes, precios).
- No toca `/auth`, `usePlans`, ni rutas.
- No cambia paleta, tipografía ni tokens.

## Resultado esperado
Landing con ~30-40% menos alto total, una sección menos (fusión Cómo funciona + Características), sin CTA final duplicado. Móvil: casi todo entra en 2 scrolls. Desktop: sin franjas vacías laterales.
