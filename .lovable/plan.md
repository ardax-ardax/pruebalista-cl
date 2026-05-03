
## Plan: Arquitectura multi-colegio, renombrar rol, soft-delete y terminología

### 1. Migración DB: Renombrar enum `user` a `docente`

- Agregar valor `'docente'` al enum `app_role`
- Actualizar registros existentes en `user_roles` y `pending_invitations` de `'user'` a `'docente'`
- Actualizar función `handle_new_user()` para asignar `'docente'` por defecto
- Eliminar valor `'user'` del enum

### 2. Migración DB: Tabla `colegios` y asociación de usuarios

- Crear tabla `colegios` con columnas: `id uuid`, `nombre text`, `logo_url text`, `created_by uuid`, `created_at`, `updated_at`
- Agregar columna `colegio_id uuid` (nullable, FK a `colegios`) en `profiles`
- Agregar columna `colegio_id uuid` (nullable, FK a `colegios`) en `pending_invitations`
- RLS en `colegios`: Admin CRUD total, UTP puede leer su propio colegio, docentes/profesores pueden leer su colegio
- Actualizar `handle_new_user()` para copiar `colegio_id` desde `pending_invitations` al perfil del nuevo usuario

### 3. Migración DB: Visibilidad del UTP filtrada por colegio

- Crear función `is_same_colegio(_staff_id uuid, _target_user_id uuid)` que retorna true si:
  - El staff es admin (ve todo), O
  - Ambos comparten el mismo `colegio_id` en `profiles`
- Actualizar políticas RLS en `assessments`: UTP solo ve pruebas de usuarios con su mismo `colegio_id`
- Actualizar políticas RLS en `question_bank`: UTP solo ve preguntas de usuarios con su mismo `colegio_id`
- Admin mantiene visibilidad total

### 4. Migración DB: Soft-delete en banco de preguntas

- Agregar columna `hidden_by_users uuid[]` (default `'{}'`) a `question_bank` con index GIN
- Agregar política UPDATE para que docentes/profesores puedan modificar `hidden_by_users` en sus propias preguntas
- Ajustar política SELECT del docente para excluir preguntas donde su ID esté en `hidden_by_users`
- Cambiar política DELETE: solo admin puede eliminar de verdad

### 5. Frontend: Tipo AppRole y referencias

- `src/hooks/useAuth.tsx`: `"user"` -> `"docente"` en tipo y prioridades
- `src/components/AppLayout.tsx`: Comparaciones de rol
- `src/components/admin/StaffManager.tsx`: Tipo y labels
- `src/lib/invitations.ts`: Tipo InvitationRole

### 6. Frontend: UI Admin para gestión de colegios

- Nueva sección en Configuración (o página dedicada) donde el Admin puede:
  - Crear colegio: nombre, logo, email del UTP responsable
  - Al crear, se genera automáticamente una invitación en `pending_invitations` con rol `utp_head` y el `colegio_id`
  - Listar/editar/eliminar colegios existentes
  - Ver qué UTP y profesores pertenecen a cada colegio

### 7. Frontend: Soft-delete en BancoPreguntas

- `src/lib/question-bank.ts`: Para docentes/profesores, cambiar `deleteFromBank()` a UPDATE que agrega su ID a `hidden_by_users`
- `src/pages/BancoPreguntas.tsx`: Botón muestra "Ocultar de mi banco" para docentes/profesores, "Eliminar" solo para admin

### 8. Terminología UI: "Institución" a "Colegio"

- Cambiar labels visibles en `Configuracion.tsx`, `Perfil.tsx`, `CrearPrueba.tsx`
- De "institución" a "colegio" en toda la UI
- No se renombran columnas de DB para evitar migraciones innecesarias

---

### Notas técnicas

- El enum de Postgres no permite renombrar valores; se usa: ADD nuevo valor, UPDATE registros, DROP viejo valor vía recreación del tipo.
- `colegio_id` en `profiles` es la clave para filtrar visibilidad del UTP. Los docentes autónomos tienen `colegio_id = null`.
- Las invitaciones del UTP heredan su `colegio_id`, propagándolo automáticamente al profesor cuando se registra.
- `hidden_by_users uuid[]` con index GIN permite soft-delete eficiente sin tablas intermedias.
