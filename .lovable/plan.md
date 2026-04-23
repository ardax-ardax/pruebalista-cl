
# Estandarizador de Documentos Word para el Colegio

Una web sin login donde cualquier miembro del equipo sube un documento Word, elige una plantilla del colegio, y descarga el documento ya formateado de forma uniforme.

## Flujo de uso

1. **Pantalla principal** — selección de plantilla (ej. "Circular", "Examen", "Informe", "Comunicado") con vista de cómo se ve cada una.
2. **Personalización opcional** — antes de subir, puede ajustar parámetros sobre la plantilla (tipografía, márgenes, etc.).
3. **Subida del .docx** — arrastrar y soltar o seleccionar archivo.
4. **Procesamiento automático** — se aplican todos los parámetros al documento.
5. **Vista previa** — el documento ya formateado se muestra en pantalla página por página.
6. **Reporte de cambios** — lista clara de qué se modificó (ej. "Fuente cambiada de Times a Arial", "Márgenes ajustados a 2.5cm", "Logo añadido al encabezado").
7. **Descarga** — botón para bajar el .docx corregido y opción adicional de PDF.

## Parámetros configurables (por plantilla)

- **Tipografía**: fuente del cuerpo, fuente de títulos, tamaños para cuerpo / H1 / H2 / H3
- **Márgenes y espaciado**: márgenes (sup/inf/izq/der), interlineado, espacio antes/después de párrafos
- **Encabezado**: logo del colegio (subible), nombre de la institución, alineación
- **Pie de página**: texto fijo, número de página, fecha
- **Estilos de títulos**: color, negrita, alineación, tamaño por nivel
- **Listas**: tipo de viñeta y numeración estandarizadas

## Plantillas predefinidas (editables)

Vienen 3-4 plantillas listas para usar como punto de partida:
- **Circular oficial** — formal, con logo y pie institucional
- **Examen** — encabezado con espacio para datos del alumno
- **Informe interno** — título grande, cuerpo limpio
- **Comunicado a familias** — tono cercano, encabezado destacado

Cada plantilla se puede duplicar y modificar; las personalizaciones se guardan en el navegador (localStorage) para no perderse entre sesiones.

## Página de configuración (admin)

Sección separada donde se gestionan las plantillas: crear, editar, duplicar, eliminar, y subir el logo del colegio. Sin login, accesible desde el menú — orientada a quien administra los formatos.

## Logo del colegio

Se sube una sola vez desde la configuración y se reutiliza en todas las plantillas que lo incluyan en el encabezado.

## Procesamiento técnico

- El documento se procesa **en el navegador** (sin servidor), garantizando privacidad de los archivos del colegio.
- Se descomprime el .docx, se modifican los XML internos según los parámetros, y se vuelve a empaquetar.
- La conversión a PDF se hace también del lado cliente.
- Vista previa renderizada en pantalla mostrando el resultado final.

## Diseño visual

Interfaz limpia y profesional adecuada para un entorno educativo: tipografía clara, paleta sobria (azul institucional + neutros), tarjetas grandes para las plantillas con vista previa, indicadores de progreso durante el procesamiento, y mensajes de éxito/error claros en español.
