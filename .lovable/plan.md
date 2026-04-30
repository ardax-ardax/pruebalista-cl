# Plan: Indicadores de Evaluación + Gestión Curricular

## 1. Estructura de datos: Indicadores por OA

**`src/lib/curriculum-data.ts`**
- Extender `OA` con `indicators: Indicator[]`:
  ```ts
  export interface Indicator { code: string; description: string; }
  export interface OA { code: string; description: string; eje?: string; indicators: Indicator[]; }
  ```
- Poblar 3–5 indicadores de evaluación por cada OA existente en **Lenguaje, Matemática y Ciencias** de **1° a 6° Básico**, basados en los Programas de Estudio Mineduc (formato `1.1`, `1.2`, etc.).
- Añadir indicadores genéricos a `TRANSVERSAL_SKILLS`.
- Nuevos helpers:
  - `findIndicators(grade, subject, oaCode): Indicator[]`
  - `getEffectiveOAs(grade, subject): OA[]` que fusiona base con overrides admin.

## 2. Capa de overrides + persistencia

**`src/lib/curriculum-overrides.ts` (nuevo)**
- Fuente de verdad efectiva = base (código) + overrides (BD/localStorage).
- API: `loadOverrides()`, `saveOverrideOA(grade, subject, oa)`, `resetOverride(grade, subject, oaCode)`.
- Estrategia híbrida:
  - Si el usuario es admin y la tabla está disponible → lee/escribe en Supabase `curriculum_base`.
  - Fallback inmediato a `localStorage` (clave `curriculum_overrides_v1`) para que funcione antes/aunque falle la BD.
- Cache en memoria con invalidación al guardar.

**Migración Supabase — tabla `curriculum_base`**
```sql
create table public.curriculum_base (
  id uuid primary key default gen_random_uuid(),
  grade_value text not null,
  subject_value text not null,
  oa_code text not null,
  oa_description text not null,
  eje text,
  indicators jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (grade_value, subject_value, oa_code)
);
alter table public.curriculum_base enable row level security;

-- Lectura pública para todos los autenticados
create policy "read curriculum"
  on public.curriculum_base for select
  to authenticated using (true);

-- Solo admin puede insertar/editar/eliminar
create policy "admin write curriculum"
  on public.curriculum_base for all
  to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create trigger curriculum_base_updated_at
  before update on public.curriculum_base
  for each row execute function public.set_updated_at();
```

## 3. Editor de pruebas — paso 2 IA: selección de indicadores

**`src/components/test-builder/AIGenerateDialog.tsx`**
- Tras elegir el OA, mostrar una lista de checkboxes con los `Indicator[]` del OA (vacío → mensaje "Este OA aún no tiene indicadores cargados, se usará el OA completo").
- Estado local `selectedIndicators: string[]` (códigos), opcional, multi-select.
- Botón "Generar" envía también los indicadores escogidos.

**`src/lib/assessment-ai.ts`**
- Extender `GenerateQuestionParams` con `indicators?: { code: string; description: string }[]`.

**`supabase/functions/generate-question/index.ts`**
- Aceptar `indicators` opcional en el payload.
- Inyectar en `userPrompt`:
  ```
  Indicadores específicos a evaluar:
  - 1.2 ...
  - 1.3 ...
  La pregunta debe enfocarse explícitamente en estos indicadores.
  ```
- Reforzar regla en `systemPrompt`: si vienen indicadores, deben primar sobre el OA general.

## 4. Panel "Gestión Curricular" (solo admin)

**`src/components/admin/CurriculumManager.tsx` (nuevo)**
- Renderizado dentro de `Configuracion.tsx`, envuelto en chequeo `isAdmin` (ya existe `useAuth().isAdmin`).
- UI:
  - Selectores **Curso → Asignatura** (mismo patrón que `AssessmentMetaForm`).
  - Lista de OAs (efectivos) con botón "Editar".
  - Dialog de edición: campos `code`, `eje`, `description`, y editor de `indicators` (lista add/remove `code` + `description`).
  - Acciones: **Guardar** (escribe override), **Restaurar base** (elimina override), **Nuevo OA** (solo se persiste como override).
  - Badge "Modificado" si el OA tiene override activo.
- Toda la escritura va por `curriculum-overrides.ts` (BD si admin + tabla disponible, localStorage en cualquier otro caso).

**`src/pages/Configuracion.tsx`**
- Importar `useAuth`, y debajo de "Asignaturas, cursos y docentes" agregar:
  ```tsx
  {isAdmin && <CurriculumManager />}
  ```
- Sin cambios al resto del archivo.

## 5. Integración en el resto del flujo
- `AssessmentMetaForm` y `AIGenerateDialog` consumen vía `getEffectiveOAs` / `findIndicators` para reflejar overrides automáticamente sin tocar lógica de UI.
- `assessment-render.tsx` y `assessment-docx.ts`: sin cambios (los códigos OA seleccionados ya se exportan).

## Archivos afectados
**Nuevos**
- `src/lib/curriculum-overrides.ts`
- `src/components/admin/CurriculumManager.tsx`
- Migración SQL `curriculum_base`

**Editados**
- `src/lib/curriculum-data.ts` (interfaz + indicadores + helper efectivo)
- `src/lib/assessment-ai.ts`
- `src/components/test-builder/AIGenerateDialog.tsx`
- `supabase/functions/generate-question/index.ts`
- `src/pages/Configuracion.tsx`

## Notas técnicas
- La tabla `curriculum_base` **no** se sincroniza automáticamente con la base hard-coded; solo guarda overrides/altas. Esto evita migraciones masivas y permite que las actualizaciones de Mineduc en código sigan llegando vía deploys.
- Los códigos `OA` referenciados en assessments existentes (`linkedOA: string[]`) siguen funcionando: solo cambia el contenido descriptivo/indicadores que se muestra/exporta.
- Si la inserción a Supabase falla (offline / permisos), se cae a `localStorage` y se notifica con `toast`.

¿Apruebas este plan para implementarlo?
