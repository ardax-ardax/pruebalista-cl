
# Plan: Jerarquía institucional + inteligencia curricular completa

## 1. Roles y seguridad (Supabase + frontend)

**Migración SQL** (un solo archivo):
- Agregar `'utp_head'` al enum `app_role` (`ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'utp_head';`).
- Crear función helper `public.is_staff(_user_id uuid)` SECURITY DEFINER que retorne `true` si es admin o utp_head (evita repetir `OR` en cada policy).
- Reemplazar las 4 policies de `assessments`:
  - `SELECT/UPDATE/DELETE`: `using = (user_id = auth.uid()) OR public.is_staff(auth.uid())`.
  - `INSERT`: sigue siendo `user_id = auth.uid()` (UTP/admin crean para sí mismos; supervisan al resto).
- Reusar policies existentes para `profiles` y `curriculum_base` (ya admiten admin; ampliar a `is_staff` donde aplique para UTP).

**Frontend** (`src/hooks/useAuth.tsx`):
- Cambiar `isAdmin: boolean` por `role: 'admin' | 'utp_head' | 'user' | null` y mantener `isAdmin`/agregar `isUtpHead`/`isStaff` derivados para no romper consumers existentes.
- Cargar el rol con `select role` (sin `.eq('role','admin')`) y tomar el de mayor privilegio.

**`src/components/AdminGuard.tsx`**:
- Renombrar lógica interna a "staff guard": permitir si `isAdmin || isUtpHead`. Mensaje de error genérico ("Solo personal autorizado").

## 2. Asignaciones docente ↔ curso ↔ asignatura

**Tabla nueva** `public.teacher_assignments`:
```
id uuid pk default gen_random_uuid(),
teacher_user_id uuid not null,        -- referencia lógica a auth.users (perfil)
grade_value text not null,             -- value del catálogo (ej "3ºBásico")
subject_value text not null,           -- value del catálogo (ej "Matemática")
created_at timestamptz default now(),
unique(teacher_user_id, grade_value, subject_value)
```
RLS:
- SELECT: el propio docente ve las suyas; staff ve todas.
- INSERT/UPDATE/DELETE: solo `is_staff`.

**Helpers** en `src/lib/teacher-assignments.ts` (nuevo): `listAll()`, `listForTeacher(uid)`, `upsert(...)`, `remove(id)`.

**`src/pages/Configuracion.tsx`**:
- Nueva sección "Asignaciones de docentes" (visible solo para staff vía `AdminGuard`/condicional). Para cada docente (de `profiles`), permitir agregar combinaciones `Curso + Asignatura` (selectores poblados desde `catalog.ts`, filtrando asignaturas válidas por nivel del curso). Tabla con sus asignaciones actuales y botón "Eliminar".

**`src/components/test-builder/AssessmentMetaForm.tsx`**:
- Aceptar nuevo prop `restrictedAssignments?: TeacherAssignment[]` (o null para staff).
- Si `restrictedAssignments` viene seteado:
  - Filtrar `grades` a los que aparecen en sus asignaciones.
  - Filtrar `availableSubjects` adicionalmente por las parejas exactas curso+asignatura asignadas (no basta el nivel).
- Bonus: corregir bug actual — el JSX duplica el selector "Docente" (líneas 102–119); dejar uno solo.
- En `CrearPrueba.tsx`, cargar `listForTeacher(user.id)` cuando el rol sea `'user'` y pasarlo al form. Para staff pasar `null` (catálogo completo).

## 3. Cerebro curricular (1° Básico → 4° Medio)

**`src/lib/curriculum-data.ts`** ya cubre 1°–6° Básico para Lenguaje/Matemática/Ciencias. Extender con OAs e indicadores oficiales Mineduc para:
- 7° y 8° Básico: Lengua, Matemática, Ciencias Naturales, Historia, Inglés.
- I°–II° Medio: Lengua y Literatura, Matemática, Biología/Física/Química, Historia, Inglés.
- III°–IV° Medio (plan común): Lengua y Literatura, Matemática, Ciencias para la Ciudadanía, Educación Ciudadana, Filosofía, Inglés.
- Mantener fallback a `TRANSVERSAL_SKILLS` si no hay datos.

Estimado: ~120 OAs adicionales con 2–3 indicadores cada uno. Volumen factible en un solo archivo (~1.200 líneas finales).

**Flujo del editor** ya es Curso → Asignatura → OA → Indicador (implementado). Solo se valida que `AIGenerateDialog` siga consumiendo el OA seleccionado y los indicadores opcionales.

**Edge function `generate-question`** (mejora):
- Ampliar el tool schema de los 3 tipos para que la IA devuelva además:
  - `difficulty: "baja" | "media" | "alta"`.
  - `rubricExplanation: string` (explicación pedagógica + respuesta correcta detallada para la pauta de corrección).
- Inyectar estos campos en el prompt como obligatorios.
- En `assessment-ai.ts` y `assessment-schema.ts`: agregar campos opcionales a `Question`:
  - `difficulty?: "baja" | "media" | "alta"`.
  - `rubric?: string` (explicación corrección).
  - `sourceOA?: string`, `sourceIndicators?: string[]` (trazabilidad para pauta).
- `coerceGeneratedQuestion` setea estos campos a partir del payload de la IA y los argumentos originales.

## 4. Supervisión UTP en `MisPruebas.tsx`

- Reemplazar `isAdmin` por `isStaff` en las condiciones (filtros, "Ver todas", "Filtrar por docente").
- Texto de cabecera: detectar rol y mostrar "Administrador" / "Jefe UTP" / "Mis pruebas".
- Edición ya funciona: la policy UPDATE de `assessments` permite a staff editar cualquier fila, así que abrir `?id=...` funciona sin cambios extra en `CrearPrueba.tsx`.
- Agregar un filtro adicional "Por curso" y "Por asignatura" usando el catálogo, útil para UTP.

## 5. Exportación: encabezado + pauta de corrección

**Encabezado** (PDF/HTML en `assessment-render.tsx` y DOCX en `assessment-docx.ts`):
- Hoy ya imprime "OA evaluados: …" (códigos). Ampliar a una línea adicional con la **descripción corta** del primer OA (truncada) o, si caben, listado `código — descripción`.
- Agregar línea "Indicadores: …" con los indicadores derivados de las preguntas generadas (campo `sourceIndicators` de cada `Question`), deduplicados.

**Pauta de Corrección automática**:
- Nuevo módulo `src/lib/assessment-rubric.ts` que recibe `Assessment` y produce una estructura `RubricSection[]`:
  - Para cada pregunta numerada: número, título, OA + indicadores asociados, respuesta correcta (alternativa correcta para MC, V/F por afirmación, criterio para desarrollo basado en `rubric` de la IA o texto manual), puntaje y dificultad.
- En `assessment-render.tsx`:
  - Nueva sección final `<div class="pa-rubric">` con CSS `page-break-before: always`. Renderizada bajo el footer.
  - Toggle visual en el preview (checkbox "Incluir pauta") y al exportar siempre se incluye en una segunda hoja.
- En `assessment-docx.ts`:
  - Nueva sección con `pageBreakBefore: true` que genera tabla de pauta (Nº | OA | Indicador | Respuesta correcta | Puntaje).
- En `assessment-pdf.ts`: nada extra (sigue imprimiendo el HTML completo).

## 6. Persistencia y borradores

**`src/lib/assessment-schema.ts`**: ampliar `Question` con los campos opcionales (`difficulty`, `rubric`, `sourceOA`, `sourceIndicators`). Como son opcionales, los borradores antiguos en IndexedDB siguen siendo válidos. Actualizar `migrateQuestion` para no romper nada (ya no requiere migraciones específicas).

**`src/lib/assessment-storage.ts`**: el `data` se guarda como JSONB en Supabase, por lo que los nuevos campos quedan automáticamente persistidos.

## Detalles técnicos clave

```text
Roles
  admin    → todo (incluida gestión curricular y catálogos)
  utp_head → ver/editar todas las pruebas, asignar docentes, ver curriculum manager
  user     → solo sus pruebas, solo cursos/asignaturas asignados

Filtrado en AssessmentMetaForm (rol = user)
  grades   = grades.filter(g => assignments.some(a => a.grade_value === g.value))
  subjects = getSubjectsForGrade(...) ∩ assignments where grade matches
```

## Archivos a crear

- `supabase/migrations/<timestamp>_roles_assignments.sql`
- `src/lib/teacher-assignments.ts`
- `src/lib/assessment-rubric.ts`
- `src/components/admin/TeacherAssignmentsManager.tsx`

## Archivos a editar

- `src/hooks/useAuth.tsx`
- `src/components/AdminGuard.tsx`
- `src/lib/assessment-schema.ts`
- `src/lib/assessment-ai.ts`
- `src/lib/assessment-render.tsx`
- `src/lib/assessment-docx.ts`
- `src/lib/curriculum-data.ts` (extensión 7° Básico → 4° Medio)
- `src/components/test-builder/AssessmentMetaForm.tsx` (filtro + bug docente duplicado)
- `src/components/test-builder/AIGenerateDialog.tsx` (recibir difficulty/rubric desde IA)
- `src/pages/CrearPrueba.tsx` (cargar asignaciones según rol)
- `src/pages/Configuracion.tsx` (nueva sección asignaciones)
- `src/pages/MisPruebas.tsx` (isStaff + filtros adicionales)
- `supabase/functions/generate-question/index.ts` (difficulty + rubricExplanation)

¿Apruebas este plan para implementarlo?
