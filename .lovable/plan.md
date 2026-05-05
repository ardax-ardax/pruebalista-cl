
## Plan: Panel UTP — Equipo Docente + Centro de Revisión Pedagógica

### 1. Nuevo componente: `src/components/admin/UtpTeamManager.tsx`

Pestaña "Mi Equipo Docente" con:
- **Vincular Nuevo Docente**: Campo email + botón "Asignar al Colegio". Lógica:
  - Busca en `profiles` por email. Si existe y sin colegio, actualiza `colegio_id`.
  - Si ya pertenece al mismo colegio, muestra info. Si pertenece a otro, error.
  - Si no existe, inserta en `pending_invitations` con `colegio_id` y `role=docente`. El trigger `handle_new_user` ya lo vincula automáticamente al registrarse.
- **Equipo actual**: Lista de docentes vinculados al colegio (profiles con mismo `colegio_id`), mostrando avatar, nombre y email.
- **Invitaciones pendientes**: Lista de invitaciones no consumidas del colegio, con opción de eliminar.

### 2. Nuevo componente: `src/components/admin/UtpReviewCenter.tsx`

Pestaña "Evaluaciones por Revisar" con:
- **Tabla de evaluaciones** pendientes: Consulta `assessments` con `status = 'pendiente_revision'` de docentes del mismo colegio (via join con profiles).
- **Columnas**: Nombre, Docente, Fecha, Estado, Acciones.
- **Modal de revisión**: Al hacer clic, abre un Dialog con:
  - Vista previa del contenido (título, asignatura, curso, cantidad de preguntas).
  - Botón "Aprobar" → cambia `status` a `aprobado`.
  - Botón "Rechazar con Observaciones" → muestra textarea, guarda `utp_feedback` y cambia `status` a `rechazado`.
- **Iconos de estado**: Clock (pendiente), CheckCircle verde (aprobado), AlertTriangle naranja (rechazado).
- **Historial reciente**: Muestra también las últimas 10 evaluaciones aprobadas/rechazadas para referencia.

### 3. Actualizar `src/pages/Configuracion.tsx`

Reemplazar las 3 pestañas actuales del UTP (`catalogos`, `politicas`, `docentes`) por 5 pestañas:
1. **Mi Equipo** → `UtpTeamManager`
2. **Evaluaciones** → `UtpReviewCenter`
3. **Catálogos** → existente (asignaturas, cursos, docentes)
4. **Políticas** → existente (auto-asignación, créditos)
5. **Docentes** → existente `UtpUsageManager`

### 4. No se necesitan migraciones

La tabla `pending_invitations` ya tiene `colegio_id`. La tabla `assessments` ya tiene `status` y `utp_feedback`. La tabla `profiles` ya tiene `colegio_id`. Las políticas RLS existentes permiten que staff actualice assessments y profiles del mismo colegio. No hay cambios de esquema necesarios.

### Resumen de archivos

| Archivo | Acción |
|---|---|
| `src/components/admin/UtpTeamManager.tsx` | Nuevo |
| `src/components/admin/UtpReviewCenter.tsx` | Nuevo |
| `src/pages/Configuracion.tsx` | Editar pestañas UTP |
