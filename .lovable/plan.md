

# El .docx descargado no abre en Word: validar el ZIP final y arreglar el banner

## Por qué Word lo rechaza (y mammoth a veces sí lo abría)

Word es **mucho más estricto** que mammoth al leer un `.docx`. Mammoth tolera XML algo malformado mientras encuentre `<w:body>`; Word, en cambio, valida el OOXML contra el esquema y aborta con "El archivo está dañado y no se puede abrir" cuando encuentra cualquiera de estas:

1. **Tabla en el body sin `xmlns` heredado correcto**. `insertInstitutionBanner` (línea 1392) inyecta una `<w:tbl>` con `<w:drawing>` y `<a:graphic>` justo después de `<w:body>`. El namespace `a:` (DrawingML) **no se redeclara** en el `<a:graphic>` cuando ese drawing se crea desde cero — sí en `<wp:inline>` pero no en `<a:graphic>`. Si el `<w:document>` raíz no incluye `xmlns:a` ni `xmlns:pic`, el archivo abre en algunos Word y no en otros. Es la primera causa probable.

2. **Tabla sin `<w:p>` previo**. OOXML exige que el primer hijo del `<w:body>` sea un `<w:p>` o que las tablas estén separadas por `<w:p>`. El banner viola eso al inyectarse como **primer elemento** del body.

3. **`linkPartToSections` (línea 1314–1326)** inserta `<w:headerReference>`/`<w:footerReference>` al inicio del `<w:sectPr>`. El esquema de Word **exige un orden estricto** dentro de `<w:sectPr>`: las `headerReference`/`footerReference` van primero (correcto) pero **antes** debe ir el `<w:type>` solo si existe. Cuando inyectamos el ref **delante de un `<w:sectPr>` ya poblado** estamos asumiendo el orden, pero si el .docx original tiene un elemento que no esperamos (`<w:formProt>`, `<w:bidi>`), queda fuera de orden y Word lo rechaza.

4. **`applyMarginsString` crea un `<w:sectPr>` mínimo** (línea 886) si no existe, con solo `<w:pgSz>` y `<w:pgMar>`, **sin `<w:cols>`**. Word a veces tolera esto y a veces no.

5. **Auto-QA falsos positivos**: `runXmlPass` solo cuenta `<w:p>`, `<w:r>`, `<w:body>`. No detecta:
   - Atributos duplicados en un mismo tag.
   - Caracteres de control inválidos (`\x00`–`\x08`) que el XML 1.0 prohíbe.
   - Un `<wp:inline>` huérfano sin namespace `wp:` declarado.
   - `<w:sectPr>` con elementos en mal orden.

## Plan de arreglo

### Parte A — Validar el ZIP final antes de entregarlo al usuario

Nueva función `validateProcessedDocx(zip)` que se ejecuta **al final de `applyTemplate`**, justo antes de `zip.generateAsync`:

- Parsear `word/document.xml` con `DOMParser` del navegador (`text/xml`). Si devuelve `<parsererror>`, es XML inválido → aborta con mensaje claro: "El archivo procesado quedó con XML inválido en `<X>`. Reportar a soporte."
- Lo mismo para `word/header1.xml`, `word/footer1.xml`, `word/styles.xml`, `word/numbering.xml` y `[Content_Types].xml`.
- Verificar que cada `r:id` referenciado en `document.xml` (ej. `r:embed="rId7"`) **exista** en `word/_rels/document.xml.rels`. Si falta, registrar warning crítico.
- Verificar que cada part listada en `[Content_Types].xml` exista en el ZIP.
- Si el documento tiene **`<w:tbl>` como primer hijo de `<w:body>`**, insertar un `<w:p/>` vacío antes (lo exige el esquema OOXML).

Si la validación encuentra un problema **fatal**, no entregamos el blob: lanzamos `DocxProcessingError("validación final", ...)` para que el toast del frontend explique qué pasó.

### Parte B — Arreglar el banner para que sea XML válido garantizado

`insertInstitutionBanner` y `buildLogoCell`:

- **Asegurar namespaces en el `<w:document>` root**: antes de inyectar el banner, verificar que el elemento raíz `<w:document>` declare `xmlns:wp`, `xmlns:a`, `xmlns:pic`, `xmlns:r`. Si falta alguno, agregarlo (sin tocar los existentes). Esto garantiza que el drawing del logo sea válido independientemente del Word que lo abra.
- **Inyectar un `<w:p/>` separador antes de la tabla** y otro después (ya existe el de después en línea 1409). Esto cumple la regla de OOXML de que `<w:tbl>` no puede ser el primer ni último hijo del body.
- **Escapar el contenido del banner**: el campo `teacher`/`subject`/`grade` ya pasa por `escapeXml`, verificar que no haya rutas que se salten (ej. el label fijo "Profesor/a:" no se escapa pero no tiene caracteres especiales — OK).

### Parte C — Arreglar `linkPartToSections` para respetar orden de `<w:sectPr>`

El esquema OOXML define que dentro de `<w:sectPr>` las `headerReference`/`footerReference` van **al principio**, antes de `<w:footnotePr>`, `<w:pgSz>`, etc. La función ya las pone al inicio (línea 1324: `refTag + updated`), pero **no remueve referencias duplicadas correctamente** si hay varias del mismo tipo con distinto `w:type` ("first", "even", "default"). Cambiar la regex para que solo elimine la de `w:type="default"` (la que estamos por agregar), no todas.

### Parte D — Sanitizar caracteres de control inválidos en el XML final

XML 1.0 no permite `\x00`–`\x08`, `\x0B`–`\x0C`, `\x0E`–`\x1F`. Si el documento original los tiene (a veces vienen de copias-pega desde PDFs), Word los rechaza. Nueva pasada `stripInvalidXmlChars` que se ejecuta al final, sobre `document.xml`, `header1.xml`, `footer1.xml`. Reemplaza esos chars por string vacío.

### Parte E — Mensaje al usuario más útil cuando el archivo no abra

Hoy el toast dice "Documento estandarizado correctamente" aunque el ZIP esté roto. Cambiar a:

- Si `validateProcessedDocx` encuentra issues no fatales (warnings), mostrar toast **amarillo** con "Documento procesado, pero con N advertencias. Si Word lo rechaza, abre la consola para ver el detalle."
- Si encuentra issues **fatales**, mostrar toast **rojo** con "El procesamiento generó un .docx inválido. Detalle técnico: [tag/elemento problemático]". No descargar.

## Cómo voy a confirmar la causa exacta en tu archivo

Cuando se apruebe este plan y pase a default mode:

1. Copio tu archivo subido a `/tmp/`.
2. Descomprimo con `unzip` y leo `word/document.xml`.
3. Reproduzco la pasada localmente (con un script Node que importa `docx-processor.ts`).
4. Comparo el ZIP de salida contra el de entrada y reporto exactamente qué tag rompió Word.

Si la causa real resulta ser distinta a las hipótesis A–D, ajusto el plan antes de tocar el procesador.

## Archivos a modificar

- `src/lib/docx-processor.ts`:
  - Nueva función `validateProcessedDocx(zip)`, llamada al final de `applyTemplate`.
  - Nueva función `stripInvalidXmlChars(xml)`.
  - `insertInstitutionBanner`: inyectar `<w:p/>` antes y asegurar namespaces en `<w:document>`.
  - `linkPartToSections`: solo remover refs `w:type="default"`.

- `src/pages/Index.tsx`:
  - Diferenciar toast según severidad de los warnings de validación final.

## Resultado esperado

- El `.docx` descargado abre en Word sin error de "archivo dañado".
- Si por alguna razón la pasada genera XML inválido, te lo decimos **antes** de descargar, con el detalle del tag problemático, en lugar de dejarte descargar un archivo roto.
- El banner queda con namespaces y separadores correctos para Word, LibreOffice y Google Docs.

