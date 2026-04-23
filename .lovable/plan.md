

# Comparador antes/después + control de zoom en la previsualización

Dos mejoras de UX en la pantalla principal para que puedas detectar discrepancias visuales antes de descargar el `.docx`.

## 1. Vista comparativa "Original vs. Estandarizado"

Hoy solo se muestra el documento procesado. Vamos a:

- **Renderizar también el documento original** con mammoth a HTML, en paralelo al procesado, y guardarlo en estado (`originalHtml`).
- **Tabs en la tarjeta de previsualización**:
  - `Comparar` (por defecto): vista lado a lado — Original a la izquierda, Estandarizado a la derecha. En pantallas chicas se apilan vertical.
  - `Solo estandarizado`: vista actual a ancho completo.
  - `Solo original`: para inspeccionar el archivo subido.
- **Scroll sincronizado opcional** entre las dos columnas (toggle con switch "Scroll sincronizado") para detectar fácilmente qué bloque se desplazó.
- Cada panel tendrá su propio header con el nombre del archivo y conteo de páginas estimado (cuenta de saltos `<w:br w:type="page"/>` + 1).

## 2. Detector automático de discrepancias

Antes de pintar la previsualización, comparar los XML del original y procesado para detectar cambios estructurales que suelen "correr" el contenido:

- **Páginas estimadas**: si el procesado tiene más páginas que el original → warning "El documento aumentó de N a M páginas".
- **Imágenes desplazadas**: contar imágenes (`<w:drawing>`) en cada uno; si difiere o si alguna cambió de tamaño significativo (>10%), reportarlo.
- **Tablas modificadas**: contar `<w:tbl>` y filas; si baja → warning "Se eliminó/aplanó una tabla".
- **Saltos de página añadidos**: contar `<w:br w:type="page"/>` en cuerpo (excluyendo el banner que sí añadimos a propósito).

Mostrar los hallazgos como una tarjeta `Alerta de discrepancias` (amarilla) sobre el preview, con lista expandible. Si no hay discrepancias relevantes → tarjeta verde "Sin diferencias estructurales detectadas".

Los conteos los expone `applyTemplate` en un nuevo campo `ProcessResult.diagnostics: { originalPages, processedPages, originalImages, processedImages, originalTables, processedTables, addedPageBreaks }`.

## 3. Control de zoom en la previsualización

Reemplazar el contenedor fijo `p-8 max-h-[640px]` por uno con:

- **Barra de controles** sobre cada panel: botones `−` / `+`, un `Select` con presets (50%, 75%, 100%, 125%, 150%) y botón "Ajustar a ventana".
- Implementación: aplicar `transform: scale(zoom)` con `transform-origin: top left` al contenido HTML, y compensar el ancho del contenedor (`width: ${100/zoom}%`) para que el scroll horizontal funcione bien al hacer zoom in.
- El zoom es independiente para cada panel en modo comparar, o compartido si "Scroll sincronizado" está activo.
- Persistir el zoom elegido en `localStorage` (`preview-zoom`) para recordar la preferencia.

## Cambios técnicos

`src/lib/docx-processor.ts`:
- Añadir `diagnostics` a `ProcessResult` con los conteos descritos.
- Calcular conteos haciendo regex sobre el `document.xml` original (antes de procesar) y el final.

`src/pages/Index.tsx`:
- Nuevo estado: `originalHtml`, `diagnostics`, `zoomLeft`, `zoomRight`, `previewMode` (`compare | processed | original`), `syncScroll`.
- En `processDocument`, después de leer el buffer original, generar `originalHtml` con mammoth en paralelo a la conversión actual.
- Reemplazar la tarjeta "Vista previa" por un componente nuevo `<DocumentPreview>` que encapsule tabs, controles de zoom y scroll sincronizado.

`src/components/DocumentPreview.tsx` (nuevo):
- Recibe `originalHtml`, `processedHtml`, `template`, `diagnostics`.
- Renderiza tabs, panel(es), barra de zoom, panel de discrepancias.
- Implementa scroll sincronizado con `onScroll` + `ref` cruzados.

`src/components/DiscrepancyAlert.tsx` (nuevo, pequeño):
- Recibe `diagnostics` y renderiza la tarjeta verde/amarilla con lista de hallazgos.

## Resultado esperado

- Antes de descargar puedes ver original y estandarizado lado a lado, con scroll sincronizado para detectar qué bloque se "corrió".
- Una tarjeta clara avisa si el documento creció en páginas, perdió tablas o cambió cantidad de imágenes.
- Puedes hacer zoom in/out de cada panel para revisar detalles finos (tipografía, recortes de imagen, espaciados) sin depender de abrir Word cada vez.

