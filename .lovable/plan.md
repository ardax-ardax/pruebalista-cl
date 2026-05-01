
## Plan: Monetización y Control de Marca de Agua

### 1. Base de Datos — tabla `user_usage`

Crear migración con:

```sql
CREATE TABLE public.user_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_available int NOT NULL DEFAULT 20,
  plan_type text NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free','pro','institucional')),
  last_reset timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- Usuarios leen su propio registro
CREATE POLICY "Users read own usage" ON public.user_usage
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Solo admin puede insertar/actualizar
CREATE POLICY "Admin manages usage" ON public.user_usage
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role (edge functions) puede actualizar créditos
-- (las edge functions usan service_role_key, que bypasea RLS)
```

Actualizar el trigger `handle_new_user` para crear automáticamente una fila en `user_usage` al registrarse un nuevo usuario.

### 2. Edge Function `generate-question` — verificación de créditos

Modificar la edge function para que, antes de llamar a la IA:

1. Use `SUPABASE_SERVICE_ROLE_KEY` para consultar `user_usage` del usuario autenticado (extraer uid del JWT).
2. Si `plan_type = 'institucional'` → sin límite, continúa normalmente.
3. Si `credits_available <= 0` → responde 402 con mensaje "Sin créditos disponibles".
4. Tras generación exitosa → decrementa `credits_available` en 1 via UPDATE.

### 3. Marca de Agua Condicional

**`RenderContext`** (`assessment-render.tsx`): agregar campo opcional `planType?: 'free' | 'pro' | 'institucional'`.

**`renderAssessmentHtml`**: al final del HTML, si `planType === 'free'`, inyectar un pie de página con "Generado con PruebaLista.cl — Versión Gratuita". Agregar CSS para que aparezca en cada página impresa (`position: fixed; bottom: 0`).

**`CrearPrueba.tsx`**: cargar el `plan_type` del usuario desde `user_usage` y pasarlo al `RenderContext`. También pasarlo al componente `AssessmentPreview`.

**`assessment-pdf.ts`**: el HTML ya contendrá la marca de agua condicional, así que `window.print()` la incluirá automáticamente.

### 4. Restricciones de Exportación y UI

**Bloqueo de .docx** (`CrearPrueba.tsx`):
- Si `planType === 'free'`, deshabilitar el botón "Descargar .docx" y mostrar tooltip/mensaje invitando a subir a Pro.

**Contador de créditos** (`AppLayout.tsx`):
- Crear un hook `useUserUsage()` que consulte `user_usage` y exponga `credits_available` y `plan_type`.
- En el header: si `plan_type === 'free'`, mostrar badge con "N créditos IA". Si es `pro` o `institucional`, mostrar badge con el nombre del plan (ej: "Pro", "Institucional").

### Archivos a crear/editar

| Archivo | Acción |
|---|---|
| `supabase/migrations/...sql` | Nueva tabla + RLS + actualizar trigger |
| `supabase/functions/generate-question/index.ts` | Verificación y descuento de créditos |
| `src/hooks/useUserUsage.ts` | Nuevo hook para consultar plan y créditos |
| `src/lib/assessment-render.tsx` | Marca de agua condicional en HTML |
| `src/pages/CrearPrueba.tsx` | Pasar planType al contexto, bloquear .docx |
| `src/components/AppLayout.tsx` | Mostrar créditos/plan en header |

### Detalle técnico

- La edge function usa `SUPABASE_SERVICE_ROLE_KEY` (ya disponible como secret) para bypass de RLS al decrementar créditos.
- El JWT del usuario se extrae del header `Authorization` en la edge function para identificar al usuario.
- La marca de agua usa CSS `@media print` con `position: fixed; bottom: 0` para repetirse en cada página impresa.
