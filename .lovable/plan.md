# Tres mejoras: ocultar puntajes, ajustar DOCX y login con Google

## 1) Ocultar puntajes en la prueba (preview, PDF y Word)

El puntaje es **dato interno** del docente. Se elimina del documento que recibe el estudiante.

### Cambios

**`src/lib/assessment-render.tsx`**
- En `renderAssessmentHtml`: eliminar el `<span class="pa-question-points">…</span>` del header de cada pregunta.
- En el banner: el bloque "Pje. Total" pasa a mostrar "Pje. Total" arriba y un espacio en blanco abajo (sin el número), igual que el lado de "Calificación".

**`src/lib/assessment-docx.ts`**
- En `questionParagraphs`: eliminar el `TextRun` con `(N pts)` del header de pregunta.
- En `bannerTable`: en `gradeChildren`, dejar solo el rótulo "Pje. Total" y un párrafo vacío para escribir a mano (quitar el número total).

El campo "Puntaje" sigue existiendo en el editor (uso interno del docente) y el contador del editor sigue mostrando el total.

---

## 2) Espacio entre banner y fila Nombre/Puntaje en DOCX

Hoy esa fila queda pegada al banner.

### Cambio en `src/lib/assessment-docx.ts`
- En `exportAssessmentToDocx`, insertar un párrafo separador entre `bannerTable(ctx)` y `studentRow(ctx)`:
  ```
  new Paragraph({ spacing: { before: 240, after: 0 }, children: [new TextRun("")] })
  ```
- En `studentRow`, agregar `spacing: { before: 120, after: 60 }` a los párrafos de las celdas para que el texto no quede pegado a la línea inferior.

---

## 3) Login con Google + pruebas privadas por usuario + admin

Hoy las pruebas viven en IndexedDB del navegador. Migración a Lovable Cloud (Supabase gestionado) con Google como **único** método de autenticación. Administrador: **admin@cnlc.cl**.

### Backend (Lovable Cloud)

Activar Cloud y crear:

**Tablas**
- `app_role` enum: `admin | user`
- `user_roles (id, user_id → auth.users on delete cascade, role app_role, unique(user_id, role))`
- `assessments (id uuid pk, user_id uuid not null → auth.users on delete cascade, title text, meta jsonb, questions jsonb, created_at timestamptz, updated_at timestamptz)`

**Función security-definer**
- `public.has_role(_user_id uuid, _role app_role) returns boolean` (evita recursión RLS).

**RLS sobre `assessments`** (RLS activado):
- `select`: `user_id = auth.uid() OR has_role(auth.uid(), 'admin')`
- `insert`: `user_id = auth.uid()`
- `update`: `user_id = auth.uid() OR has_role(auth.uid(), 'admin')`
- `delete`: `user_id = auth.uid() OR has_role(auth.uid(), 'admin')`

**RLS sobre `user_roles`**: solo lectura propia + admin.

**Asignación de admin a admin@cnlc.cl**
- Trigger `on auth.users insert`: si `NEW.email = 'admin@cnlc.cl'`, insertar fila `(user_id, 'admin')` en `user_roles`. Así, en cuanto inicies sesión por primera vez con esa cuenta Google, te asignás como admin automáticamente.
- Si la cuenta ya existiera, una migración hace el `insert ... on conflict do nothing`.

**Auth providers**
- Habilitar Google. **Deshabilitar email/contraseña** (solo Google, según pediste).

### Frontend

**Nuevas páginas/archivos**
- `src/pages/Auth.tsx`: pantalla de login con un solo botón "Continuar con Google".
- `src/hooks/useAuth.tsx`: provider con `onAuthStateChange` (registrado primero) + `getSession`. Expone `user`, `session`, `isAdmin`, `loading`, `signInWithGoogle`, `signOut`.
- `src/components/AuthGuard.tsx`: si no hay sesión, redirige a `/auth`.

**Rutas (`App.tsx`)**
- `/auth` pública.
- `/`, `/pruebas`, `/configuracion` envueltas por `AuthGuard`.

**Storage migrado a Cloud (`src/lib/assessment-storage.ts`)**
- Reescribir API a async usando el cliente Supabase:
  - `listAssessments(): Promise<Assessment[]>` — filtra por `user_id` (RLS lo hace solo); admin recibe todo.
  - `getAssessment(id): Promise<Assessment | null>`
  - `upsertAssessment(a): Promise<Assessment>` — set `user_id = auth.user.id` en el insert.
  - `deleteAssessment(id): Promise<void>`
  - **Borrador**: se guarda como una fila `assessments` con flag interno (campo `meta.isDraft = true`) o se mantiene en IndexedDB local (más simple). Plan: mantener `saveDraft/loadDraft` en IndexedDB local porque es por dispositivo; al guardar definitivo va a la nube.

**Importador one-shot desde IndexedDB**
- Al detectar pruebas locales en el primer login, mostrar un dialog: "Tenemos N pruebas guardadas en este navegador. ¿Importar a tu cuenta?". Inserta cada una con tu `user_id`.

**Páginas que cambian**
- `MisPruebas.tsx`: pasa a `useEffect` async con loader; si `isAdmin`, muestra selector "Mis pruebas / Todas las pruebas" y la columna "Autor" cuando es admin.
- `CrearPrueba.tsx`: el autosave debounce (~1s) llama `upsertAssessment` async. Estado de "Guardando…" en el header.
- `AppLayout.tsx`: agregar avatar/email del usuario y botón "Cerrar sesión".

**Configuración Google en Cloud**
- Tras activar Cloud y habilitar Google, te indicaré abrir Cloud → Users → Auth Settings para revisar URLs de redirect (Lovable las preconfigura). No necesitás credenciales propias: el provider Google en Cloud está gestionado.

### Pasos de implementación (en orden)

1. **Cambios 1 y 2** (ocultar puntajes + spacing DOCX) — rápidos, sin backend.
2. **Activar Lovable Cloud**.
3. **Migración SQL**: enum, `user_roles`, `has_role()`, `assessments`, RLS, trigger admin@cnlc.cl.
4. **Habilitar Google provider** y deshabilitar email/password.
5. **Crear `useAuth`, `Auth.tsx`, `AuthGuard`** y rutear.
6. **Reescribir `assessment-storage.ts`** + migrar callsites a async.
7. **Importador desde IndexedDB** (one-shot).
8. **Vista admin** en `/pruebas`.
9. **Avatar + Cerrar sesión** en `AppLayout`.

### Resultado

- Cada docente entra con Google y solo ve sus propias pruebas en cualquier dispositivo.
- admin@cnlc.cl es el único que puede ver/editar/eliminar todas las pruebas.
- Los documentos exportados (PDF/Word) ya no exponen los puntajes ni totales numéricos.
- El espacio entre banner y nombre del estudiante respira en el .docx.
