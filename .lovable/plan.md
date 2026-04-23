

# Centrar imagen en columna split y respetar `max-height`

## Problema

En layout MC split (`side-right`/`side-left`), cuando la imagen es más alta que el bloque de opciones, **no se reduce** y tampoco se centra horizontalmente dentro de su columna. Causa: `.pa-mc-image .pa-image-crop` tiene `width: 100%` fijo + `aspect-ratio` + `max-height: 100%`. Con `width` explícito, el navegador NO reduce el ancho aunque `max-height` esté excedido — la imagen desborda en alto y queda pegada a la izquierda.

Además, hoy el wrapper en split siempre se fuerza a `pa-align-center`, ignorando la alineación elegida por el usuario (izquierda / centro / derecha) dentro de la columna.

## Solución

### 1) `src/lib/assessment-render.tsx` — `renderContainedImageHtml`

- Respetar la alineación elegida por el usuario dentro de la columna: usar `pa-align-${img.alignment}` en el wrapper en vez de hardcodear `pa-align-center`.
- Cambiar el `width: 100%` fijo por `max-width: 100%` en `.pa-image-crop` y en la `<img class="pa-image-plain">`. Con ancho `auto` + `aspect-ratio` + `max-height: 100%`, el navegador sí reduce ancho y alto manteniendo proporción.

### 2) CSS `.pa-mc-image` (en `ASSESSMENT_CSS`)

- Cambiar `display: flex; align-items: flex-start; justify-content: center;` del `.pa-mc-image .pa-image-wrap` por reglas que respeten alineación:
  - Mantener `display: flex; align-items: flex-start;`.
  - Quitar `justify-content: center` global. Añadir variantes:
    - `.pa-mc-image .pa-image-wrap.pa-align-left { justify-content: flex-start; }`
    - `.pa-mc-image .pa-image-wrap.pa-align-center { justify-content: center; }`
    - `.pa-mc-image .pa-image-wrap.pa-align-right { justify-content: flex-end; }`
- Cambiar `.pa-mc-image .pa-image-crop` de `width: 100%` a `max-width: 100%; max-height: 100%;` (sin `width` fijo). El `aspect-ratio` se mantiene inline.
- Cambiar `.pa-mc-image .pa-image-plain` para usar `max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;`.

### 3) Sin cambios en DOCX

DOCX ya calcula correctamente el ancho de la celda y el cap de altura. El alignment dentro de la celda se aplica con `AlignmentType` — ajustar el párrafo de la celda de imagen para usar `LEFT`/`CENTER`/`RIGHT` según `q.image.alignment` en vez de forzar `CENTER`.

## Archivos a modificar

- `src/lib/assessment-render.tsx`:
  - `renderContainedImageHtml`: usar `pa-align-${img.alignment}`, quitar `width:100%` fijo en `.pa-image-crop` inline.
  - CSS `.pa-mc-image`: variantes de alineación y `max-width`/`max-height` en lugar de `width: 100%`.
- `src/lib/assessment-docx.ts`:
  - En la rama `isSplit`, mapear `q.image.alignment` a `AlignmentType` del párrafo de la celda de imagen.

## Resultado esperado

- Si el usuario elige alineación "centro", "izquierda" o "derecha", la imagen se posiciona donde corresponde **dentro de la columna del split**.
- Si la imagen recortada excede la altura del bloque de opciones, se reduce manteniendo proporción (no desborda y no se deforma).
- Sin cambios de schema; comportamiento idéntico en preview, PDF y Word.

