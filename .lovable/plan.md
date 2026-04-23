

# Tres correcciones: tablas de preguntas dañadas, recortes de Word respetados, y cambios visibles

Comparé el documento original (Doc 2) con el descargado (Doc 1) y detecté tres cosas concretas que arreglar.

## 1. El "aplanado de tablas" está rompiendo las tablas de preguntas

**Diagnóstico**: la función `optimizeTablesString` tiene una heurística que detecta "tablas marco" (tablas externas que solo envuelven a una tabla interna decorativa) y las desanida. Pero el conteo `<w:tbl` y `<w:tc` no distingue entre niveles — cuenta TODAS las tablas y celdas anidadas que aparecen dentro del bloque XML coincidente. En el Doc 2, las tablas de 2×3 con preguntas (Items I) contienen drawings y tablas de listas que disparan el detector falsamente: la condición `innerTbls.length >= 2` se cumple y se "aplana" la tabla de preguntas legítima, lo que produce el contenido duplicado y desordenado que se ve en el Doc 1.

**Solución**:
- **Eliminar el aplanado automático de tablas marco** por completo. Es una optimización con falsos positivos demasiado peligrosa para documentos reales con drawings y listas anidadas.
- Mantener las otras tres optimizaciones que sí son seguras: quitar `<w:cantSplit/>`, convertir `hRule="exact"` → `atLeast`, y quitar `<w:keepNext/>`.
- Si en el futuro se quiere recuperar el desanidado, hacerlo solo cuando la tabla externa tenga **exactamente** una `<w:tbl>` interna y cero párrafos con texto (verificación estricta sobre el primer nivel, no por conteo total).

## 2. La última imagen aparece completa en la descarga aunque en el original viene recortada

**Diagnóstico**: en Word, los recortes de imagen se almacenan en `<a:srcRect l="..." t="..." r="..." b="..."/>` (porcentajes/100 del ancho/alto a recortar por cada lado). La función `fitOversizedImagesString` reescribe `<wp:extent>` y `<a:ext>` para reducir el tamaño visible, pero no toca `<a:srcRect>`. Por lo tanto, si la imagen también tenía recorte, el recorte se mantiene pero la imagen visible se hace más chica y la sensación es que el recorte "se pierde". Más importante: en el banner del Doc 1 inyectamos `<a:srcRect/>` vacío en `buildLogoCell`, lo cual es correcto para el logo, pero en `fitOversizedImagesString` cualquier imagen del cuerpo con `srcRect` previo conserva sus valores — entonces el problema real es que **la imagen del Doc 2 es muy grande** (excede `usableH`), se reescala, y al reescalar también se reduce proporcionalmente la zona visible original — en mammoth (la previsualización) el recorte se ignora por defecto, por eso parece que la app muestra la imagen completa pero al abrirla en Word se ve recortada.

**Solución** (orientada a **respetar el recorte original** de Word, no a quitarlo):
- En `fitOversizedImagesString`, cuando se detecte una imagen que excede el área imprimible:
  1. Leer el `<a:srcRect>` existente del drawing.
  2. Calcular las dimensiones **visibles efectivas** (después del recorte): `cxVisible = cx * (1 - l/100000 - r/100000)`, lo mismo para `cyVisible`.
  3. Aplicar el escalado solamente sobre las dimensiones visibles, manteniendo el `srcRect` intacto.
- Asegurar que `<a:srcRect>` con valores se preserve cuando se reescala — actualmente el regex no lo toca, lo cual es correcto, así que el cambio principal es **calcular el escalado sobre el área visible** en lugar del cx/cy completo.
- Aclarar en la previsualización HTML (mammoth) un aviso: "La vista previa puede mostrar las imágenes sin los recortes que aplicaste en Word; el .docx descargado conservará los recortes originales".

## 3. "No hace los cambios" — verificación adicional

El Doc 1 SÍ tiene los cambios aplicados (banner con logo, profesora, asignatura y curso, tipografía, tabla con datos del estudiante). Pero el banner se ve "apretado" comparado con el ejemplo oficial:
- Las tres líneas Profesor/Asignatura/Curso aparecen pero el valor pegado al label sin espacio: "Profesor/a:Marilin Martínez".
- Los `_______` quedan inmediatamente al lado del valor en negrita, no en línea separada.

**Solución cosmética en `buildDataLine`**:
- Añadir un espacio entre la etiqueta y el valor (revisar el `xml:space="preserve"` y los espacios literales).
- Aumentar ligeramente el espacio entre líneas (`w:before="40" w:after="40"`).
- Que la línea de guiones bajos no quede pegada al valor (espacio adicional o tab antes del filler).

## Cambios técnicos resumidos

`src/lib/docx-processor.ts`:
- `optimizeTablesString`: eliminar el bloque del paso 4 (aplanado de tablas marco). Mantener pasos 1, 2 y 3.
- `fitOversizedImagesString`: leer `<a:srcRect>` del drawing y calcular el ratio sobre dimensiones **visibles** (cx − recorte horizontal, cy − recorte vertical), preservando el srcRect tal cual.
- `buildDataLine`: corregir el espaciado entre label, valor y filler para que se lea como en los ejemplos oficiales del colegio.

`src/pages/Index.tsx`:
- Añadir un texto informativo bajo la previsualización: "La vista previa puede no mostrar recortes de imagen aplicados en Word; el .docx descargado conserva los recortes originales del archivo".

## Resultado esperado

- Las tablas de preguntas (Items I, II, etc.) se conservan idénticas al original, sin contenido duplicado o aplanado.
- Las imágenes con recorte aplicado en Word se descargan con su recorte intacto, escaladas solo si lo necesitan.
- El banner muestra "Profesor/a: Marilin Martínez ____________" con el espaciado correcto, igual que los ejemplos oficiales.
- El usuario tiene una nota clara que explica por qué la previsualización puede verse distinta del .docx final en imágenes recortadas.

