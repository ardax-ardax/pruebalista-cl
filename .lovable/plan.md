

# Quitar "Ajustes finos" e igualar alto de imagen MC/VF a la columna de texto

## Problema 1: Ajustes finos sobran
El bloque colapsable "Ajustes finos" (sliders top/bottom/left/right) ya no aporta — el botón **Recortar** abre un diálogo visual completo que cubre el caso. En el modo `allowFullWidth` (MC/VF) además genera ruido visual.

## Problema 2: Imagen MC/VF queda en miniatura
La columna de imagen usa `height: 1px` en el `<td>` esperando que el motor de tablas la estire al alto de la celda hermana. Con `display:flex; align-items:flex-start` y la imagen con `object-fit:contain` + `width:100%`, la imagen se dibuja a su altura intrínseca (proporción natural), no al alto de la columna. Si el bloque de opciones es alto y la imagen es ancha pero baja, queda chica arriba de su celda.

## Cambios

### `src/components/test-builder/ImageCropEditor.tsx`
- **Eliminar por completo** el bloque `<Collapsible>` de "Ajustes finos" (líneas 180–204) y el helper `labelOf`. La edición de crop sigue disponible vía botón **Recortar**.
- Eliminar imports ya no usados: `Slider`, `Collapsible/CollapsibleContent/CollapsibleTrigger`, `ChevronsUpDown`, `localCrop` state y su `useEffect` de sincronización.

### `src/lib/assessment-render.tsx` — CSS `.pa-mc-split` y `.pa-mc-image`
Cambiar la estrategia de igualar alto:
- Mantener `table-layout: fixed` y `height: 1px` en el `<td>` de imagen (sigue siendo el truco para que el `<td>` adopte la altura de la fila).
- En `.pa-mc-image .pa-image-wrap`: usar `height: 100%` con `display: block` (no flex) y centrar via `text-align: center`.
- En `.pa-mc-image .pa-image-plain` (sin crop) y `.pa-mc-image .pa-image-crop` (con crop): forzar **`height: 100%; width: auto; max-width: 100%; object-fit: contain;`** para que la imagen se escale al alto de la celda manteniendo proporción, y solo se reduzca de ancho si excede 100% de la columna.
- Para el caso **con crop** (`.pa-image-crop` con `aspect-ratio` inline): cambiar el comportamiento — en columna MC/VF, ignorar el `aspect-ratio` inline y usar `height:100%; width:auto;` directamente en el wrapper, dejando que `.pa-image-crop-inner` mantenga el recorte vía `overflow:hidden` y posicionamiento absoluto del `<img>` interno (que ya está implementado).

Concretamente:
```css
.pa-mc-image .pa-image-wrap { width: 100%; height: 100%; margin: 0; text-align: center; display: block; }
.pa-mc-image .pa-image-crop { display: inline-block; height: 100%; width: auto; max-width: 100%; aspect-ratio: var(--pa-ar, auto); }
.pa-mc-image .pa-image-plain { display: inline-block; height: 100%; width: auto; max-width: 100%; object-fit: contain; }
```
Y en `renderContainedImageHtml` exponer el aspect-ratio vía CSS var (`style="--pa-ar:${ratio}; ..."`) en lugar de `aspect-ratio:${ratio}` directo, para que el navegador calcule width desde height (cuando hay alto disponible) o height desde width (fallback).

### Sin cambios
- `assessment-docx.ts`: Word ya escala por proporción de columna (no aplica el problema visual del HTML).
- `QuestionEditor.tsx`: sigue pasando `allowFullWidth` para MC/VF.

## Resultado
- Editor de imagen muestra solo: miniatura, **Recortar**, **Quitar** (en MC/VF) o + ancho/alineación (otros tipos). Sin "Ajustes finos".
- En MC/VF la imagen llena verticalmente la columna derecha igualando la altura del bloque de opciones/afirmaciones, manteniendo su proporción y centrada.

