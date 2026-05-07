
## Changes in `src/pages/CrearPrueba.tsx`

### 1. Add `originalMetaRef` (after line 81)
Add a new ref to preserve original `gradeValue`/`subjectValue` loaded from DB:
```ts
const originalMetaRef = useRef<{ gradeValue: string; subjectValue: string } | null>(null);
```

### 2. Save original values when loading from DB (line ~224)
After loading assessment from DB, store original meta values:
```ts
if (found) {
  console.log("[CrearPrueba] Loaded from DB — gradeValue:", found.meta.gradeValue, ...);
  loadedAssessmentIdRef.current = found.id;
  userHasEditedRef.current = false;
  originalMetaRef.current = { gradeValue: found.meta.gradeValue, subjectValue: found.meta.subjectValue };
  setAssessment(found);
}
```

### 3. Protect autosave against empty critical fields (line ~296-311)
Add a guard inside the `editingId` autosave branch. If the assessment was loaded from DB with non-empty values but the current state has empty `gradeValue`/`subjectValue`, restore original values before saving (or skip the save):
```ts
if (editingId) {
  debounceTimerRef.current = setTimeout(() => {
    // Protect against overwriting valid data with empty values
    let toSave = assessment;
    if (originalMetaRef.current) {
      const orig = originalMetaRef.current;
      const meta = toSave.meta;
      if (!meta.gradeValue && orig.gradeValue) {
        toSave = { ...toSave, meta: { ...meta, gradeValue: orig.gradeValue, subjectValue: meta.subjectValue || orig.subjectValue } };
      } else if (!meta.subjectValue && orig.subjectValue) {
        toSave = { ...toSave, meta: { ...meta, subjectValue: orig.subjectValue } };
      }
    }
    setSaveStatus("saving");
    clearTimeout(saveTimerRef.current);
    upsertAssessment(toSave)
      .then(() => { ... })
      .catch((e) => { ... });
  }, 1500);
}
```

### 4. Remove destructive `key` prop from AssessmentMetaForm (line ~724)
Change:
```tsx
<AssessmentMetaForm
  key={gradesLoading ? "loading" : "ready"}
```
To:
```tsx
<AssessmentMetaForm
```
This prevents the full component re-mount that resets internal state and triggers onChange with empty values.

### 5. Fix `readOnlyExceptOA` for rejected assessments with empty fields (line ~735)
Currently: `readOnlyExceptOA={!isStaff && !!editingId && !readOnly}` — this makes course/subject selectors read-only for docentes editing their own assessments, even when rejected with empty values.

Change to allow editing when critical fields are empty:
```tsx
readOnlyExceptOA={!isStaff && !!editingId && !readOnly && !!(assessment?.meta.gradeValue && assessment?.meta.subjectValue)}
```
This way, if `gradeValue` or `subjectValue` is empty, the full form is editable so the docente can fix the data.

### 6. Validate before re-submit (already handled)
The existing `handleSubmitForReview` calls `validate()` which checks `!assessment.meta.gradeValue` and `!assessment.meta.subjectValue` — this already blocks re-submission with empty fields. No change needed here.

## No other files need changes. No database migrations needed.
