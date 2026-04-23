

# Saltos de página en preview + imagen MC ocupa toda su columna

## Problema 1: Mostrar saltos de página en el preview

Hoy el preview renderiza una sola "hoja" continua con `minHeight = pageSize.heightCm`. Si el contenido excede el alto, se hace scroll dentro de la misma hoja — no hay indicación visual de dónde Word/PDF haría el corte de página.

## Problema 2: Imagen en columna (split MC) limitada al ancho de la imagen

En layout `side-right` / `side-left`, la columna de imagen ocupa el 20% de la fila pero la imagen solo se dibuja al ancho relativo `widthPct` (10–50% del **ancho de página**, no de la columna). Resultado: la imagen casi siempre se ve mucho más chica que la columna que la contiene. Lo que se quiere es que en este layout la imagen rellene **el 100% del ancho de su columna**, manteniendo proporción y sin exceder verticalmente el alto del bloque de opciones.

---

## Solución 1: Paginado visual en preview

Implementar un componente `PaginatedPreview` que reemplaza el contenedor único actual por una secuencia de "hojas" estilo Word.

### Estrategia: medir y partir tras render

Renderizar primero todo el HTML invisible para medirlo, luego repartir los nodos hijos en páginas según altura útil disponible.

1. **Componente nuevo** `src/components/test-builder/PaginatedAssessmentPreview.tsx`:
   - Hace un primer render off-screen (`visibility:hidden; position:absolute`) del HTML completo dentro de un contenedor con el ancho exacto de la página (`widthCm` − márgenes).
   - Mide cada bloque hijo de primer nivel (banner, student-row, title, instructions, cada `.pa-question`, `.pa-section-title`, `.pa-info-block`) usando `offsetHeight`.
   - Distribuye los bloques en páginas: acumula altura hasta alcanzar el `usableHeightPx` (alto de página menos márgenes superior/inferior). Cuando el siguiente bloque no entra, abre nueva página.
   - Bloques marcados `page-break-inside: avoid` se mueven enteros a la siguiente página si no entran.
   - Renderiza N divs `.pa-page` (uno por página) con `width: widthCm`, `height: heightCm`, `padding: márgenes`, `box-shadow`, separados por `gap` visible, mostrando dentro de cada uno los nodos correspondientes.

2. **Reuso del HTML actual**: usamos el HTML producido por `renderAssessmentHtml` (parseado a un fragmento DOM), partimos los hijos del `.pa-page` interno y los re-distribuimos en las hojas paginadas. Sin duplicar lógica de render.

3. **Indicador visual**: gap de 24px con fondo gris entre hojas + número de página (`Página X de N`) en pie discreto.

4. **Recálculo**: `useLayoutEffect` con dependencias en `ctx` (re-pagina cuando cambia el contenido) y `ResizeObserver` por si cambia el zoom del navegador.

5. **`AssessmentPreview.tsx`** (componente envoltorio actual) pasa a usar `PaginatedAssessmentPreview` en vez de `AssessmentPreviewRender` directo.

### Notas
- Solo afecta el **preview**. PDF/DOCX no cambian (Word ya hace su propio paginado nativo).
- Como usamos las mismas reglas CSS `page-break-inside: avoid`, las páginas del preview coinciden razonablemente con las del PDF.

---

## Solución 2: Imagen ocupa el 100% del ancho de su columna en MC split

### Cambios

**`src/lib/assessment-render.tsx` → `renderContainedImageHtml`:**
- El wrapper `.pa-mc-image .pa-image-wrap` ya tiene `width: 100%`. Modificar la `<img>` o el `<span class="pa-image-crop">` para que ocupe `width: 100%` (no el `widthPct` global de la imagen).
- Mantener el `aspect-ratio` calculado a partir del crop para no deformar.
- Mantener `max-height: 100%` del wrapper (ya existe vía `.pa-mc-image` con `height: 1px` que iguala con la celda de opciones), de modo que si la imagen escalada a 100% de ancho excede el alto del bloque de opciones, se reduce manteniendo proporción (object-fit equivalente).
- Para el caso **sin crop**, mantener `<img class="pa-image-plain">` pero con `width: 100%; height: auto; max-height: 100%; object-fit: contain;` para que escale al máximo posible respetando el alto.
- Para el caso **con crop**, el `<span class="pa-image-crop">` queda con `width: 100%` (ya estaba). Pero para que también respete el `max-height`, usar el truco: si `aspect-ratio * columnWidth > columnHeight`, el navegador con `aspect-ratio` no recorta solo. Solución: envolver con `display:flex; align-items:flex-start; justify-content:center` (ya está) y agregar al `.pa-image-crop` `max-width: 100%` y un `min(100%, calc(100% * ratio))` no es trivial en CSS. La regla más sencilla es: dejar `width: 100%`, `aspect-ratio: ratio`, y dentro `max-height: 100%; max-width: 100%; aspect-ratio: ratio;` — el CSS moderno lo respeta y la imagen se reduce manteniendo la proporción.

**Resumen CSS afinado** (en `.pa-mc-image`):
```
.pa-mc-image .pa-image-wrap { width: 100%; height: 100%; max-height: 100%; }
.pa-mc-image .pa-image-crop { width: 100%; max-width: 100%; max-height: 100%; }
.pa-mc-image .pa-image-plain { width: 100%; max-width: 100%; max-height: 100%; height: auto; object-fit: contain; }
```

Eliminar el `width: ${wrapperWidth}` (que usaba `img.widthPct`) en `renderContainedImageHtml`, ya que el ancho lo determina la columna.

**`src/lib/assessment-docx.ts` (rama `isSplit`):**
- El `buildImageRun` para split actualmente usa `q.image.widthPct` clamped. Cambiar para que en split use el ancho de la celda (ya disponible vía `splitImageCellWidthPct` o constante interna). Calcular `widthPx` = ancho de celda en px, y `heightPx` = `widthPx * (cropH / cropW)` con tope = `optionsHeightEstimatePx` (que ya existe en la rama isSplit por el fix anterior).
- Si el alto resultante excede el tope, recalcular `widthPx = topePx * (cropW / cropH)` para reducir manteniendo proporción.

---

## Archivos a crear/modificar

- **Crear** `src/components/test-builder/PaginatedAssessmentPreview.tsx` — paginado visual estilo Word.
- **Modificar** `src/components/test-builder/AssessmentPreview.tsx` — usar el componente paginado.
- **Modificar** `src/lib/assessment-render.tsx`:
  - `renderContainedImageHtml`: quitar dependencia de `widthPct`, usar 100% de la columna.
  - CSS `.pa-mc-image`: ajustar `max-width`/`max-height` para garantizar que la imagen no exceda el alto del bloque de opciones.
- **Modificar** `src/lib/assessment-docx.ts`:
  - En la rama `isSplit` de `buildImageRun`/`imageParagraph`, calcular el ancho usando el ancho de la celda de imagen (no `widthPct` del usuario) y aplicar el tope vertical de `optionsHeightEstimatePx`.

## Resultado esperado

- El preview muestra hojas separadas con gap visible y numeración, igual que Word.
- Cuando agregás una imagen a una pregunta de selección múltiple en columna (`side-right`/`side-left`), la imagen ocupa todo el ancho disponible de su columna, alineada según el layout, y se reduce automáticamente si excede el alto del bloque de opciones.
- Sin cambios de schema; borradores existentes siguen funcionando.

