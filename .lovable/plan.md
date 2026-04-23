

# Fix línea separadora inconsistente + recorte de imagen en Word

## Problema 1: Separador entre preguntas inconsistente

La regla actual:
```css
.pa-question { border-bottom: 0.4pt dashed #b8b8b8; }
.pa-question:last-child { border-bottom: none; }
```

Causas de la inconsistencia visual:
1. **`section-title` e `info-block` NO están dentro de `.pa-question`** — son divs hermanos. Cuando una pregunta va seguida de un `section-title` (que ya tiene su propio `border-bottom: 0.75pt solid`) o un `info-block` (con fondo gris y borde izquierdo), visualmente el separador dashed o se duplica o se pierde junto a esos elementos.
2. **`0.4pt` es sub-pixel en muchos motores de impresión** → desaparece en algunas posiciones según el zoom/redondeo.
3. **`page-break-inside: avoid`** puede dejar el `border-bottom` justo en el límite inferior de la página, donde el motor lo recorta.

### Solución
- Subir el grosor a `0.75pt` (igual que el banner) para garantizar render consistente en print.
- Cambiar a línea continua `solid` color `#d0d0d0` (mejor que dashed para grosores delgados; dashed con 0.4pt se renderiza como puntos irregulares).
- Reemplazar `:last-child` por una clase explícita `.pa-question.pa-no-sep` aplicada cuando la **siguiente pregunta** sea `section-title` o `info-block` (porque esos ya aportan su propia separación visual fuerte) o cuando sea la última pregunta del documento. Así nunca aparece doble separador.

Cambios en `src/lib/assessment-render.tsx`:
- En el CSS: `.pa-question { ... border-bottom: 0.5pt solid #d0d0d0; }` y eliminar la regla `:last-child`.
- En el bucle de render (`assessment.questions.map`): mirar `assessment.questions[i+1]`. Si no existe, o su `type` es `section-title` o `info-block`, agregar `pa-no-sep` a la clase del wrapper. Definir `.pa-no-sep { border-bottom: none; padding-bottom: 0; }`.

## Problema 2: Imágenes deformadas / sin crop visible al descargar el .docx

Causa raíz: `buildImageRun` calcula `widthPx`/`heightPx` con la proporción del **área visible** del crop, pero embebe la imagen **completa, sin recortar**. Word recibe la imagen original y la escala a esas dimensiones — resultado: la imagen entera se aplasta dentro del rectángulo del crop, deformándose y mostrando todo el contenido (no el recorte).

`docx-js` genera `<a:srcRect/>` vacío y **no expone API pública** para configurar el recorte nativo de Word, así que no podemos delegar el crop al motor de Word vía la librería.

### Solución
Pre-recortar la imagen con un `<canvas>` antes de embedirla. Función nueva `cropImageDataUrl(img: QuestionImage): Promise<{ data: Uint8Array; type; naturalW; naturalH }>`:
1. Cargar el `dataURL` en un `Image`.
2. Crear un canvas con dimensiones `natW * visibleW/100` × `natH * visibleH/100`.
3. `ctx.drawImage(img, -L%*natW, -T%*natH, natW, natH)` para volcar solo el área visible.
4. Exportar a PNG (`canvas.toDataURL("image/png")`) y devolver bytes + nuevas dimensiones naturales (las del recorte).
5. Cachear por `(src + crop)` para no re-procesar la misma imagen.

Refactor en `src/lib/assessment-docx.ts`:
- `buildImageRun` pasa a ser `async` (o se hace el pre-crop antes y se le pasa el resultado ya recortado).
- Como `Document`/`ImageRun` se construyen sincrónicamente, la solución limpia es: **antes** de armar `children`, recorrer todas las imágenes del assessment (pregunta principal, opciones, statements V/F, logo) y pre-procesar las que tengan crop, almacenando el resultado en un `Map<imgRef, ProcessedImage>`. Luego `buildImageRun` lee del map en vez de `dataUrlToUint8Array(img.src)` directo.
- Las imágenes sin crop (`L=R=T=B=0`) se mantienen tal cual, usando `naturalW/H` originales — sin pasar por canvas (más rápido).
- El cálculo de `heightPx` queda simple: `widthPx * (naturalH / naturalW)` con las dimensiones del recorte ya aplicado.

### Helper a crear
`src/lib/image-crop.ts` con:
- `cropImageDataUrl(img: QuestionImage): Promise<{ data: Uint8Array; type: "png"; width: number; height: number }>`
- `processAssessmentImages(assessment): Promise<Map<string, ProcessedImage>>` — recorre y procesa todas las imágenes con crop, key = `img.src + JSON.stringify(crop)`.

### Flujo nuevo en `exportAssessmentToDocx`
```
1. const imageCache = await processAssessmentImages(assessment)
2. (resto del armado igual, pero buildImageRun consulta imageCache)
```

## Archivos a modificar/crear

- **Modificar** `src/lib/assessment-render.tsx`:
  - CSS: separador `0.5pt solid #d0d0d0`, nueva clase `.pa-no-sep`.
  - Loop de render: detectar siguiente pregunta y aplicar `pa-no-sep` cuando corresponda.
- **Crear** `src/lib/image-crop.ts`:
  - `cropImageDataUrl` y `processAssessmentImages`.
- **Modificar** `src/lib/assessment-docx.ts`:
  - `exportAssessmentToDocx` arma `imageCache` con `await processAssessmentImages(assessment)` antes de construir el documento.
  - `buildImageRun` recibe el `imageCache` (o el `ProcessedImage` ya resuelto) y usa esos bytes/dimensiones cuando hay crop. Para imágenes sin crop, comportamiento actual.
  - El cálculo de `heightPx` se simplifica al usar las dimensiones reales post-crop.

## Resultado esperado

- Todas las preguntas muestran una línea separadora consistente y visible. Cuando la siguiente pregunta es un título de sección o bloque informativo (que ya aporta separación visual fuerte), no se duplica.
- En el .docx descargado, las imágenes aparecen efectivamente recortadas (no deformadas), idénticas al preview/PDF.
- Sin cambios de schema; borradores existentes siguen funcionando.

