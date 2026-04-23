

# Arreglar error "Could not find the body element" al subir documentos con imágenes y tablas

## Diagnóstico

El documento que subiste es un .docx **válido** con imágenes, tablas y elementos de dibujo (drawings). El error `Could not find the body element: are you sure this is a docx file?` no significa que el archivo original esté mal — significa que **nuestro procesador está corrompiendo el .docx al volver a guardarlo**.

La causa raíz está en `src/lib/docx-processor.ts`: usamos el `DOMParser` y `XMLSerializer` del navegador para modificar los XML internos del .docx. Estos APIs del navegador tienen problemas conocidos con documentos OOXML que usan:

- Múltiples espacios de nombres declarados en el root (`xmlns:w`, `xmlns:mc`, `xmlns:wp`, `xmlns:a`, `xmlns:r`, etc. — todos los .docx con imágenes los usan).
- Bloques `<mc:AlternateContent>` que envuelven los `<w:drawing>` (imágenes).
- Atributos con prefijo en namespaces no-default (ej. `mc:Ignorable="w14 wp14"`).

Al re-serializar, el navegador duplica/pierde declaraciones de namespace, lo que rompe la estructura `<w:document><w:body>…</w:body></w:document>` y deja un archivo que mammoth no puede leer.

Tu primer documento de prueba (más simple, sin imágenes) funcionó. Este nuevo (con logo, tablas y un mapa) revela el bug.

## Solución

Reemplazar el manejo XML basado en `DOMParser`/`XMLSerializer` por edición directa de strings con expresiones regulares acotadas y precisas, **respetando los namespaces tal cual vienen** en el archivo original. Es el enfoque estándar para procesar OOXML en navegador.

### Cambios concretos en `src/lib/docx-processor.ts`

1. **Reescribir `applyMargins`** — usar regex para reemplazar/insertar `<w:pgMar .../>` y `<w:pgSz .../>` dentro de cada `<w:sectPr>…</w:sectPr>` sin parsear todo el XML.

2. **Reescribir `applyParagraphFormatting`** — en lugar de iterar el DOM:
   - Forzar la fuente, tamaño y color del cuerpo desde `styles.xml` (`docDefaults` + estilo "Normal"), que ya cubre el 95% de los casos sin tocar `document.xml`.
   - Para la alineación justificada, insertar/reemplazar `<w:jc w:val="both"/>` dentro de cada `<w:pPr>` con regex, sin tocar runs ni drawings.

3. **Reescribir `applyStyles`** — mantener `DOMParser` aquí es seguro porque `styles.xml` no contiene drawings ni `mc:AlternateContent`. Pero blindar la serialización añadiendo manualmente la declaración de namespaces si se pierde.

4. **Reescribir `linkPartToSections`** — insertar `<w:headerReference>` / `<w:footerReference>` con regex dentro de cada `<w:sectPr>`, eliminando previas del mismo tipo.

5. **Reescribir `ensureRel` y `ensureContentType`** — operar sobre strings con regex (estos archivos sí son simples y no tienen el problema, pero por consistencia y robustez).

6. **Manejo de errores más claro** — en `processDocument` (`src/pages/Index.tsx`), si el procesamiento falla, mostrar un mensaje específico ("El documento contiene elementos avanzados que no pudimos procesar") en vez del genérico "¿Es un .docx válido?", que confunde al usuario haciéndole creer que su archivo está mal.

## Resultado esperado

Después de este cambio podrás subir documentos con:
- Logos e imágenes incrustadas
- Tablas (incluso anidadas)
- Encabezados/pies preexistentes
- Cualquier formato OOXML moderno

…y el procesador aplicará tipografía Century Gothic 10, márgenes 2.5/2/2/2 cm, hoja oficio 21.59×33.02 cm, texto justificado, encabezado con logo y pie con número de página, sin corromper el archivo. La vista previa con mammoth volverá a funcionar y la descarga del .docx abrirá correctamente en Word.

