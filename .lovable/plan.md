
# Corregir dos fallas confirmadas con los archivos subidos

Revisé el original `2026_EVALUACIÓN_FORMATIVA_FORMAL...docx` y el descargado `Ev_Diversificada_N°3...docx`. Hay dos problemas reales y distintos:

1. **La tipografía no queda realmente aplicada en Word**  
   En el procesador actual solo se fuerzan `styles.xml` y algunos estilos de párrafo, pero muchos documentos traen **formato directo en los runs** (`<w:rPr><w:rFonts .../><w:sz .../></w:rPr>`) dentro de `document.xml`. Word prioriza ese formato directo por sobre `Normal` y `docDefaults`, así que el archivo descargado puede seguir viéndose con la fuente original aunque el reporte diga que cambió.

2. **La última imagen no conserva el comportamiento visual del original**  
   En el original, la imagen final queda parcialmente visible al final de la página 4. En el descargado aparece en una **página 5 nueva, completa y con mucho espacio en blanco**. Eso confirma que hoy no se está preservando bien el layout real de Word: al tocar el drawing, el documento refluye y la imagen deja de comportarse como en el archivo original.

## Implementación propuesta

### 1) Forzar tipografía también en el contenido real del documento
Archivo: `src/lib/docx-processor.ts`

Agregar una pasada nueva sobre `word/document.xml` para normalizar formato directo:

- recorrer todos los `<w:rPr>` del cuerpo;
- reemplazar o insertar:
  - `<w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic" w:cs="Century Gothic" w:eastAsia="Century Gothic"/>`
  - `<w:sz w:val="20"/>` y `<w:szCs w:val="20"/>` para 10 pt;
  - color del cuerpo si corresponde;
- no tocar runs especiales de campos, numeración, símbolos o drawings;
- mantener negritas, cursivas, subrayados y demás propiedades existentes.

También aplicar esta normalización al contenido inyectado por la app:
- banner institucional,
- pie de página,
- bloques creados por el procesador.

Con esto Word ya no dependerá solo de `styles.xml`, y la fuente sí cambiará visualmente al abrir el `.docx`.

### 2) Dejar de “corregir” imágenes que ya vienen recortadas o ancladas por Word
Archivo: `src/lib/docx-processor.ts`

La lógica actual `fitOversizedImagesString()` está reescribiendo `wp:extent` / `a:ext` cuando detecta imágenes grandes. En estos documentos eso altera el flujo y termina empujando la última imagen a una página nueva.

Se ajustará así:

- detectar si el drawing tiene:
  - `<a:srcRect .../>` (recorte de Word),
  - `<wp:anchor ...>` (objeto flotante),
  - positioning / wrapping especial;
- **no reescalar** imágenes recortadas o ancladas, porque ahí lo prioritario es preservar el layout original;
- reescalar solo imágenes inline simples, sin crop y realmente sobredimensionadas;
- si una imagen tiene crop, conservar exactamente su `srcRect` y sus dimensiones visibles originales;
- no modificar el primer `<a:ext>` “que aparezca”, sino el transform correcto del mismo drawing para evitar efectos colaterales.

Resultado esperado: la última imagen ya no se expandirá completa en una página extra cuando el original la traía visualmente recortada por el propio diseño de Word.

### 3) Hacer la vista previa menos engañosa
Archivo: `src/pages/Index.tsx`

La previsualización usa Mammoth, que no reproduce fielmente:
- recortes de imagen de Word,
- objetos flotantes,
- ciertos layouts complejos.

Se mantendrá la nota, pero se volverá más explícita para este caso:
- la vista previa web puede diferir del `.docx` final en imágenes recortadas o posicionadas por Word;
- la referencia válida para QA seguirá siendo el archivo `.docx` procesado.

## Cambios técnicos resumidos

- `src/lib/docx-processor.ts`
  - nueva función para **normalizar `w:rPr` en `document.xml`** y forzar tipografía/tamaño en runs reales;
  - integrar esa pasada dentro de `applyTemplate()`;
  - endurecer `fitOversizedImagesString()` para **preservar imágenes con crop/anclaje** y solo actuar en casos seguros;
  - mantener intactos banner, tablas y demás contenido ya corregido.

- `src/pages/Index.tsx`
  - ajustar el mensaje bajo la vista previa para explicar mejor la diferencia entre Mammoth y Word.

## Resultado esperado

- El `.docx` descargado abrirá en Word con **Century Gothic 10 real**, no solo “reportada”.
- La última imagen ya no aparecerá completa en una página adicional si el original la traía visualmente recortada o condicionada por el layout.
- La app seguirá agregando el banner institucional y aplicando el formato del colegio, pero sin romper el comportamiento visual del documento original en sus imágenes complejas.
