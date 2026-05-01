
## Plan: Herramientas de Control para Jefe de UTP

### 1. Migración de Base de Datos

**Tabla `app_settings`**: agregar columna `hide_credits_from_teachers` (boolean, default false).

**Tabla `user_usage`**: agregar columna `monthly_quota` (integer, nullable) para cuota personalizada por docente.

**Nueva tabla `ai_generation_log`**: registrar cada generación de pregunta IA para auditoría.
- `id` (uuid, PK)
- `user_id` (uuid, not null)
- `created_at` (timestamptz, default now())
- `oa_code` (text)
- `question_type` (text)

RLS: el propio usuario puede leer sus registros; staff puede leer todos.

**Actualizar RLS de `user_usage`**: permitir que staff (admin + utp_head) lea todos los registros (para ver consumo de docentes).

### 2. Edge Function `generate-question`

- Insertar un registro en `ai_generation_log` tras cada generación exitosa.
- Agregar validación: si el plan es `institucional` y `monthly_quota` no es null y `credits_available <= 0`, retornar 402 con mensaje de cuota agotada.

### 3. Lógica de UI - Visibilidad de Créditos

**`AppLayout.tsx`**: cargar `hide_credits_from_teachers` desde `app_settings`. Si es true y el usuario tiene rol `user`, ocultar el contador de créditos y mostrar badge "Plan Institucional" en su lugar.

**`AIGenerateDialog.tsx`**: aplicar la misma lógica, no mostrar créditos restantes si están ocultos para docentes.

### 4. Panel UTP en Configuracion.tsx

Agregar nueva sección visible para staff (utp_head + admin):

**Toggle de visibilidad**: switch para `hide_credits_from_teachers`.

**Gestión de Docentes con Consumo IA**: en la tabla existente de StaffManager, agregar columnas:
- "Créditos IA" (valor actual de `credits_available`)
- "Cuota Mensual" (editable, campo `monthly_quota`)
- Botón para recargar créditos manualmente (actualiza `user_usage`)

**Auditoría**: sección con lista/tabla mostrando por cada docente:
- Cantidad de evaluaciones creadas (count de `assessments`)
- Preguntas IA generadas (count de `ai_generation_log`)
- Botón para descargar CSV del resumen

### 5. Hook y utilidades

- Crear `useAppSettingsPublic` hook que cargue solo campos públicos de `app_settings` (incluyendo `hide_credits_from_teachers`).
- Actualizar `useUserUsage` para exponer `monthlyQuota`.

### Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `supabase/migrations/...sql` | Nueva migración con columnas y tabla |
| `supabase/functions/generate-question/index.ts` | Validación de cuota + log |
| `src/components/AppLayout.tsx` | Ocultar créditos condicionalmente |
| `src/components/test-builder/AIGenerateDialog.tsx` | Ocultar créditos condicionalmente |
| `src/components/admin/StaffManager.tsx` | Columnas consumo IA + cuota + recarga |
| `src/pages/Configuracion.tsx` | Toggle visibilidad + sección auditoría |
| `src/hooks/useUserUsage.ts` | Exponer monthlyQuota |
| `src/lib/app-settings.ts` | Getter/setter para hide_credits_from_teachers |

