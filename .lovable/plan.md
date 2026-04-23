

# Agregar namespaces `w14`, `w15`, `w16` y autoreparar prefijos faltantes

## Causa exacta del error

El archivo de Marilín Martínez usa atributos `w14:paraId` / `w14:textId` en sus `<w:p>` (Word los agrega automáticamente a partir de Word 2010). Mi función `ensureDocumentRootNamespaces` solo declara `w`, `r`, `wp`, `a`, `pic`, `mc` — no incluye los prefijos `w14`, `w15`, `w16se`, `w16cid`. El validador final detecta correctamente que el prefijo no está declarado y bloquea la descarga.

## Fix

### 1. Ampliar la lista de namespaces obligatorios

En `ensureDocumentRootNamespaces` (línea 411), agregar:

- `xmlns:w14` → `http://schemas.microsoft.com/office/word/2010/wordml` (paraId, textId, conditional formatting)
- `xmlns:w15` → `http://schemas.microsoft.com/office/word/2012/wordml` (Word 2013)
- `xmlns:w16se` → `http://schemas.microsoft.com/office/word/2015/wordml/symex` (Word 2016)
- `xmlns:w16cid` → `http://schemas.microsoft.com/office/word/2016/wordml/cid` (comment IDs)
- `xmlns:wpg`, `xmlns:wps`, `xmlns:wpi` → grupos/formas/tinta (Word 2010+)
- `xmlns:v` → `urn:schemas-microsoft-com:vml` (formas legacy, frecuente en encabezados)
- `xmlns:o` → `urn:schemas-microsoft-com:office:office`

También agregar `mc:Ignorable="w14 w15 w16se w16cid wp14"` si no existe — esto le dice a versiones viejas de Word que ignoren esos prefijos sin romperse.

### 2. Autoreparación: detectar prefijos huérfanos en el XML

Antes de validar, escanear el XML procesado en busca de **cualquier prefijo** usado en atributos o tags (`w14:`, `w15:`, `m:`, `wne:`, etc.) y comparar con los declarados en el root. Para cada prefijo huérfano que conozcamos (lista blanca de namespaces oficiales de Microsoft Word), agregar la declaración correspondiente al root automáticamente.

Lista blanca a mantener en una constante `KNOWN_WORD_NAMESPACES`:
```
w14, w15, w16se, w16cid, w16, wp, wp14, wpg, wps, wpi,
a, pic, mc, m (math), v, o, r, w, ve, wne (legacy)
```

Si aparece un prefijo desconocido, registrar warning (no fatal) con el detalle, en lugar de bloquear.

### 3. Aplicar lo mismo a `header*.xml` y `footer*.xml`

El error puede aparecer también en encabezados/pies de página si Word los marcó con `w14:paraId`. Hoy `ensureDocumentRootNamespaces` solo se llama sobre `document.xml`. Crear `ensurePartRootNamespaces(xml, rootTag)` genérica y llamarla para cada `word/header*.xml` y `word/footer*.xml` que exista en el ZIP, justo antes de la validación final.

### 4. Mejor mensaje de error si la validación final aún falla

Si después de autorreparar todavía hay un `<parsererror>`, el toast debe incluir:
- Nombre del prefijo problemático extraído del mensaje (regex sobre `Namespace prefix (\w+) for`).
- Sugerencia: "Reportar a soporte con este detalle: prefijo `<X>` no soportado".

## Archivos a modificar

- `src/lib/docx-processor.ts`:
  - `ensureDocumentRootNamespaces`: ampliar `REQUIRED` con los namespaces de Word 2010+, y agregar `mc:Ignorable`.
  - Nueva utilidad `repairOrphanNamespaces(xml)` que escanea prefijos usados vs declarados.
  - Nueva utilidad `ensurePartRootNamespaces(xml, rootElementName)` para reusar la lógica en headers/footers.
  - En el bucle de sanitización final (línea ~867), llamar la nueva función sobre cada `word/header*.xml` y `word/footer*.xml`.

- `src/pages/Index.tsx`:
  - En el toast de error fatal de validación, extraer el prefijo del mensaje y mostrarlo destacado.

## Resultado esperado

- El archivo de Marilín Martínez procesa, valida y descarga sin error.
- Cualquier `.docx` futuro que use prefijos `w14`/`w15`/`w16` (la mayoría de los Word modernos) pasa la validación final automáticamente.
- Si aparece un prefijo realmente desconocido, en lugar de bloquear muestra un warning útil y permite la descarga.

