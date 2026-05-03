## Cambios

### 1. Indicador de plan en el menú del avatar

**Archivo:** `src/components/AppLayout.tsx`

- En el `DropdownMenuLabel` del avatar (donde se muestra el nombre y email), agregar un badge debajo del email indicando el plan actual:
  - **Free**: Badge gris con texto "Plan Free"
  - **Pro**: Badge azul/primario con texto "Plan Pro"
  - **Institucional**: Badge verde con texto "Plan Institucional"
- Se usa `effectivePlan` que ya está disponible en el componente.

### 2. Límite de 10 pruebas guardadas para plan Free

**Archivo:** `src/pages/CrearPrueba.tsx` (o donde se llama a `upsertAssessment`)

- Antes de guardar una prueba nueva, si `effectivePlan === "free"`, contar las pruebas existentes del usuario con `listAssessments()`.
- Si ya tiene 10 o más, mostrar un toast de error: "Has alcanzado el límite de 10 pruebas en el plan Free. Elimina una prueba existente o actualiza tu plan."
- Si es una edición de prueba existente (ya tiene ID guardado), permitir guardar sin restricción.
- Pro e Institucional: sin límite.

**Archivo:** `src/pages/DashboardDocente.tsx`

- Aplicar la misma validación al presionar "Crear Prueba": si ya tiene 10, mostrar el mensaje y no navegar.
