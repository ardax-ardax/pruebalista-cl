

# Tablas anidadas, descarga sin cambios, e imagen recortada

Tres correcciones al procesador de documentos para mejorar el aprovechamiento de hoja, garantizar que la descarga refleje los cambios y evitar que las imágenes queden recortadas.

## 1. Tablas que no se dividen entre páginas + tablas anidadas

**Diagnóstico**: en Word, una tabla NO se parte entre dos hojas cuando:
- alguna fila tiene `<w:cantSplit/>` (forzado a no dividirse), o
- la tabla está **anidada** dentro de la celda de otra tabla (Word nunca divide tablas anidadas), o
- la fila tiene una altura fija con `w:hRule="exact"` muy grande, o
- hay un `<w:keepNext/>` que ata la tabla al párrafo siguiente.

Esto desperdicia hoja: si una fila/tabla no cabe, Word la baja completa a la página siguiente y deja media hoja en blanco.

**Solución en `src/lib/docx-processor.ts`** — nueva función `optimizeTablesString(xml)` que se llama después de `applyParagraphFormattingString`:

1. **Permitir división de filas**: eliminar todo `<w:cantSplit/>` dentro de `<w:trPr>` para que las filas largas puedan partirse al final de la página.
2. **Liberar alturas fijas**: convertir `w:hRule="exact"` a `w:hRule="atLeast"` en `<w:trHeight>` para que las filas crezcan según contenido sin bloquear el corte de página.
3. **Quitar `keepNext` en tablas**: eliminar `<w:keepNext/>` dentro de `<w:tblPr>` y dentro de los `<w:pPr>` de los párrafos que están inmediatamente antes de una tabla, salvo que sean encabezados.
4. **Desanidar tablas "ocultas"**: detectar tablas que están dentro de una celda (`<w:tc>…<w:tbl>…</w:tbl>…</w:tc>`) cuyo único contenido relevante es esa subtabla (es decir, la tabla externa se usa como "marco" y por eso bloquea el corte). En esos casos, "aplanar" — sacar la tabla interior al nivel del cuerpo y descartar el envoltorio. Para tablas anidadas legítimas (con texto u otras celdas relevantes alrededor), se dejan como están pero se les permite dividir filas.
5. **Marcar headers de tabla repetibles** (opcional): si la primera fila tiene `<w:tblHeader/>`, se conserva — Word la repite en cada página.

Los cambios usan regex acotados sobre el XML (mismo enfoque actual) para no romper namespaces.

## 2. La descarga "no muestra cambios"

**Diagnóstico**: hay dos causas posibles a corregir simultáneamente:

a) **Caché del nombre de archivo**: si el usuario descarga dos veces seguidas con el mismo nombre, el navegador puede reabrir la versión vieja. Se va a añadir un sufijo de marca de tiempo (`HH-mm`) al final del nombre cuando el usuario no llene los campos del paso 3, y forzar siempre un `Blob` nuevo.

b) **Casos en los que el regex no aplica nada**: si `document.xml` no contiene `<w:sectPr>` (algunos .docx exportados desde Google Docs lo omiten al cierre del body), `applyMarginsString` no inserta nada. Se va a:
   - detectar la ausencia y crear un `<w:sectPr>` mínimo justo antes de `</w:body>` con `pgSz` + `pgMar` correctos,
   - registrar un cambio explícito en el reporte ("Sección creada: márgenes y tamaño aplicados") para que el usuario vea evidencia.

c) **Verificación visible**: el banner institucional ya se inserta siempre para las plantillas del colegio. Como verificación extra, se añadirá el reporte "Banner insertado al inicio del cuerpo" con un check para abrir el panel "Cambios aplicados". Si el usuario aún ve el documento "igual", es porque está abriendo el original — se mostrará un aviso suave junto al botón de descarga: *"Si no ves los cambios, asegúrate de abrir el archivo recién descargado, no el original."*

## 3. Imagen recortada en la última página

**Diagnóstico**: la última imagen se ve recortada en Word pero la previsualización (mammoth) la muestra completa porque mammoth ignora márgenes. Pasa cuando:
- La imagen es más alta que el espacio vertical útil de la hoja (después de aplicar márgenes 2/2 cm en hoja oficio), por lo que Word la corta visualmente al borde inferior.
- O la imagen está dentro de una tabla con `w:cantSplit` y no se baja a página nueva.

**Solución**: nueva función `fitOversizedImagesString(xml, template)`:

1. Calcular el alto útil de la hoja en EMU: `(altoCm - margenSup - margenInf) * 360000`. Para hoja Oficio con 2,5/2 márgenes ≈ 10,4 millones EMU.
2. Calcular el ancho útil similar.
3. Recorrer cada `<wp:extent cx="X" cy="Y"/>` (tanto en `<wp:inline>` como en `<wp:anchor>`).
4. Si `cy > altoÚtil * 0.95` o `cx > anchoÚtil`, escalar proporcionalmente para que entre, actualizando también el `<a:ext>` interno del drawing.
5. Para imágenes flotantes/ancladas (`<wp:anchor>`) que se posicionan fuera del flujo, además forzar `behindDoc="0"` y `layoutInCell="1"` para evitar superposiciones.
6. Las imágenes pequeñas no se tocan.

Esto garantiza que ninguna imagen exceda el área imprimible y que el banner adicional al inicio no empuje contenido fuera del área útil.

## Cambios técnicos resumidos

- `src/lib/docx-processor.ts`:
  - Nueva función `optimizeTablesString(xml)` — punto 1.
  - Nueva función `fitOversizedImagesString(xml, template)` — punto 3.
  - Modificar `applyMarginsString` para crear `<w:sectPr>` si no existe — punto 2b.
  - Encadenar las nuevas funciones después de las existentes en `applyTemplate`.
  - Agregar entradas correspondientes en el reporte de cambios.

- `src/pages/Index.tsx`:
  - `handleDownloadDocx`: añadir sufijo de marca de tiempo si no hay datos del paso 3, para evitar colisiones de nombre.
  - Mensaje informativo discreto bajo el botón "Descargar .docx": "Asegúrate de abrir la versión recién descargada".

## Resultado

- Tablas largas se parten correctamente entre páginas y se aprovecha toda la hoja.
- Tablas "marco" (anidadas innecesarias) se aplanan automáticamente.
- Imágenes que excedían la página ahora se escalan para caber completas.
- La descarga siempre refleja los cambios aplicados, con nombre único cuando hace falta y aviso claro al usuario.

