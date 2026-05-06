## Problem Analysis

### 1. UTP Visibility (Docentes)
The code in `UtpTeamManager` and `UtpReviewCenter` is **correct** — it queries `profiles` filtered by `colegio_id`. The RLS policy allows UTP (via `is_staff`) to read all profiles. The actual issue is that **no docentes currently have `colegio_id` set** in the database matching the UTP's colegio. Only the UTP user (`ardax.ardax@gmail.com`) has `colegio_id = b061bcad-...`. Once docentes are linked to the colegio (via ColegiosManager), they will appear.

However, to aid debugging, we'll add a `console.log` as requested.

### 2. PAES Filter (Empty courses)
The `PAES_ALLOWED_GRADES` constant uses values with section letters appended (`IIIMedioA`, `IIIMedioB`, `IVMedioA`, `IVMedioB`), but the actual `grade_value` in the system is just `IIIMedio` and `IVMedio`. This means the filter never matches any grade, resulting in an empty selector.

### 3. SIMCE Filter (Missing II Medio)
Similarly, `SIMCE_ALLOWED_GRADES` uses `IIMedioA` and `IIMedioB`, but the real value is `IIMedio`.

---

## Changes

### File: `src/components/test-builder/AssessmentMetaForm.tsx`

**Lines 29-30** — Fix the grade constants:

```typescript
const SIMCE_ALLOWED_GRADES = new Set(["4ºBásico", "6ºBásico", "8ºBásico", "IIMedio"]);
const PAES_ALLOWED_GRADES = new Set(["IIIMedio", "IVMedio"]);
```

### File: `src/components/admin/UtpTeamManager.tsx`

Add a `console.log` after resolving `profile.colegioId` (around line 42) to print the colegio_id for debugging:

```typescript
console.log("[UtpTeamManager] colegio_id del usuario actual:", profile.colegioId);
```

### File: `src/components/admin/UtpReviewCenter.tsx`

Add a similar `console.log` after resolving the profile's colegioId (around line 83):

```typescript
console.log("[UtpReviewCenter] colegio_id del usuario actual:", profile.colegioId);
```

### File: `src/pages/Configuracion.tsx` (or wherever config loads)

Add a log when the user profile is loaded to confirm colegio_id is read correctly.

---

## Summary of Root Causes

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| UTP can't see docentes | No docentes have matching `colegio_id` in DB | Data issue — code is correct. Add debug logs. |
| PAES courses empty | `PAES_ALLOWED_GRADES` has `IIIMedioA/B` instead of `IIIMedio` | Fix constant |
| SIMCE missing II Medio | `SIMCE_ALLOWED_GRADES` has `IIMedioA/B` instead of `IIMedio` | Fix constant |
