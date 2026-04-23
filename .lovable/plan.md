
## Recomiendo cambiar el enfoque: de “arreglar cualquier Word” a “crear pruebas estructuradas”

Sí: para este caso conviene más una app de creación de pruebas tipo Forms, pero con salida **siempre estandarizada**. El problema de fondo no es solo el PDF recortando mal; es que el flujo actual depende de documentos Word arbitrarios, con imágenes flotantes, crops OOXML, tablas, posiciones y estilos impredecibles. Mientras entremos por `.docx`, siempre habrá casos borde.

La solución más robusta es agregar un **Constructor de Pruebas** como flujo principal, y dejar el estandarizador actual solo como herramienta secundaria para documentos heredados.

## Qué se construirá

### 1) Nuevo módulo “Crear prueba”
Nueva ruta y navegación:
- `Procesar Word` (flujo actual, secundario)
- `Crear prueba` (nuevo flujo principal)

La nueva experiencia será un asistente con 4 pasos:
1. **Datos generales**
   - plantilla
   - número
   - asignatura
   - curso
   - docente
   - título / instrucciones
   - puntaje total / puntos por pregunta
2. **Contenido**
   - agregar preguntas
   - reordenar
   - duplicar
   - eliminar
   - agrupar por secciones
3. **Vista previa paginada**
   - render en hoja Oficio/Carta según plantilla
   - misma cabecera institucional siempre
   - misma tipografía/espaciado siempre
4. **Exportar**
   - `.docx`
   - `PDF`

### 2) Modelo estructurado de evaluación
Se reemplaza el origen “Word libre” por un esquema JSON controlado, por ejemplo:

```text
Assessment
 ├─ meta
 │  ├─ templateId
 │  ├─ subject
 │  ├─ grade
 │  ├─ teacher
 │  ├─ number
 │  ├─ title
 │  └─ instructions
 ├─ sections[]
 └─ questions[]
     ├─ type
     ├─ prompt
     ├─ points
     ├─ image?
     ├─ options[]?
     └─ answerLines?
```

Tipos MVP:
- selección múltiple
- verdadero/falso
- desarrollo corto
- bloque informativo / instrucción
- título de sección

Esto elimina duplicación de banners, espaciados impredecibles y layouts rotos.

### 3) Imágenes con recorte real controlado
Cada imagen se sube dentro de la pregunta y se guarda con metadata de crop:
- `src`
- `crop.left/right/top/bottom`
- `width`
- `alignment`

Se agrega un editor visual simple de recorte.
La misma metadata se usará en:
- preview
- PDF
- DOCX

Así preview/PDF/DOCX salen desde la **misma fuente**, no desde interpretación parcial de mammoth.

### 4) Un solo renderer para preview y exportación
Se creará un renderer común que transforme la evaluación estructurada en bloques visuales estandarizados:
- encabezado institucional
- título
- instrucciones
- preguntas
- opciones
- imágenes
- líneas de respuesta

Ese renderer alimentará:
- la vista previa web
- el HTML de impresión para PDF
- la generación de `.docx`

Objetivo: que los tres resultados coincidan visualmente.

### 5) Exportación nativa, no “reparación de Word”
#### PDF
Generar desde el renderer HTML paginado, con CSS de impresión estable.
Ya no dependerá del HTML de mammoth ni de crops interpretados desde un Word ajeno.

#### DOCX
Generar un documento nuevo desde el esquema estructurado, en vez de mutar un `.docx` arbitrario.
Eso permite:
- cabecera consistente
- espaciado consistente
- imágenes inline y recortadas correctamente
- nombres de archivo estandarizados

## Cómo convivirá con lo actual

### Fase 1 — coexistencia
Mantener el flujo actual para “rescatar” documentos ya existentes:
- subir `.docx`
- estandarizar lo que se pueda
- advertir que el PDF desde Word importado sigue siendo limitado

### Fase 2 — flujo recomendado
La pantalla principal pasa a priorizar:
- “Crear prueba nueva”
- “Procesar Word existente” como opción secundaria

### Fase 3 — reducción de complejidad
Cuando el constructor cubra la mayoría de los casos reales del colegio, el flujo de importación se mantiene solo para excepciones.

## Archivos y módulos a crear/modificar

### Nuevas rutas
- `src/pages/CrearPrueba.tsx`
- `src/App.tsx` — registrar ruta nueva
- `src/components/AppLayout.tsx` — agregar navegación “Crear prueba”

### Nuevo dominio de datos
- `src/lib/assessment-schema.ts` — tipos y utilidades
- `src/lib/assessment-storage.ts` — borradores en localStorage
- `src/lib/assessment-file-name.ts` — convención de nombre final

### Builder UI
- `src/components/test-builder/AssessmentMetaForm.tsx`
- `src/components/test-builder/QuestionList.tsx`
- `src/components/test-builder/QuestionEditor.tsx`
- `src/components/test-builder/SectionEditor.tsx`
- `src/components/test-builder/ImageCropEditor.tsx`
- `src/components/test-builder/AssessmentPreview.tsx`

### Render y export
- `src/lib/assessment-render.tsx` — renderer común
- `src/lib/assessment-pdf.ts` — HTML paginado para impresión
- `src/lib/assessment-docx.ts` — generación `.docx`
- `src/lib/assessment-pagination.ts` — reglas de salto de página / bloques

### Reutilización de lo existente
- `src/lib/templates.ts` — reutilizar plantillas y formato institucional
- `src/lib/catalog.ts` — reutilizar asignaturas, cursos y docentes
- `src/pages/Index.tsx` — reposicionar como “Procesar Word”

## Detalles técnicos

### Regla clave
No más “preview generado por mammoth de un Word arbitrario” como fuente de verdad.

### Nueva arquitectura
```text
Formulario estructurado
   ↓
JSON de evaluación
   ↓
Renderer único
   ├─ Preview web
   ├─ PDF
   └─ DOCX
```

### Beneficios directos
- no se duplica el banner
- no se desordenan preguntas por imágenes flotantes
- no depende de crops OOXML de terceros
- el PDF deja de salir distinto al Word
- el espaciado entre preguntas es controlado por reglas propias
- se pueden agregar validaciones pedagógicas (puntaje, numeración, secciones)

### Validaciones del MVP
- numeración automática de preguntas
- al menos una opción correcta si aplica
- campos obligatorios de cabecera
- límite de ancho/alto de imagen
- aviso si una pregunta rompe página de forma incómoda

## Ajuste inmediato mientras se construye
Como medida transitoria, el flujo actual de importación debería:
- mantener `.docx` como descarga principal
- marcar el PDF importado como “experimental” o esconderlo para documentos con imágenes recortadas/flotantes

Así evitamos prometer fidelidad donde hoy no existe.

## Resultado esperado
- El usuario crea una prueba desde cero dentro de la app.
- El sistema aplica siempre el formato institucional correcto.
- Las imágenes se ven iguales en preview, PDF y DOCX.
- Se reduce drásticamente la dependencia de “arreglar” archivos Word problemáticos.
- El flujo queda más cercano a Forms, pero con salida formal, imprimible y estandarizada para el colegio.

## Orden de implementación recomendado
1. Crear nueva ruta `Crear prueba` y modelo `Assessment`.
2. Construir formulario de metadata + preguntas básicas.
3. Implementar preview paginado con el formato institucional.
4. Agregar imágenes con crop visual.
5. Generar PDF desde el renderer.
6. Generar DOCX desde el mismo esquema.
7. Reposicionar el flujo actual de importación como herramienta secundaria.
