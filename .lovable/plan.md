
## Context

The project uses `colegio_id` in the `profiles` table (not `organization_id`). The existing `UtpTeamManager` and `UtpReviewCenter` already query by `colegio_id`, but when it's NULL the UI silently shows nothing. There's also no admin tool to manually assign existing users to a colegio.

## Changes

### 1. Add friendly empty state when `colegioId` is NULL

**Files:** `UtpReviewCenter.tsx`, `UtpTeamManager.tsx`

When `profile.colegioId` is null, show a clear message: *"Tu cuenta aún no ha sido vinculada a un establecimiento. Contacta al administrador."* instead of silently returning empty content.

- `UtpTeamManager` already has this partially (shows "No tienes un colegio vinculado") -- improve the message.
- `UtpReviewCenter` silently returns with `setLoading(false)` -- add explicit empty state card.

### 2. Admin: User-Colegio linking tool in ColegiosManager

**File:** `ColegiosManager.tsx`

Add a section within each expanded colegio to allow the admin to:
- See a dropdown/input of users NOT currently linked to any colegio
- Assign them to that colegio (update `profiles.colegio_id`)
- Remove a user from the colegio (set `colegio_id` to null)

This uses existing RLS policies (admin can update all profiles).

### 3. No database changes needed

The schema already has `colegio_id` on `profiles`, `is_same_colegio()` function, and appropriate RLS policies. No migrations required.

### Technical Details

- `UtpReviewCenter.tsx`: After `getMyProfile()`, if `!profile?.colegioId`, render an info card with Building2 icon and the message instead of empty content.
- `UtpTeamManager.tsx`: Update the existing "no colegio" message text to be more descriptive.
- `ColegiosManager.tsx`: In the expanded colegio view, add:
  - A combo/select of unlinked users (profiles where `colegio_id IS NULL`)
  - "Vincular" button that updates `profiles.colegio_id`
  - "Desvincular" button on existing members that sets `colegio_id = null`
