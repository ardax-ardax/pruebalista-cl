
# Banco de Preguntas

## Resumen

Todas las preguntas (generadas con IA o creadas manualmente) se guardan automáticamente en un banco centralizado. Cada rol tiene su nivel de acceso:

- **Docente**: ve y reutiliza solo sus propias preguntas.
- **Jefe UTP**: ve todas las preguntas de la institución (lectura).
- **Admin**: ve todas las preguntas con controles completos (filtros, eliminar).

---

## 1. Tabla `question_bank` (migración)

```sql
CREATE TABLE public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_data jsonb NOT NULL,        -- Question completa (mismo schema)
  question_type text NOT NULL,          -- "multiple-choice", "true-false", "short-answer"
  subject_value text,                   -- asignatura
  grade_value text,                     -- nivel
  oa_code text,                         -- OA vinculado
  difficulty text,                      -- "baja", "media", "alta"
  source text NOT NULL DEFAULT 'manual', -- "manual" | "ai"
  title text,                           -- título corto para búsqueda
  prompt_preview text,                  -- primeros ~120 chars del enunciado
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**RLS**:
- SELECT: `user_id = auth.uid()` (docente ve las suyas) + `is_staff(auth.uid())` (staff ve todas).
- INSERT: `user_id = auth.uid()` (cada usuario inserta las suyas).
- DELETE: `user_id = auth.uid() OR has_role(auth.uid(), 'admin')` (docente borra las suyas, admin borra cualquiera).
- UPDATE: no se permite (las preguntas del banco son inmutables; se copian al usarlas).

---

## 2. Guardado automático de preguntas

**Cuándo se guarda**: cada vez que el docente guarda una evaluación (`saveAssessment`), se extraen las preguntas de tipo evaluable (no `info-block` ni `section-title`) y se insertan en `question_bank` con un `ON CONFLICT DO NOTHING` basado en un hash o simplemente insertando siempre (el banco crece).

**Archivo**: `src/lib/question-bank.ts` (nuevo)
- `saveQuestionsToBank(questions, meta)`: recorre las preguntas, arma los rows y hace un batch insert.
- `searchBank(filters)`: consulta con filtros opcionales (type, subject, grade, oa, difficulty, texto).
- `deleteFromBank(id)`: elimina una pregunta.

**Integración**: en `src/lib/assessment-storage.ts`, dentro de `saveAssessment`, se llama a `saveQuestionsToBank` después del upsert exitoso.

---

## 3. Página "Banco de Preguntas" (`/banco-preguntas`)

**Archivo**: `src/pages/BancoPreguntas.tsx` (nuevo)

**UI**:
- Barra de filtros: tipo de pregunta, asignatura, nivel, OA, dificultad, origen (IA/manual), búsqueda por texto.
- Tabla/lista de preguntas con: enunciado (preview), tipo, asignatura, nivel, dificultad, autor, fecha.
- Para Admin: columna "Autor" visible + botón eliminar.
- Para UTP Head: misma vista pero sin eliminar.
- Para Docente: solo sus preguntas, con opción de eliminar las propias.

**Ruta**: se agrega en `App.tsx` protegida con `AuthGuard`.
**Menú**: se agrega enlace "Banco de Preguntas" en `AppLayout.tsx`.

---

## 4. Reutilizar preguntas desde el builder

**Archivo**: `src/components/test-builder/QuestionBankDialog.tsx` (nuevo)

Diálogo modal que se abre desde `QuestionList.tsx` con un botón "Desde banco". Muestra los mismos filtros de la página pero en formato compacto. El docente selecciona preguntas con checkbox y al confirmar se copian (con nuevos IDs) a la evaluación activa.

**Integración**: en `QuestionList.tsx` se agrega un botón junto a "Agregar pregunta" y "Generar con IA".

---

## 5. Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `supabase/migrations/...sql` | Crear tabla + RLS |
| `src/lib/question-bank.ts` | Nuevo: CRUD del banco |
| `src/lib/assessment-storage.ts` | Modificar: llamar a saveQuestionsToBank en saveAssessment |
| `src/pages/BancoPreguntas.tsx` | Nuevo: página completa con filtros |
| `src/components/test-builder/QuestionBankDialog.tsx` | Nuevo: diálogo para reutilizar |
| `src/components/test-builder/QuestionList.tsx` | Modificar: agregar botón "Desde banco" |
| `src/App.tsx` | Agregar ruta /banco-preguntas |
| `src/components/AppLayout.tsx` | Agregar enlace en menú lateral |
