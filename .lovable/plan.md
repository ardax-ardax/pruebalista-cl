
# Plan: Gestión Curricular Mejorada para Admin

## Contexto

El proyecto ya cuenta con:
- Tabla `curriculum_base` con upsert por `(grade_value, subject_value, oa_code)` — ya cumple la función de `learning_objectives`.
- `CurriculumManager` con formulario manual y carga CSV.
- RLS configurado: staff puede escribir, autenticados pueden leer.
- Pestaña "curriculum" visible solo para admin en `/configuracion`.

No se necesita crear una nueva tabla `learning_objectives` ya que `curriculum_base` tiene exactamente la misma estructura y lógica de upsert solicitada.

## Cambios propuestos

### 1. Soporte Excel (.xlsx) en el importador

Modificar `CsvOaImporter.tsx` para aceptar archivos `.xlsx` además de `.csv`:
- Agregar la librería `xlsx` (SheetJS) para parsear archivos Excel.
- Detectar el tipo de archivo por extensión y procesar con el parser adecuado.
- Renombrar el componente a algo más genérico (ej: "Importar OAs").

### 2. Vista global con buscador y paginación

Reescribir `CurriculumManager.tsx` para incluir:
- **Vista global**: mostrar todos los OAs sin requerir seleccionar grado+asignatura primero (los filtros serán opcionales).
- **Buscador de texto**: filtrar por código, descripción o eje.
- **Filtros por Grado y Asignatura**: mantener los selectores actuales pero como filtros opcionales.
- **Paginación**: mostrar 20 OAs por página con controles de navegación.
- **Contador**: mostrar total de resultados filtrados.

### 3. Mantener funcionalidad existente

- El formulario manual de creación/edición de OA permanece sin cambios.
- La lógica de upsert en `curriculum-overrides.ts` ya funciona correctamente.
- Los botones de editar/eliminar por OA se mantienen.

### 4. Seguridad (sin cambios necesarios)

Las políticas RLS de `curriculum_base` ya están correctamente configuradas:
- SELECT: todos los autenticados
- INSERT/UPDATE/DELETE: solo staff (admin + utp_head)

No se requieren migraciones de base de datos.

## Detalle técnico

| Archivo | Cambio |
|---------|--------|
| `package.json` | Agregar dependencia `xlsx` |
| `src/components/admin/CsvOaImporter.tsx` | Aceptar `.xlsx`, parsear con SheetJS |
| `src/components/admin/CurriculumManager.tsx` | Agregar buscador, paginación, vista global sin requerir filtros previos |
| `src/lib/curriculum-overrides.ts` | Aumentar límite de query de 5000 si es necesario para paginación |
