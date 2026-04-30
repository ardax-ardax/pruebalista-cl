## Objetivo

Reemplazar el input libre de "Eje Temático" en modo Ensayo PAES por un catálogo oficial cargado por código, con un Select reactivo que filtre los ejes según la variante elegida (Lectora, M1, M2, Ciencias —Bio/Fis/Qui—, Historia). Hacer la selección obligatoria y renderizar el nombre del eje en PDF/DOCX en lugar de códigos OA.

## Decisión de almacenamiento

Los ejes son una lista corta y estática (datos oficiales DEMRE, no editables por usuarios). No requieren tabla en Supabase: se cargan como **constante en código** (`src/lib/paes-axes.ts`), igual que `PAES_VARIANTS`. Esto evita migraciones, queries innecesarias y simplifica el catálogo. La selección del eje sigue persistiéndose en `assessments.data.meta.paesAxis` (JSONB), que ya está soportado.

> Nota: la variante "Ciencias" se subdivide en Biología, Física y Química porque cada una tiene ejes distintos. Se introducirá una sub-selección de **módulo de Ciencias** únicamente cuando la variante elegida sea `ciencias`.

## Cambios

### 1. Catálogo de ejes (`src/lib/paes-axes.ts` — nuevo)

Estructura:

```text
PAES_AXES: Record<PaesVariantKey, string[]>
  competencia-lectora      → ["Localizar información", "Interpretar y relacionar", "Reflexionar y evaluar"]
  m1                       → ["Números", "Álgebra y Funciones", "Geometría", "Probabilidades y Estadística"]
  m2                       → mismos 4 ejes que M1
  ciencias-biologia        → ["Organización celular", "Herencia y evolución", "Organismo y ambiente"]
  ciencias-fisica          → ["Ondas", "Mecánica", "Energía", "Electricidad", "Tierra y Universo"]
  ciencias-quimica         → ["Estructura atómica", "Química orgánica", "Reacciones químicas"]
  historia                 → ["Historia en perspectiva", "Formación Ciudadana", "Economía y Sociedad"]
```

Helper `getAxesFor(variant, cienciasModule?)` que devuelve la lista correspondiente.

### 2. Schema (`src/lib/assessment-schema.ts`)

- Añadir campo opcional `paesCienciasModule?: "biologia" | "fisica" | "quimica"` a `AssessmentMeta`.
- Mantener `paesAxis: string` (guarda el nombre del eje seleccionado).

### 3. Formulario (`src/components/test-builder/AssessmentMetaForm.tsx`)

En el bloque "Configuración Ensayo PAES":

- Si `paesVariant === "ciencias"`, mostrar un Select adicional **"Módulo de Ciencias"** (Biología / Física / Química).
- Reemplazar el `<Input>` de eje temático por un `<Select>` cuyas opciones se calculan con `getAxesFor(paesVariant, paesCienciasModule)`.
- Deshabilitar el Select hasta que haya variante (y módulo de ciencias si aplica).
- Al cambiar variante o módulo, limpiar `paesAxis` si ya no pertenece al nuevo catálogo.
- Marcar el campo como **requerido** (asterisco + `aria-required`) y mostrar mensaje de ayuda.

### 4. Validación al guardar

- En `CrearPrueba.tsx` (acción de guardar), si `essayMode === "paes"` y `!meta.paesAxis`, bloquear el guardado con un toast: *"Debes seleccionar un Eje Temático para guardar el ensayo PAES."*
- Validación equivalente en el flujo de exportación (PDF/DOCX) si la pregunta requiere el eje en el encabezado.

### 5. Renderizado PDF/HTML (`src/lib/assessment-render.tsx`)

Ya muestra `Eje: {paesAxis}` en la fila meta y como bloque "Ejes temáticos / habilidades". Cambios:

- Reforzar el título a **"Eje Temático PAES"** (en lugar de "Ejes temáticos / habilidades") cuando `essayMode === "paes"`.
- Garantizar que NO se rendericen códigos OA en modo PAES (ya está, se confirma).

### 6. Renderizado DOCX (`src/lib/assessment-docx.ts`)

- En el header (línea ~196 y ~668) ya imprime `paesAxis`. Ajustar la etiqueta a **"Eje Temático:"** seguido del nombre completo del eje.
- Confirmar que la tabla/lista de OA se omite cuando `isPaesDoc`.

### 7. Compatibilidad

- Evaluaciones PAES previas con `paesAxis` en texto libre: si el valor existente no coincide con el catálogo, el Select lo conserva como opción legacy marcada en cursiva (*"valor anterior"*) y permite reemplazarla por una oficial.

## Archivos afectados

```text
NUEVO   src/lib/paes-axes.ts
EDIT    src/lib/assessment-schema.ts        (campo paesCienciasModule)
EDIT    src/components/test-builder/AssessmentMetaForm.tsx  (Select reactivo + módulo Ciencias + validación visual)
EDIT    src/pages/CrearPrueba.tsx           (bloqueo al guardar si falta paesAxis)
EDIT    src/lib/assessment-render.tsx       (etiqueta "Eje Temático PAES")
EDIT    src/lib/assessment-docx.ts          (etiqueta "Eje Temático:")
```

Sin migraciones de base de datos: el JSONB `assessments.data` ya admite los nuevos campos.

## Resultado esperado

1. El docente elige "Ensayo PAES" → ve Variante.
2. Elige variante (ej. Ciencias) → aparece módulo (Bio/Fis/Qui).
3. Elige módulo → el Select de Eje Temático se llena con los 3-5 ejes oficiales de ese módulo.
4. Sin eje seleccionado, no puede guardar la evaluación PAES.
5. PDF y Word muestran el nombre del eje (ej. "Eje Temático: Mecánica") en lugar de códigos OA.
