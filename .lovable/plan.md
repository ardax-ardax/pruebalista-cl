

# Auto-QA en el servidor: comparar original vs. procesado y normalizar inconsistencias antes de entregar

El usuario no quiere revisar visualmente el comparador — quiere que **la herramienta misma detecte y corrija** las inconsistencias antes de descargar. El caso reportado: la numeración de opciones (`a)`, `b)`, `c)`) en algunas preguntas no se uniformiza porque en el .docx original conviven dos representaciones distintas:

- **Texto plano**: `a)`, `b)`, `c)` escritos directamente en `<w:t>`.
- **Lista numerada nativa de Word**: `<w:numPr>` con `numFmt="lowerLetter"` y un separador (`%1)` o `%1.`) definido en `numbering.xml`.

Lo mismo pasa con la numeración de preguntas (`1)` vs `1.`) y con las viñetas de indicadores. El procesador actual aplica fuente y márgenes pero **no toca la lógica de numeración**, así que esas diferencias visuales se mantienen.

## Plan en 3 capas

### 1. Pasada de normalización de numeración en `docx-processor.ts`

Nueva función `normalizeNumbering(documentXml, numberingXml, template)` que se ejecuta dentro de `applyTemplate`, después de `applyParagraphFormattingString`:

- **Detectar contexto** por el contenido textual del párrafo:
  - Opciones de respuesta: párrafo que empieza con `a)`, `b)`, `c)`, `d)` (texto plano) **o** párrafo con `<w:numPr>` cuya definición en `numbering.xml` use `numFmt="lowerLetter"`.
  - Preguntas: párrafo que empieza con `^\d+\)` o cuyo `numId` apunta a `decimal` con sufijo `)`.
  - Indicadores / habilidades: listas con `decimal` + `.`.
- **Unificar formato** según convención del colegio (la más usada en los ejemplos oficiales):
  - Opciones → `a)`, `b)`, `c)` con paréntesis y sangría consistente.
  - Preguntas → `1)`, `2)`, `3)` con paréntesis, negrita opcional.
  - Listas de indicadores/habilidades → `1.`, `2.`, `3.` con punto.
- **Cómo unificar sin romper Word**:
  - Para los párrafos que ya tienen `<w:numPr>`: editar la definición correspondiente en `word/numbering.xml` (`<w:lvlText w:val="%1)"/>`) en lugar de tocar cada párrafo.
  - Para los párrafos con texto plano (`a) opción`): normalizar el separador con regex (`a.` → `a)`, `a-` → `a)`, espacios extra), conservando el texto.
  - No convertir entre los dos modos (no migrar texto plano a lista nativa ni al revés) — eso refluye el documento. Solo normalizar dentro de cada modo.
- Acumular en `changes` un reporte por tipo: "Se uniformaron X opciones de respuesta a formato `a)`".

### 2. Auto-comparador interno (no visible al usuario) en `applyTemplate`

Antes de devolver el blob, comparar `originalXml` vs `processedXml` y detectar discrepancias **automáticamente corregibles** o **bloqueantes**:

- **Inconsistencias de numeración residuales**: contar cuántos párrafos de opciones siguen con formato distinto al canónico (`a.` vs `a)` vs `A)`). Si quedan > 0 después de la normalización, intentar una segunda pasada más agresiva sobre texto plano.
- **Pérdida de tablas, imágenes o filas**: si los conteos bajan, aplicar rollback de la optimización que las haya tocado (hoy `optimizeTablesString` ya es conservador, pero verificar).
- **Aumento de páginas inesperado** (> +1 sobre el original, descontando el banner): registrar warning en `diagnostics.warnings: string[]` para mostrarlo al usuario como aviso post-descarga.
- Extender `DocDiagnostics` con:
  - `optionFormatInconsistencies: { before: number; after: number }`
  - `questionFormatInconsistencies: { before: number; after: number }`
  - `warnings: string[]` (mensajes legibles)
  - `autoFixesApplied: string[]` (qué corrigió automáticamente la pasada de QA)

### 3. UI: reporte de auto-QA en lugar de comparador visual

Reemplazar el énfasis en `DocumentPreview` (lado a lado) por una **tarjeta de "Auto-QA del servidor"** sobre la previsualización:

- Verde "Documento estandarizado y verificado" si no hubo warnings.
- Amarilla con lista expandible de:
  - Correcciones automáticas aplicadas ("Se uniformó la numeración de 14 opciones a `a)`, `b)`, `c)`").
  - Avisos no bloqueantes ("Página adicional añadida porque el banner ocupa espacio").
- Mantener el comparador lado a lado, pero **colapsado por defecto** ("Ver comparación detallada" como acordeón). Ya no es la herramienta principal — es una verificación opcional.

## Cambios técnicos resumidos

`src/lib/docx-processor.ts`:
- Nueva función `normalizeNumbering(docXml, numberingXml, template)` invocada desde `applyTemplate`.
- Nueva función `runAutoQA(originalXml, processedXml, numberingXml)` que devuelve `{ warnings, autoFixesApplied, inconsistencyCounts }`.
- Extender `DocDiagnostics` con los campos nuevos.
- Leer y reescribir `word/numbering.xml` cuando exista (hoy no se toca).

`src/components/DiscrepancyAlert.tsx`:
- Renderizar también `autoFixesApplied` y `warnings` (no solo conteos crudos).
- Cambiar el copy: "Verificación automática" en lugar de "Discrepancias estructurales".

`src/pages/Index.tsx`:
- Mover `<DocumentPreview>` dentro de un `<Collapsible>` cerrado por defecto, con título "Ver comparación detallada (opcional)".
- Resaltar la tarjeta de Auto-QA como elemento principal del paso 4.

## Resultado esperado

Cuando subas el mismo `.docx` de Historia 2º Básico:

- Las opciones `a)`, `b)`, `c)` quedan en formato uniforme en todas las preguntas, sin importar si Word las tenía como texto plano o como lista nativa.
- La numeración de preguntas (`1)`, `2)`, `3)`) queda consistente.
- La tarjeta verde te confirma "14 opciones uniformadas a `a)`, `b)`, `c)`. Sin discrepancias bloqueantes." — sin que tú tengas que abrir el comparador.
- Si quedó alguna inconsistencia que el procesador no pudo arreglar sola, aparece en amarillo con el detalle exacto, y el comparador visual sigue disponible si quieres confirmar.

