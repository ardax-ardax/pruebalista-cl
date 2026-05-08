# Consolidación del Módulo Institucional

## 1. Reorganización del panel UTP (Configuración)

**Orden nuevo de pestañas UTP:** `Equipo | Evaluaciones | Cursos | Políticas | Consumo`

`src/pages/Configuracion.tsx` (líneas 401–519)
- Renombrar la pestaña `catalogos` → `cursos` y mover su posición a la 3.ª (entre Evaluaciones y Políticas, ya está). Cambiar el `value` y el ícono (mantener `BookOpen`).
- Quitar del contenido de esa pestaña los gestores de Asignaturas y Docentes (`CatalogManager`). Para UTP la pestaña debe contener **solo cursos** y usar el asistente triple. Las asignaturas son globales (las gestiona Admin); los "docentes" como catálogo libre ya no aplican (existen vía `pending_invitations`/profiles).
- Renderizar dentro de la pestaña Cursos un nuevo componente `<UtpCoursesManager />` (ver §1.b).

### 1.b — Asistente triple de cursos para UTP

Crear `src/components/utp/UtpCoursesManager.tsx`, basado en `AdminCoursesManager` con estas diferencias:
- Reutiliza `GRADES_BY_LEVEL` y `buildCourseLabels(level, gradeKey, letter)`.
- El campo "Nombre del curso" (`label`) se muestra **siempre como readonly** (`<Input readOnly disabled className="bg-muted" />`), incluso al editar. El valor se calcula automáticamente al cambiar Nivel/Grado/Letra.
- Igualmente `grade_value` (slug) es readonly.
- Validación al guardar: `level`, `gradeKey`, `letter` requeridos.
- Persistencia: `admin_courses` ya existe y la RLS actual permite `INSERT/UPDATE/DELETE` solo a `admin`. **Hay que añadir una política RLS** que también permita a `utp_head` operar sobre `admin_courses` y `admin_course_subjects` (pero solo para cursos asociados a su colegio… pero `admin_courses` es global, sin `colegio_id`).
  - **Decisión recomendada:** los cursos siguen siendo globales (catálogo único). El UTP solo puede **agregar** cursos al catálogo global; no puede borrar los que vienen del Admin. Para esto: agregar columna `created_by uuid` y `colegio_id uuid` (nullable) a `admin_courses`, y RLS:
    - `INSERT`: admin OR utp_head (con `created_by = auth.uid()`).
    - `UPDATE/DELETE`: admin OR (utp_head AND `created_by = auth.uid()`).
- UI: lista los cursos con badge "Global" (creado por Admin) o "Mi colegio" (creado por UTP).

## 2. Lógica de créditos institucional

### 2.a — Eliminar contador y badge "Free" del avatar/perfil

`src/components/AppLayout.tsx`
- Reemplazar la condición `(shouldHideCredits || isInstitutional)` y `(!shouldHideCredits && !isInstitutional)` por una más estricta: si `currentProfile?.colegioId` (institucional, sea UTP o docente) → **nunca** mostrar el badge `creditsAvailable · planLabel` ni el badge "planLabel" en el dropdown. Mostrar solo el badge verde "Cuenta Institucional · [Colegio]".

`src/pages/Perfil.tsx` (líneas 318–340)
- La rama `!isInstitutional` ya oculta el card de "Plan actual". Verificar que `isInstitutional` se calcule como `!!profile?.colegioId` (ya se hace). Sin cambios funcionales esperados, pero asegurar que no quede ningún `{planLabel}` ni `Plan Free` visible (auditar visual).

### 2.b — Mostrar saldo solo en CrearPrueba (generador IA)

`src/pages/CrearPrueba.tsx`
- En el bloque de generación con IA (botón "Generar con IA" / sección AI), añadir junto al CTA un texto: `Créditos institucionales: {creditsAvailable}`. Solo cuando `currentProfile?.colegioId`. Para autónomos mantener la UI actual.

### 2.c — Saldo personal inicial = 0 para nuevos institucionales

Migración:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user() ...
  -- Si v_colegio_id IS NOT NULL → v_default_credits := 0;
  -- Si NOT NULL → leer default_credits del plan por defecto.
```
- Backfill opcional: dejar `credits_available` actual sin tocar para usuarios existentes. Solo aplicar a registros nuevos.

### 2.d — Bolsa de créditos del colegio (opcional para esta entrega)

**Aclarar con el usuario antes de implementar** (ver §Preguntas abiertas). Por ahora el saldo institucional muestra el `credits_available` personal del docente (que comienza en 0). El admin/UTP puede recargarlo manualmente desde `UtpUsageManager`. Una bolsa colectiva real requiere tabla `colegio_credits` y modificación del trigger `deduct_credit` — fuera del alcance de esta iteración salvo confirmación explícita.

### 2.e — Bloquear página de Planes/Precios

- No existe ruta `/pricing` ni `/planes` en `src/App.tsx`. Confirmar que el botón "Plan Premium" / upgrade prompts en `BancoPreguntas.tsx`, `CrearPrueba.tsx`, etc. queden **ocultos** cuando `currentProfile?.colegioId`. Auditar y añadir guarda `!isInstitutional` a cualquier CTA de upgrade.

## 3. Branding restringido para UTP

`src/pages/Configuracion.tsx` (líneas 446–476, sección "Datos del colegio" en pestaña Políticas)
- **Habilitar** subida de logo: agregar input file + botón "Subir logo" + botón "Eliminar". Usar el bucket `user-logos` existente. Path: `colegios/{colegioId}/logo.{ext}`.
- Al subir: `supabase.storage.from('user-logos').upload(path, file, {upsert:true})` → obtener publicUrl → `update colegios set logo_url=... where id=colegioId`.
- **Mantener readonly** el campo "Nombre del colegio" para UTP. Mostrar un Input deshabilitado con tooltip "Solo el Administrador puede modificarlo".

RLS:
- La tabla `colegios` actualmente solo permite `UPDATE` a `admin`. **Agregar política**: `utp_head` puede `UPDATE` solo el campo `logo_url` de su propio colegio (`id = (SELECT colegio_id FROM profiles WHERE id = auth.uid())`).
- Como Postgres RLS no restringe columnas, la solución es: política UPDATE para utp_head con `USING (id = colegio_id_del_usuario)`, y un **trigger BEFORE UPDATE** que rechace cambios en `nombre` cuando el actor no es admin (`NEW.nombre <> OLD.nombre AND NOT has_role(auth.uid(),'admin')` → `RAISE EXCEPTION`).
- Storage: política en `storage.objects` para `bucket_id='user-logos'` permitiendo `INSERT/UPDATE/DELETE` cuando el path empieza con `colegios/{su colegio_id}/` y el usuario es UTP/admin.

## 4. Filtrado de plantillas (regla de nivel)

`src/components/test-builder/AssessmentMetaForm.tsx` (selector de formato, líneas 249–308)
- Cambiar la lógica de gating de SIMCE/PAES de `allowed_levels` a comparación por **prefijo de grade_value**, porque en `catalog.ts` III/IV Medio comparten `level: "Media"` con I/II Medio:
  - `isBasica = gradeValue.includes("Básico")`
  - `isMediaInicial = /^(I|II)Medio/.test(gradeValue)` (excluye III/IV)
  - `isMediaSuperior = /^(III|IV)Medio/.test(gradeValue)`
  - SIMCE habilitado si `isBasica || isMediaInicial || !gradeValue`
  - PAES habilitado si `isMediaSuperior || !gradeValue`
  - Estándar siempre.
- Mantener el fallback automático a Estándar en `setGrade` cuando el formato actual deja de ser válido (lógica ya implementada; ajustarla al nuevo criterio).
- En `src/lib/templates.ts`, dejar `allowed_levels` como está (no se usa para gating runtime, pero queda como metadata).

## 5. Limpieza de perfiles en listado UTP

`src/components/admin/UtpUsageManager.tsx` (línea 244)
- Reemplazar `<Badge>{r.planType}</Badge>` por: si la fila pertenece a un usuario con `colegio_id` (siempre cierto en este manager porque ya filtra por colegio del UTP) → `<Badge>Docente Institucional</Badge>`. Eliminar también `planType` del CSV export (línea 176) o reemplazarlo por la misma etiqueta.

## Cambios de base de datos (resumen)

1. `admin_courses`: agregar columnas `created_by uuid REFERENCES auth.users(id)` y `colegio_id uuid REFERENCES colegios(id)`. Nuevas políticas RLS para `INSERT/UPDATE/DELETE` por utp_head sobre filas propias.
2. `colegios`: nueva política `UPDATE` para `utp_head` sobre su propio colegio + trigger `BEFORE UPDATE` que prohíbe cambiar `nombre` si no es admin.
3. `storage.objects` (bucket `user-logos`): política para `colegios/{colegio_id}/...` por utp_head/admin.
4. `handle_new_user()`: si `v_colegio_id IS NOT NULL` → `v_default_credits := 0`.

## Archivos a crear/modificar

| Archivo | Cambio |
|---|---|
| `src/pages/Configuracion.tsx` | Reordenar tabs UTP, renombrar a "Cursos", reemplazar contenido por `UtpCoursesManager`, habilitar upload de logo en pestaña Políticas |
| `src/components/utp/UtpCoursesManager.tsx` (nuevo) | Asistente triple con label readonly |
| `src/components/AppLayout.tsx` | Ocultar todo plan/credits para institucionales |
| `src/pages/CrearPrueba.tsx` | Mostrar "Créditos institucionales: N" junto al generador IA |
| `src/components/test-builder/AssessmentMetaForm.tsx` | Gating SIMCE/PAES por prefijo de grade_value |
| `src/components/admin/UtpUsageManager.tsx` | Badge "Docente Institucional" en lugar de plan_type |
| Migraciones SQL | Cambios descritos arriba |

## Preguntas abiertas

Antes de implementar §2.d (bolsa colectiva real de créditos por colegio), necesito confirmación. Por defecto este plan **NO** implementa una tabla `colegio_credits` separada — el saldo sigue siendo personal por usuario, solo que arranca en 0 para institucionales y el UTP/Admin puede recargar individualmente. Si quieres que sea una bolsa única compartida por todos los docentes del colegio, hay que diseñar:
- Tabla `colegio_credits (colegio_id, credits_available)`.
- Modificar `deduct_credit` para descontar de la bolsa del colegio cuando `profiles.colegio_id IS NOT NULL`.
- UI nueva en panel UTP/Admin para recargar la bolsa.

¿Implementamos solo el "credits=0 inicial" (más simple, esta iteración) o también la bolsa colectiva (requiere cambios mayores)?
