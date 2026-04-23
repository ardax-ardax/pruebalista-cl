

# El PDF muestra la imagen completa porque mammoth ignora el recorte (`<a:srcRect>`)

## Causa exacta

El flujo actual es:

1. El `.docx` original tiene imágenes con `<a:srcRect l="..." t="..." r="..." b="..."/>` (recorte aplicado por el autor en Word).
2. Para previsualizar y exportar a PDF, usamos **mammoth.convertToHtml**. Mammoth extrae la imagen como `<img src="data:image/...;base64,...">` con la imagen **completa**, **sin** aplicar el `srcRect` (mammoth no soporta cropping).
3. `exportHtmlToPdf` toma ese HTML y lo manda a la ventana de impresión → el PDF sale con la imagen completa.

El `.docx` descargado sí preserva el recorte (porque `fitOversizedImagesString` deja intactos los `<a:srcRect>` con valores). El problema es solo en la rama PDF / preview.

## Solución: aplicar el recorte en el HTML antes de exportar a PDF

Como mammoth no nos da el dato del crop, lo extraemos nosotros del XML del .docx y lo aplicamos sobre los `<img>` del HTML usando CSS.

### Parte A — Extraer mapa de recortes desde el .docx procesado

Nueva función en `src/lib/docx-processor.ts`:

```ts
export interface ImageCropInfo {
  // identificador estable por imagen (índice secuencial de aparición)
  index: number;
  // valores en porcentaje (0–100), de cada lado, tal cual OOXML
  left: number; right: number; top: number; bottom: number;
}

export function extractImageCrops(docXml: string): ImageCropInfo[]
```

Recorre cada `<w:drawing>` en orden, extrae el `<a:srcRect l="..." t="..." r="..." b="..."/>` (los valores OOXML están en milésimas de porcentaje: `l="10000"` = 10%). Devuelve un array indexado por orden de aparición. Si una imagen no tiene `srcRect`, registra `{0,0,0,0}`.

### Parte B — Aplicar los crops al HTML de mammoth

Nueva utilidad en `src/lib/pdf-export.ts`:

```ts
function applyCropsToHtml(html: string, crops: ImageCropInfo[]): string
```

Para cada `<img>` en orden (mammoth los emite en orden de aparición), si su crop correspondiente tiene algún lado > 0:

- Envolverlo en `<span class="img-crop">…</span>` con `overflow:hidden` y dimensiones derivadas.
- Aplicar al `<img>` interno un `transform: scale(...)` + `margin` negativo, o usar la técnica `clip-path: inset(top% right% bottom% left%)` (más simple y soportada en Chrome print).

Técnica recomendada: **`clip-path: inset()`** + ajuste de tamaño y margen para reservar el espacio visible:

```html
<span style="display:inline-block; overflow:hidden; width:Wpx; height:Hpx;">
  <img src="..." style="
    width: calc(Wpx / (1 - L% - R%));
    height: calc(Hpx / (1 - T% - B%));
    margin-left: calc(-1 * Wpx * L% / (1 - L% - R%));
    margin-top: calc(-1 * Hpx * T% / (1 - T% - B%));
    display: block;
  ">
</span>
```

Donde `W,H` son las dimensiones renderizadas que mammoth ya puso en el `<img>` (atributos `width`/`height` o `style`). Si mammoth no las emite, usar tamaño natural y dejar que CSS lo escale.

Esta técnica es robusta para impresión en Chrome/Edge (la base del `window.print()`).

### Parte C — Integrar en el flujo de exportación

En `src/pages/Index.tsx` `handleDownloadPdf`:

1. Obtener el XML del `.docx` procesado (ya lo tenemos en memoria via `resultBlob`; leer `word/document.xml` con JSZip — ya está como dependencia).
2. `const crops = extractImageCrops(documentXml)`.
3. `const croppedHtml = applyCropsToHtml(previewHtml, crops)`.
4. `exportHtmlToPdf(croppedHtml, fileName)`.

`exportHtmlToPdf` no cambia su firma; solo recibe HTML ya con los crops aplicados.

### Parte D — Aplicar también al preview en pantalla (bonus)

El mismo problema se ve en la previsualización web (la nota actual lo reconoce). Aplicar `applyCropsToHtml` también al `previewHtml` antes de pasarlo a `<DocumentPreview>` para que la vista coincida con el .docx final y con el PDF. Quitar/atenuar la nota disclaimer una vez aplicado.

## Archivos a modificar

- **`src/lib/docx-processor.ts`**: nueva `extractImageCrops(documentXml): ImageCropInfo[]` exportada.
- **`src/lib/pdf-export.ts`**: nueva `applyCropsToHtml(html, crops)`; firma de `exportHtmlToPdf` sin cambios.
- **`src/pages/Index.tsx`**:
  - Guardar el XML del documento procesado (o re-extraerlo de `resultBlob` con JSZip on-demand) en estado.
  - En `handleDownloadPdf` y al setear `previewHtml`, aplicar los crops.
- **`src/components/DocumentPreview.tsx`**: actualizar la nota: ahora los recortes sí se aplican; mantener el aviso solo para layouts complejos / objetos flotantes.

## Resultado esperado

- Las imágenes recortadas en el .docx original (por ejemplo, una foto donde solo se quiere mostrar la mitad) se ven recortadas también en la previsualización web y en el PDF descargado.
- El comportamiento del .docx descargado abierto en Word no cambia (allí ya funcionaba).

