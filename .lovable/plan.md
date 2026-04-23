

# Encabezado institucional tipo "banner" inyectado al inicio del documento

## Problema detectado

1. **El logo no aparece en la descarga**. El `logoDataUrl` se pasa a `applyHeader`, pero el XML generado para el header usa una sintaxis incompleta de `<w:drawing>` (le faltan los namespaces `xmlns:wp`, `xmlns:a`, `xmlns:r` bien declarados en la raíz `<w:hdr>`, y faltan atributos obligatorios en `<wp:docPr>` y `<pic:cNvPr>`). Word descarta silenciosamente la imagen cuando encuentra estos errores de esquema.

2. **El formato que quiere el colegio NO es un encabezado de página de Word**, sino un bloque tipo banner al principio del documento con:
   - Logo a la izquierda
   - Líneas "Profesor/a _______", "Asignatura _______", "Curso _______" al centro
   - Un recuadro "Calificación" a la derecha (solo en evaluaciones; en la Guía de Portafolio no va)
   
   Esto se ve en los ejemplos oficiales que adjuntaste y es imposible replicarlo con el `<w:header>` estándar (que no admite layouts complejos de 3 columnas con recuadros sin romper la estructura).

3. **Los documentos que suben los docentes vendrán "pelados"** (sin logo, sin líneas Profesor/Asignatura/Curso). La app debe insertarlo automáticamente al principio, rellenando los datos del docente, asignatura y curso seleccionados en el paso 3.

## Solución

### 1. Insertar un "banner institucional" al inicio de `document.xml`

En lugar de usar `<w:header>`, se construye una **tabla invisible de 3 columnas** y se inyecta como primer hijo de `<w:body>` en `word/document.xml`:

```text
┌──────────┬─────────────────────────────────┬──────────────┐
│          │ Profesor/a  Juan Pérez _______  │              │
│  [LOGO]  │ Asignatura  Historia _________  │ Calificación │
│          │ Curso       7° Básico ________  │   [recuadro] │
└──────────┴─────────────────────────────────┴──────────────┘
```

- Columna 1: `~3 cm` con el logo (imagen embebida correctamente con todos los namespaces).
- Columna 2: `~12 cm` con las 3 líneas. El dato seleccionado (nombre del docente, asignatura legible, curso legible) se escribe en negrita seguido de una línea de guiones bajos para completar visualmente.
- Columna 3 (solo en Ev. Formativa y Ev. Sumativa): `~3 cm` con un recuadro de borde redondeado y la palabra "Calificación" centrada. En Guía de Portafolio esta columna se omite.
- Tabla sin bordes visibles excepto el recuadro de "Calificación".
- Debajo de la tabla, un párrafo vacío de separación.

### 2. Arreglar la inserción del logo

- Declarar correctamente los namespaces en el `<w:drawing>` inyectado (`xmlns:wp`, `xmlns:a`, `xmlns:pic`, `xmlns:r`).
- Completar los atributos obligatorios que Word valida estrictamente: `wp:docPr id/name`, `pic:cNvPr id/name`, `a:ext cx/cy`, y `a:off x/y`.
- Detectar correctamente la extensión de la imagen (jpg/jpeg/png) desde el `dataURL` y registrar el content-type correcto.
- Registrar la relación `image` en `word/_rels/document.xml.rels` (no en `header1.xml.rels`, ya que ahora el logo va en el cuerpo del documento).

### 3. Desactivar el header clásico

Como el banner ahora vive en el cuerpo del documento, se desactiva la generación de `word/header1.xml` para las 3 plantillas del colegio, evitando duplicación del logo y el problema actual del header roto. Se conserva el footer (número de página al pie) como está.

### 4. Usar los datos del paso 3 para rellenar el banner

Las 3 líneas del banner se rellenan con:
- **Profesor/a**: label legible del `teacher` seleccionado (ej. "Jorge Villablanca"), no el valor sanitizado.
- **Asignatura**: label legible del `subject` (ej. "Historia, Geografía y Ciencias Sociales").
- **Curso**: label legible del `grade` (ej. "7° Básico").

Si alguno no está seleccionado, se deja solo la línea de guiones bajos (como en la plantilla original en blanco).

### 5. Aprovechar mejor el espacio de la hoja

- Márgenes reducidos acorde al colegio: **izq 2,5 / der 2 / sup 2 / inf 2 cm** (ya está así).
- El banner ocupa solo el ancho útil (entre márgenes) y su alto se ajusta al logo (~2,5 cm), sin consumir espacio extra.
- Se mantiene Century Gothic 10 pt, justificado, interlineado 1,15.

## Cambios técnicos

- `src/lib/docx-processor.ts`:
  - Nueva función `insertInstitutionBanner(zip, template, teacherLabel, subjectLabel, gradeLabel, logoDataUrl, showCalificacion)` que:
    1. Guarda el logo en `word/media/` con extensión correcta.
    2. Registra content-type y relación en `document.xml.rels`.
    3. Construye el XML de la tabla-banner con namespaces completos.
    4. Inyecta la tabla al inicio de `<w:body>` (justo después de la apertura).
  - Ajustar `applyTemplate` para recibir `bannerData: { teacherLabel, subjectLabel, gradeLabel, showCalificacion }` y llamar a la nueva función en vez de `applyHeader` para las plantillas del colegio.
  - Mantener `applyFooter` intacto.

- `src/lib/templates.ts`:
  - Añadir flag `header.style: "banner-evaluacion" | "banner-guia" | "classic"` para distinguir las 3 plantillas (la Guía no lleva "Calificación").

- `src/pages/Index.tsx`:
  - En `processDocument`, resolver los labels legibles desde `subjects/grades/teachers` antes de llamar a `applyTemplate` y pasarlos como `bannerData`.

## Resultado

Al subir un .docx sin encabezado, la app producirá un documento con:
- Banner institucional idéntico al de los ejemplos oficiales (logo + Profesor/Asignatura/Curso + Calificación).
- Logo correctamente embebido y visible al abrir el .docx en Word o Google Docs.
- Century Gothic 10, justificado, márgenes y hoja Oficio del colegio.
- Número de página al pie.
- Nombre de archivo con la convención `Ev_Sumativa_N°1_Historia_7Básico_JorgeVillablanca.docx`.

