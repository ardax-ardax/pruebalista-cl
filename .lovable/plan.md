
## Bug 1: Empty Course/Subject selectors when editing assessments

### Root cause
The fallback logic in `AssessmentMetaForm.tsx` (lines 161-168 and 189-196) already adds placeholder options when the grade/subject value isn't in the loaded list. However, `getSubjectsForGrade()` returns `[]` when it can't determine the grade's level (line 227: `if (!level) return []`). This happens because:

1. `subjects` in `CrearPrueba.tsx` are loaded from `loadSubjects()` (localStorage/defaults) — these are available synchronously.
2. `grades` come from `useAdminCourses()` which is async (Supabase query). While grades are loading, the `grades` array is empty.
3. When `grades` is empty, `getSubjectsForGrade()` can't find the level for the grade value, returns `[]`, and the fallback in `availableSubjects` only checks `byLevel` and `subjects` — but since the level lookup fails, the whole chain produces nothing meaningful.

The existing fallback at line 193-196 adds a placeholder `{ value, label }` without a `level`, which helps the Select show a value, but the real issue is that subjects don't filter correctly until grades load.

### Fix (AssessmentMetaForm.tsx)
- In the `availableSubjects` useMemo, when `grades` array is empty but `meta.gradeValue` exists, bypass the level-based filtering and show all subjects (or at minimum the saved subject as a fallback). This ensures that even before `useAdminCourses` resolves, the selector shows the correct value.
- Specifically: if `getSubjectsForGrade` returns an empty array AND `meta.subjectValue` is set, ensure the fallback placeholder is always added.

The current code already does this (line 189-196), but there's a subtle issue: `byLevel` is empty (because grades haven't loaded), so the `filtered.some()` check passes vacuously, and the fallback path may not trigger correctly in all scenarios. We'll make the fallback more robust.

### Fix (CrearPrueba.tsx)
- Pass `gradesLoading` state down to prevent the form from appearing "ready" while data is still loading. Show a skeleton/spinner on the meta form tab while `gradesLoading` is true and an assessment is being edited.

---

## Bug 2: "Plan Gratuito" visible for institutional users in dropdown menu

### Root cause
The header badge (lines 114-123) correctly hides credits for institutional users. But inside the **dropdown menu** (lines 148-157), the `planLabel` badge is shown unconditionally — it only checks `!usageLoading`, not `isInstitutional` or `shouldHideCredits`. So institutional users see "Free" or "Plan Gratuito" inside the avatar dropdown.

### Fix (AppLayout.tsx)
- Wrap the plan info block (lines 148-157) with the same `profileLoaded && !shouldHideCredits && !isInstitutional` condition.
- For institutional users, show the colegio name or "Cuenta Institucional" instead of plan info inside the dropdown.

---

## Bug 3: useAuth doesn't expose colegio_id

### Current state
`useAuth` does not load or expose `colegio_id` — this is loaded separately in each component via `getMyProfile()`. This is fine architecturally but causes the flickering issue because each component independently fetches the profile.

### No change needed
The current pattern (each component calls `getMyProfile()` with a `profileLoaded` guard) is adequate. The real fix is Bug 2 above.

---

## Files to modify

1. **`src/components/AppLayout.tsx`** — Hide plan label in dropdown for institutional users
2. **`src/components/test-builder/AssessmentMetaForm.tsx`** — Make subject fallback more robust when grades haven't loaded
3. **`src/pages/CrearPrueba.tsx`** — Show loading state while grades are loading during edit mode
