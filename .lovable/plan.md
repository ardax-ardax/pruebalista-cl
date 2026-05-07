
## Cambios a implementar

### 1. Restricción de borrado en "Mis Pruebas"
**Archivo**: `src/pages/MisPruebas.tsx`

- En el botón "Eliminar" (línea ~267), añadir condición: deshabilitar si `a.status !== "borrador"`. Mostrar tooltip explicativo cuando está deshabilitado.

### 2. Guardado en dos pasos (metadatos primero, contenido después)
**Archivo**: `src/pages/CrearPrueba.tsx`

- Modificar `validate()` para separar validación de metadatos vs contenido. Crear `validateMeta()` que solo valida curso, asignatura, docente y título (sin requerir preguntas).
- El botón "Guardar" en la pestaña "meta" usará `validateMeta()` en vez de `validate()`.
- La pestaña "Contenido + Preview" ya está bloqueada con `metaComplete` (línea 723), pero además requerir que la prueba ya esté guardada en la nube (`editingId` exista). Si el docente intenta ir a Contenido sin haber guardado, mostrar toast: "Guarda los datos generales primero".
- Las validaciones de preguntas (`counted.length === 0`) se mantienen solo para exportar PDF/DOCX y enviar a revisión.

### 3. Texto de créditos institucionales en AIGenerateDialog
**Archivos**: `src/components/test-builder/AIGenerateDialog.tsx`, `src/components/test-builder/QuestionList.tsx`, `src/pages/CrearPrueba.tsx`

- Añadir prop `isInstitutional?: boolean` a `AIGenerateDialog` y `QuestionList`.
- En `AIGenerateDialog` (línea 121), cambiar el texto: si `isInstitutional` es true, mostrar "Créditos institucionales disponibles: **N**" en vez de "Créditos disponibles: **N**".
- Pasar `isInstitutional={!!currentProfile?.colegioId}` desde `CrearPrueba.tsx` a `QuestionList`, que lo pasa a `AIGenerateDialog`.

### 4. Herencia de logo del colegio (fix)
**Archivo**: `src/pages/CrearPrueba.tsx`

El código actual (líneas 164-175) ya hace fetch al colegio para obtener `nombre` y `logo_url`. El problema potencial es que `logo_url` del colegio puede ser un path relativo de storage, no una URL completa. Verificar y, si es necesario, construir la URL pública completa del bucket `user-logos` antes de setear `setLogo()`.

También asegurar que cuando staff abre una prueba ajena de un docente institucional, se cargue el logo del colegio del dueño (no del staff).

### 5. Campo "Semestre" y persistencia de N° Evaluación
**Archivo**: `src/lib/assessment-schema.ts`

- No existe campo `semester` en `AssessmentMeta`. Añadir `semester?: string` (valores: "1" | "2" | "anual").
- El campo `number` ya existe y se guarda correctamente en el JSONB `data->meta->number`.

**Archivo**: `src/components/test-builder/AssessmentMetaForm.tsx`

- Añadir selector de "Semestre" (1° Semestre, 2° Semestre, Anual) al formulario de metadatos.
- Verificar que el campo `number` (N° evaluación) se renderice y persista correctamente.

**Archivo**: `src/lib/assessment-render.tsx` (y PDF/DOCX)

- Incluir el semestre en el encabezado del documento si está definido.

---

### Resumen de archivos a modificar
1. `src/pages/MisPruebas.tsx` — botón eliminar condicionado
2. `src/pages/CrearPrueba.tsx` — validación en dos pasos, prop institucional, logo fix
3. `src/components/test-builder/AIGenerateDialog.tsx` — texto créditos institucionales
4. `src/components/test-builder/QuestionList.tsx` — pasar prop isInstitutional
5. `src/lib/assessment-schema.ts` — añadir campo semester
6. `src/components/test-builder/AssessmentMetaForm.tsx` — selector de semestre
7. `src/lib/assessment-render.tsx` — semestre en encabezado

No se requieren migraciones de base de datos (el campo semestre se almacena en el JSONB `data`).
