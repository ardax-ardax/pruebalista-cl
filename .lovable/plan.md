# Logo no visible para otros usuarios — Causa y plan

## Diagnóstico

El logo y el nombre del colegio se guardan en **`localStorage`** del navegador del admin (`loadLogo()` / `saveLogo()` en `src/lib/templates.ts` usan claves locales `LOGO_KEY` e `INSTITUTION_KEY`).

Por eso `ardax.ardax@gmail.com`, al ingresar desde otro navegador/sesión, ve la previsualización **sin logo y con el nombre por defecto** ("New Little College La Florida"): nunca se cargó nada en *su* `localStorage`.

La marca institucional debe ser **global del colegio**, no por usuario.

## Solución

Mover logo + nombre institucional a la tabla `app_settings` (que ya existe y es global, leíble por todos los autenticados, escribible solo por admin).

### 1. Base de datos (migración)

Agregar a `public.app_settings`:
- `institution_name text` (default `'New Little College La Florida'`)
- `institution_logo text` (data-URL base64, nullable)

Las RLS existentes ya cubren el caso (todos leen, solo admin escribe).

### 2. Capa de datos (`src/lib/app-settings.ts`)

Extender `AppSettings`, `loadAppSettings()` y `saveAppSettings()` para incluir `institutionName` y `institutionLogo`.

### 3. Configuración (`src/pages/Configuracion.tsx`)

- Al guardar logo / nombre institucional, persistir en `app_settings` (además de `localStorage` como caché opcional).
- Al cargar, leer primero del backend; si existe, sobrescribir caché local.

### 4. Crear Prueba (`src/pages/CrearPrueba.tsx`)

- Reemplazar `setLogo(loadLogo())` y `setInstitutionName(loadInstitutionName())` por una carga desde `loadAppSettings()`.
- Mantener listeners `storage`/`focus` solo como refresco adicional.
- La previsualización (`AssessmentPreview` → `renderAssessmentHtml`) ya recibe `logoDataUrl` e `institutionName` por contexto, así que no requiere cambios.

### 5. Migración suave para el admin

Si `app_settings.institution_logo` está vacío pero hay un logo en `localStorage` del admin actual, ofrecer subirlo automáticamente al backend al entrar a Configuración (one-shot upload).

## Resultado esperado

Cualquier usuario (admin, UTP o docente), en cualquier navegador, verá el mismo logo y nombre del colegio en la previsualización de pruebas, porque ambos se sirven desde la base de datos compartida.

## Notas técnicas

- Tamaño del logo: data-URL puede pesar; recomendable validar < 500 KB antes de guardar.
- No se rompen exports PDF/DOCX porque siguen recibiendo el `logoDataUrl` desde `RenderContext`.
