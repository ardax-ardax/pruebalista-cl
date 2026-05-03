## 3 fixes for docente Pro user

### 1. Docente autonomy based on colegio_id (not assignments)

**Problem**: `isAutonomous` currently checks if the docente has zero `teacher_assignments`. This user has a self-assigned course but `colegio_id = NULL`, so the "Enviar a Revisión UTP" button appears despite having no UTP to send to.

**Rule from project memory**: "Docentes autónomos (sin colegio_id) no pertenecen a ningún colegio."

**Fix**:
- **`src/lib/profiles.ts`**: Add `colegioId` to the `Profile` interface and include `colegio_id` in all profile queries.
- **`src/pages/CrearPrueba.tsx`**: Change `isAutonomous` to `!isStaff && !currentProfile?.colegioId`. A docente without colegio is always autonomous, regardless of assignments.
- **`src/pages/MisPruebas.tsx`**: Apply same logic if UTP review status is shown there.

### 2. AI generates questions in English for "Inglés" subject

**Problem**: The system prompt says "Redacta en español de Chile" but the AI still generates in English when the subject is Inglés.

**Fix** in `supabase/functions/generate-question/index.ts`: Add an explicit rule to the system prompt:
```
- IMPORTANTE: Redacta SIEMPRE el enunciado, las alternativas y la pauta en español de Chile, incluso si la asignatura es Inglés u otro idioma extranjero. Solo los textos que formen parte del contenido evaluado (por ejemplo, un fragmento en inglés que el alumno debe analizar) pueden estar en otro idioma.
```

### 3. Credits not matching Pro plan

**Problem**: The user was created with 20 credits (old hardcoded default) but their Pro plan defines `default_credits: 200`. Their `user_usage` row has `credits_available: 18`.

**Fix**: Two parts:
- **Migration**: Update the existing user's credits to match their plan's default (only if current credits are lower than plan default, to not penalize users who already used credits).
- **`handle_new_user` trigger**: Already reads from `plans` table -- this is correct. No change needed.
- **Admin action**: When changing a user's plan in AdminDashboard, also reset their credits to the new plan's `default_credits`. Check if this already happens.

### Files to modify

| File | Change |
|------|--------|
| `src/lib/profiles.ts` | Add `colegioId` field to Profile |
| `src/pages/CrearPrueba.tsx` | Use `colegioId` for autonomy check |
| `src/pages/MisPruebas.tsx` | Same autonomy fix if applicable |
| `supabase/functions/generate-question/index.ts` | Add Spanish-only rule to prompt |
| `src/pages/AdminDashboard.tsx` | Ensure plan change updates credits |
| Migration SQL | Update existing Pro user credits |
