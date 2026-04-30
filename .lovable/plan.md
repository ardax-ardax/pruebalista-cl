
## Objetivo

Poblar `src/lib/curriculum-data.ts` con los Objetivos de Aprendizaje (OA) reales de las Bases Curriculares del Mineduc para que el selector de OA en `AssessmentMetaForm.tsx` muestre datos al elegir cualquier curso de Básica (1° a 6°) en Lenguaje, Matemática y Ciencias Naturales, y agregar un fallback amigable.

## Sincronización de keys (verificada en `src/lib/catalog.ts`)

Los `value` reales que devuelven los `Select` deben usarse como keys del objeto `CURRICULUM`:

- **Cursos** (`gradeValue`): `"1ºBásico"`, `"2ºBásico"`, `"3ºBásico"`, `"4ºBásico"`, `"5ºBásico"`, `"6ºBásico"`
  - Nota: el carácter es `º` (ordinal masculino, U+00BA), **no** `°` (signo de grado U+00B0). El usuario escribió `'1° Básico'` en su mensaje pero el catálogo real usa `1ºBásico` sin espacio.
- **Asignaturas** (`subjectValue`): `"Lenguaje"` (Lenguaje y Comunicación), `"Matemática"`, `"Ciencias"` (Ciencias Naturales)

Las keys actuales de `5ºBásico`/`6ºBásico` con `Lenguaje`/`Matemática` ya están correctas. Hay que **agregar** los demás cursos y la asignatura `Ciencias`.

## Cambios

### 1. `src/lib/curriculum-data.ts` — poblar datos reales

Estructura final (18 combinaciones curso × asignatura):

```text
CURRICULUM = {
  "1ºBásico":  { Lenguaje: [...5-7 OA], Matemática: [...5-7 OA], Ciencias: [...4-6 OA] },
  "2ºBásico":  { Lenguaje: [...], Matemática: [...], Ciencias: [...] },
  "3ºBásico":  { ... },
  "4ºBásico":  { ... },
  "5ºBásico":  { ... }, // ya existe — conservar
  "6ºBásico":  { ... }, // ya existe — conservar
}
```

Por cada combinación se incluirán entre 5 y 8 OA principales (los más evaluados), con `code` (`"OA 01"`, `"OA 02"`…), `eje` y `description` textual del Mineduc. Ejes:

- **Lenguaje**: Lectura, Escritura, Comunicación oral.
- **Matemática**: Números y operaciones, Patrones y álgebra, Geometría, Medición, Datos y probabilidades.
- **Ciencias Naturales**: Ciencias de la vida, Ciencias físicas y químicas, Ciencias de la Tierra y el Universo.

Total estimado: ~110-130 OA cargados.

### 2. Fallback amigable en `getOAs`

Añadir una constante exportada `TRANSVERSAL_SKILLS: OA[]` con 4-6 "Habilidades Transversales" genéricas (pensamiento crítico, comunicación efectiva, trabajo colaborativo, resolución de problemas, uso de TIC, autorregulación), marcadas con `code: "HT 01"`, etc.

Modificar `getOAs(grade, subject)`:
- Si la combinación existe → devuelve sus OA.
- Si **no** existe pero ambos parámetros están presentes → devuelve `TRANSVERSAL_SKILLS` (fallback).
- Si falta alguno → devuelve `[]` (mantiene el mensaje "Selecciona curso y asignatura…").

Exportar también un helper `hasCurriculum(grade, subject): boolean` para que el formulario pueda distinguir "datos oficiales" vs "fallback".

### 3. `src/components/test-builder/AssessmentMetaForm.tsx` — mensaje más amigable

Reemplazar el bloque de "Aún no hay OAs cargados…" por:
- Si `hasCurriculum` es `false` y `availableOAs` vino del fallback → mostrar un aviso suave (texto pequeño con icono `Info`) tipo: *"Aún no cargamos los OA oficiales para esta combinación. Mientras tanto, puedes vincular Habilidades Transversales."* y debajo renderizar la lista del fallback (mismo componente de checkboxes).
- Si por alguna razón no hay nada → texto actual.

No cambia la firma de `linkedOA`; los códigos `HT 0X` se guardan igual y aparecen en los exports DOCX/PDF.

## Verificación post-implementación

Caso de prueba manual: ir a *Crear prueba → Datos*, seleccionar **Curso = "2º Básico"** y **Asignatura = "Matemática"**, y confirmar que el panel de OA se rellena automáticamente con los OA de 2° Básico Matemática (sin recargar la página). Repetir con Ciencias Naturales en 1°-6°.

## Archivos a modificar

- `src/lib/curriculum-data.ts` (reescribir con datos completos + fallback + `hasCurriculum`)
- `src/components/test-builder/AssessmentMetaForm.tsx` (mensaje amigable + render del fallback)

## Fuera de alcance

- Ampliar a 7°-IV° Medio (se puede hacer después siguiendo el mismo patrón).
- Ampliar a otras asignaturas (Historia, Inglés, Artes, etc.) — caerán en el fallback transversal hasta que se carguen.
