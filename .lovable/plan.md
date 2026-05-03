
## Problem

The page is blank because `useBlocker` from react-router-dom requires a **data router** (created via `createBrowserRouter`), but the app uses the traditional `<BrowserRouter>`. This causes a runtime crash that breaks the entire page.

## Fix (src/pages/CrearPrueba.tsx)

1. **Remove `useBlocker` import** — change `import { useSearchParams, useBlocker } from "react-router-dom"` back to `import { useSearchParams } from "react-router-dom"`.
2. **Remove the `Dialog` import** added for the blocker dialog (keep only if used elsewhere — it's not).
3. **Remove the `const blocker = useBlocker(isDirty)` line**.
4. **Remove the blocker dialog JSX** at the bottom of the return.
5. **Keep the `beforeunload` listener** — it works for browser tab close/refresh and doesn't require a data router.
6. **Keep the `isDirty` state and save status indicator** — these are fine and useful.

No other files need changes. This single fix restores the page.
