
# Reporte QA — PruebaLista.cl

## 1. Integridad de Base de Datos y RLS

**Estado: OK con observaciones menores**

- **RLS de `user_usage`**: Correcto. Usuarios leen lo suyo, staff lee todo, admin tiene ALL, staff puede UPDATE.
- **RLS de `global_settings`**: Correcto. Solo admin lee y actualiza.
- **RLS de `ai_generation_log`**: Correcto. Usuarios leen lo suyo, staff lee todo, authenticated inserta (con check user_id = auth.uid()).
- **Trigger `handle_new_user`**: Lee `default_free_credits` desde `global_settings` correctamente con fallback a 20.

**Hallazgo de seguridad (WARN)**: Las funciones `has_role`, `is_staff` y `handle_new_user` son ejecutables por `anon` (usuarios no autenticados). Se debe revocar `EXECUTE` del rol `anon` en `has_role` e `is_staff` para evitar que usuarios no autenticados puedan invocarlas vía la API REST.

### Corrección propuesta
```sql
REVOKE EXECUTE ON FUNCTION public.has_role FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff FROM anon;
```

---

## 2. Validación de la Edge Function (`generate-question`)

**Hallazgo CRÍTICO — Race condition en la resta de créditos**

La función lee `credits_available`, luego llama a la IA (operación lenta ~5-15s), y solo después resta. Si un usuario dispara 2 peticiones simultáneas con 1 crédito, ambas pasan la verificación y se generan 2 preguntas, pero el crédito queda en -1 o 0 (no atómico).

**Corrección propuesta**: Usar un UPDATE condicional atómico ANTES de llamar a la IA (reservar el crédito), y revertir si la IA falla.

```sql
-- Deducir atómicamente solo si hay créditos
UPDATE user_usage 
SET credits_available = credits_available - 1 
WHERE user_id = $1 AND credits_available > 0
RETURNING credits_available;
```
Si no se actualiza ninguna fila → sin créditos → 402. Si la IA falla → revertir con `credits_available + 1`.

**Hallazgo MENOR**: Plan institucional SIN cuota (`monthly_quota = null`) nunca descuenta créditos (línea ~280: `if planType !== "institucional" || monthlyQuota !== null`). Esto es intencional pero significa que un usuario institucional sin cuota tiene créditos ilimitados. Si esto no es deseado, se debe documentar explícitamente.

---

## 3. Lógica de Negocio y Frontend

### 3a. Plan Efectivo y marca de agua

**Hallazgo CRÍTICO — No existe lógica de marca de agua**

`RenderContext` recibe `planType` pero ni `assessment-render.tsx` ni `assessment-docx.ts` lo usan. No hay marca de agua para plan free. El botón `.docx` se bloquea correctamente en la UI (línea 398-406 de `CrearPrueba.tsx`), pero no hay protección server-side: un usuario podría llamar directamente a la función de exportación.

Sin embargo, como la exportación DOCX es 100% client-side (no hay edge function), la protección UI es la única barrera. **Recomendación**: Agregar la marca de agua en el render para reforzar.

### 3b. Toggle `hide_credits_from_teachers`

**Estado: OK**

`AppLayout.tsx` línea 52-53 computa `shouldHideCredits = hideCredits && isTeacher` y muestra badge "Plan Institucional" en lugar de créditos. Funciona correctamente.

**Observación**: `AIGenerateDialog.tsx` NO oculta créditos. El plan original indicaba hacerlo, pero no se implementó. No hay indicador de créditos visible en ese diálogo actualmente, así que no es un bug funcional.

---

## 4. Flujo de Aprobación UTP

**Estado: OK**

- `readOnly` (línea 166-172): docentes no pueden editar en `pendiente_revision` o `aprobado`. Correcto.
- La UI aplica `pointer-events-none opacity-60` a las pestañas Meta y Contenido. El botón Guardar se oculta con `{!readOnly && ...}`.
- Feedback UTP se muestra solo en estado `rechazado` (línea 430-436). Correcto.
- **Protección RLS**: La política `Teachers can update own draft/rejected` solo permite UPDATE cuando `status IN ('borrador', 'rechazado')` con check que incluye `pendiente_revision` (para permitir el envío). Un docente no puede cambiar una prueba `aprobada` ni en la UI ni a nivel de base de datos.

**Observación menor**: El autosave (línea 176-183) respeta `readOnly`, así que no hay escrituras involuntarias.

---

## 5. Edge Cases

### 5a. Admin desactiva `enable_payments` durante compra

**Hallazgo: No hay flujo de pagos implementado**

`enable_payments` existe en `global_settings` pero no hay integración de pagos (Stripe, etc.) en el código. El campo es puramente declarativo. No hay riesgo actual, pero cuando se implemente pagos, se deberá verificar `enable_payments` server-side antes de procesar transacciones.

### 5b. Usuario sin `organization_id` con cuota institucional

**Hallazgo: No existe campo `organization_id`**

No hay columna `organization_id` en ninguna tabla. La cuota institucional (`monthly_quota`) se asigna directamente en `user_usage` por usuario, independiente de organización. Esto significa que un admin/UTP puede asignar `monthly_quota` a cualquier usuario, incluso uno con plan `free`. La edge function solo verifica cuota si `planType === "institucional"`, así que una cuota en un usuario `free` no tiene efecto — no es un bug, pero es confuso.

**Corrección propuesta**: En el panel UTP (`UtpUsageManager`), filtrar solo usuarios con plan `institucional` al asignar cuotas, o validar en el backend.

---

## Resumen de correcciones a implementar

| # | Severidad | Descripción |
|---|-----------|-------------|
| 1 | **CRÍTICA** | Race condition en deducción de créditos — hacer UPDATE atómico antes de llamar a la IA |
| 2 | **MEDIA** | Revocar EXECUTE de `has_role` e `is_staff` para rol `anon` |
| 3 | **BAJA** | Agregar marca de agua en render para plan free (refuerzo visual) |
| 4 | **BAJA** | Validar en UI que cuotas solo se asignen a usuarios institucionales |

### Implementación

**Migración SQL**: Revocar permisos de funciones SECURITY DEFINER para anon.

**Edge Function `generate-question`**: Refactorizar para deducir crédito atómicamente con `UPDATE ... WHERE credits_available > 0 RETURNING ...` antes de la llamada IA, y revertir si falla.

**`assessment-render.tsx`** (opcional): Agregar marca de agua superpuesta cuando `planType === "free"`.

**`UtpUsageManager.tsx`** (opcional): Filtrar/advertir al asignar cuota a usuarios no institucionales.
