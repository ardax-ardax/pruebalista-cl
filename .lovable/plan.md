
# Migrar OAs a base de datos + carga masiva

## Contexto actual
- ~512 líneas de OAs hard-coded en `curriculum-data.ts` (BASE_CURRICULUM).
- 662 filas ya en tabla `curriculum_base` (122 combinaciones curso/asignatura).
- Sistema híbrido: base hard-coded + overrides desde DB, con cache localStorage + memoria.

## Plan

### 1. Poblar `curriculum_base` con los OAs hard-coded faltantes
- Crear un script que lea `BASE_CURRICULUM` y haga `INSERT ... ON CONFLICT DO NOTHING` para cada OA que no exista ya en `curriculum_base`.
- Esto asegura que la DB tenga TODOS los OAs antes de eliminar el hard-code.

### 2. Reescribir `curriculum-data.ts` — solo DB
- Eliminar `BASE_CURRICULUM` (las ~400 líneas de datos hard-coded).
- Convertir `getOAs` para que lea desde un cache en memoria que se hidrata desde `curriculum_base` (ya hidratado por `loadOverridesFromCloud`).
- Eliminar la lógica de "merge base + overrides" — todo viene de una sola fuente (la tabla).
- Mantener `TRANSVERSAL_SKILLS` como fallback si no hay OAs para un curso/asignatura.
- Mantener exports públicos: `getOAs`, `findOA`, `hasCurriculum`, `findIndicators`.

### 3. Simplificar `curriculum-overrides.ts`
- Ya no hay "overrides" — ahora es CRUD directo contra `curriculum_base`.
- `saveOverride` → `upsertOA` (INSERT/UPDATE en `curriculum_base`).
- `removeOverride` → `deleteOA` (DELETE en `curriculum_base`).
- Eliminar localStorage como persistencia (solo cache en memoria con TTL).
- El botón "Restaurar" en CurriculumManager se convierte en "Eliminar OA".

### 4. Agregar carga masiva (CSV) en CurriculumManager
- Nuevo botón "Importar CSV" junto al botón "Nuevo OA".
- Formato CSV esperado: `curso,asignatura,codigo_oa,descripcion,eje,indicador_codigo,indicador_descripcion`.
- Múltiples filas con el mismo `codigo_oa` agrupan indicadores automáticamente.
- Componente `FileDropzone` ya existe — se reutiliza adaptado para `.csv`.
- Preview de los OAs parseados antes de confirmar la importación.
- Inserción por lotes en `curriculum_base` via `upsert`.
- Mostrar resumen: X OAs insertados, Y actualizados, Z errores.

### 5. Actualizar CurriculumManager
- Reemplazar "Restaurar" por "Eliminar" (con confirmación).
- Agregar botón de importación CSV.
- Quitar badges de "Sincronizado/Solo local" (siempre es DB).

### Archivos modificados
- `src/lib/curriculum-data.ts` — eliminar hard-code, leer solo de cache/DB
- `src/lib/curriculum-overrides.ts` — simplificar a CRUD directo
- `src/components/admin/CurriculumManager.tsx` — CSV import + UI cleanup
- Nuevo: `src/components/admin/CsvOaImporter.tsx` — componente de importación

### Sin cambios de esquema DB
La tabla `curriculum_base` ya tiene la estructura necesaria. No se requieren migraciones.
