## Problema

Al guardar una prueba aparece:
> "No se pudo guardar: invalid input syntax for type uuid: 'molxxluk-msryjk'"

**Causa raíz:** la columna `assessments.id` en la base de datos es de tipo `uuid`, pero el frontend usa `newId()` (en `src/lib/assessment-schema.ts`) que genera identificadores tipo `"molxxluk-msryjk"` (timestamp + random base36). Eso es válido para IDs internos de preguntas/opciones, pero **no** es un UUID válido para Postgres, así que el `upsert` revienta.

Esto afecta a **todos los usuarios** (docentes y staff), no solo a docentes — pero salta más en docentes nuevos porque ellos parten siempre de borradores nuevos creados con ese ID inválido.

### Respuesta a tu pregunta
> "Si yo guardo, puedo seguir editando y guardando?"

Sí — una vez arreglado esto, podrás guardar la prueba y luego seguir editándola y volviendo a guardar. El sistema usa `upsert` por `id`, así que la misma prueba se actualiza en lugar de duplicarse cada vez que pulsas "Guardar".

## Solución

### 1. Generar UUIDs válidos para las pruebas
En `src/lib/assessment-schema.ts`:
- Crear una nueva función `newAssessmentId()` que use `crypto.randomUUID()` (disponible en todos los navegadores modernos), con fallback manual si no existe.
- Usarla en `emptyAssessment()` para el `id` de la prueba.
- Mantener `newId()` tal cual para los IDs internos (preguntas, opciones, secciones), porque esos viven dentro del JSON `data` y no necesitan ser UUID.

### 2. Sanear borradores antiguos al cargar
En `src/lib/assessment-storage.ts`, dentro de `migrate()`:
- Si el `id` del assessment cargado **no** es un UUID válido (regex), reemplazarlo por uno nuevo con `crypto.randomUUID()`.
- Esto garantiza que cualquier borrador local antiguo (como el tuyo actual con `"molxxluk-msryjk"`) se "cure" automáticamente la próxima vez que se abra, sin que pierdas el contenido.

### 3. Validación defensiva en `upsertAssessment`
Antes del `upsert`, verificar que `next.id` cumple el formato UUID; si no, asignarle uno nuevo. Es una red de seguridad para no volver a romper Postgres por este motivo.

## Archivos a modificar

- `src/lib/assessment-schema.ts` — añadir `newAssessmentId()` y usarla en `emptyAssessment()`.
- `src/lib/assessment-storage.ts` — sanear `id` no-UUID en `migrate()` y en `upsertAssessment()`.

## Resultado esperado

- El docente (ardax.ardax@gmail.com) podrá guardar la prueba sin error.
- Podrá seguir editando y guardando la misma prueba (se actualiza, no se duplica).
- Los borradores antiguos con IDs inválidos se migran solos al abrirlos.
