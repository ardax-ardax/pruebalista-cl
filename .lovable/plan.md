# Cierre del módulo institucional

## 1. Filtrado SIMCE/PAES por nivel del curso

**Regla:**
- **Básica** (1°–8°) y **I–II Medio**: botones `Estándar` + `SIMCE` activos. PAES deshabilitado.
- **III–IV Medio**: botones `Estándar` + `PAES` activos. SIMCE deshabilitado.
- `Estándar` siempre disponible.
- Si aún no hay curso elegido, los tres botones quedan activos (sin restricción).

**Cambios:**

`src/lib/templates.ts`
- Agregar campo opcional `allowed_levels?: ("Básica" | "Media" | "ElectivoMedia")[]` al tipo `FormatTemplate`.
- Poblar built-ins:
  - `ensayo-simce` → `["Básica", "Media"]` (SIMCE aplica a Básica y II Medio que es Media).
  - `ensayo-paes` → `["ElectivoMedia"]`.
  - Resto (Ev. Formativa, Sumativa, Guía Portafolio) → `undefined` (= todos los niveles).

`src/components/test-builder/AssessmentMetaForm.tsx`
- Reemplazar el bloque de botones de formato (líneas 250–273) por una versión que:
  - Calcule `currentLevel` desde `meta.gradeValue` usando `getLevelForGrade(meta.gradeValue, grades)` + lógica electiva (`III/IVMedio` ⇒ permite también `ElectivoMedia`).
  - Para cada opción, determine `disabled` consultando `allowed_levels` de la plantilla asociada (`SIMCE_TEMPLATE_ID`, `PAES_TEMPLATE_ID`). `Estándar` nunca se deshabilita.
  - Botón deshabilitado: `opacity-40`, `cursor-not-allowed`, `title` explicando el motivo (ej. *"PAES solo está disponible para III y IV Medio"*).
  - Si el formato actualmente seleccionado deja de ser válido al cambiar de curso, `handleGradeChange` ya hace `updates.gradeValue = ""` cuando el formato fuerza un nivel incompatible. Adicionalmente, hay que invertir el flujo: si el usuario cambia el curso a uno incompatible con el formato actual, hacer fallback a `Estándar`.

## 2. Logo del colegio en el PDF

**Estado actual** (verificado en `src/pages/CrearPrueba.tsx`):
- Líneas 167–199: si el perfil tiene `colegioId`, se hace fetch a `colegios.logo_url`, se resuelve a URL pública si es path de Storage, y se setea `setLogo(resolvedLogo)` + `setInstitutionName(col.nombre)`.
- Línea 407: `RenderContext.logoDataUrl = logo`.
- `assessment-render.tsx` líneas 231/240: usa `logoDataUrl` en `<td class="pa-logo-cell">` del banner.
- `assessment-pdf.ts`: pasa el mismo `RenderContext` a la generación PDF.

**Diagnóstico:** el flujo ya es correcto. Solo se requiere QA defensivo para que no regrese el bug:
- Quitar el `console.log("[CrearPrueba] colegio_id…")` (línea 170) y reemplazarlo por una traza más útil cuando `colegioId` existe pero el fetch a `colegios` retorna `null` o `logo_url` vacío (toast silencioso o `console.warn`).
- Añadir test rápido manual: confirmar con UTP/docente institucional que al exportar PDF aparece el logo correcto.
- No se modifica schema ni RenderContext.

## 3. Limpieza final de UI: eliminar "Plan Gratuito" residual

**Estado actual:**
- `AppLayout.tsx`: el badge `planLabel` ya está gateado por `!shouldHideCredits && !isInstitutional` (líneas 120/156). Para institucional NO debería mostrarse.
- `Perfil.tsx`: la card "Plan actual" ya está dentro del else `!isInstitutional` (líneas 318–340).
- `DashboardDocente.tsx` y `DocenteDashboardInstitucional.tsx`: importan `planLabel` pero **no lo renderizan** (imports muertos).

**Cambios para garantizar que no haya regresión visual:**

`src/components/AppLayout.tsx`
- Asegurar que el placeholder "Cargando…" (líneas 166–170) no muestre nada cuando el usuario es claramente institucional aún en carga: agregar una guarda extra con `isStaff && !isAdmin` (UTP) para mostrar directamente el badge institucional sin esperar.
- Confirmar visualmente con devtools que para `ardax.ardax@cnlc.cl` (UTP) y un docente con `colegio_id` el dropdown solo muestra: avatar + nombre + email + badge verde "Cuenta Institucional / [Nombre Colegio]" + Mi Perfil + Cerrar sesión. Sin badge `planLabel`.

`src/pages/DashboardDocente.tsx` y `src/pages/DocenteDashboardInstitucional.tsx`
- Eliminar `planLabel` de la destructuración de `useUserUsage()` (imports muertos) para evitar que alguien lo renderice por accidente.

`src/pages/Perfil.tsx`
- Sin cambios funcionales; solo verificar que el render condicional sigue separando institucional vs autónomo correctamente.

## Validación post-cambio

- `npx tsc --noEmit` debe pasar.
- Probar con tres cuentas:
  - **Admin** (admin@cnlc.cl): no aplica filtrado de plantillas (no crea pruebas).
  - **UTP institucional**: ve badge "Cuenta Institucional · [Colegio]", sin "Plan Gratuito".
  - **Docente institucional con curso 7° Básico**: solo ve botones Estándar + SIMCE; PAES deshabilitado con tooltip.
  - **Docente con curso III Medio**: solo ve Estándar + PAES.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/lib/templates.ts` | Añadir `allowed_levels` al tipo + poblar built-ins SIMCE/PAES |
| `src/components/test-builder/AssessmentMetaForm.tsx` | Disabled state en botones de formato según nivel del curso + fallback a Estándar al cambiar curso |
| `src/components/AppLayout.tsx` | Hardening del gating institucional en dropdown durante carga |
| `src/pages/DashboardDocente.tsx` | Limpiar import muerto de `planLabel` |
| `src/pages/DocenteDashboardInstitucional.tsx` | Limpiar import muerto de `planLabel` |
| `src/pages/CrearPrueba.tsx` | Reemplazar `console.log` por `console.warn` defensivo de logo |

Sin cambios en base de datos ni en `assessment-render.tsx` / `assessment-pdf.ts` (el flujo de logo ya es correcto).
