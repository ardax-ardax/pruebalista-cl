
## Cambios a implementar

### 1. Aislamiento UTP en UtpUsageManager

**Archivo:** `src/components/admin/UtpUsageManager.tsx`

- Al cargar datos, obtener primero el `colegio_id` del usuario actual via `getMyProfile()`.
- Filtrar `listProfiles()` resultados por `colegioId === miColegioId`.
- Filtrar `assessments` y `ai_generation_log` solo a los `user_id` de esos perfiles (filtro client-side, ya que RLS de assessments usa `is_same_colegio` que ya filtra correctamente).
- Mostrar solo docentes del mismo colegio, no consumo global.

### 2. Herencia de marca para UTP y Docentes institucionales

**Archivo:** `src/components/AppLayout.tsx`

- Actualmente ya muestra badge "Cuenta Institucional" si `isInstitutional`. Verificar que para UTP (`isUtpHead` con `colegio_id`) también aplique: ya funciona porque se basa en `colegioId` del perfil, no en el rol. Sin cambios necesarios aqui si el UTP tiene `colegio_id`.
- Eliminar badge de "créditos / plan" para cualquier usuario con `colegio_id` (ya lo hace via `shouldHideCredits || isInstitutional`). Confirmar que UTP cae en `isInstitutional`.

**Archivo:** `src/pages/Configuracion.tsx`

- Para UTP: en la pestaña "Políticas", cargar el logo y nombre desde la tabla `colegios` (usando su `colegio_id`) en lugar de `app_settings`. El UTP no debe poder cambiar el branding (es readonly para UTP; solo Admin lo gestiona via `ColegiosManager`).
- Mostrar logo y nombre del colegio en modo solo lectura en la sección de branding del UTP.

### 3. Admin: bloquear creación de pruebas

**Archivo:** `src/pages/CrearPrueba.tsx`

- Ya existe lógica `isAdminOnly` en `AppLayout` que oculta "Crear prueba" del nav. Verificar que si un admin navega directamente a `/crear-prueba`, se muestre un mensaje de "Acceso no disponible" o se redirija.
- Agregar guard al inicio del componente: si `isAdmin && !isUtpHead`, redirigir a `/admin/dashboard` con toast.

### 4. Logo del colegio en PDF y vista previa

**Archivo:** `src/pages/CrearPrueba.tsx` (lineas ~160-190)

- La logica actual ya carga `logo_url` desde `colegios` para docentes con `colegio_id`. Verificar que:
  - Si `logo_url` es un data:URI (base64), se use directamente.
  - Si es un path de Storage, se resuelva via `getPublicUrl`.
  - El logo resuelto se pase al `RenderContext` para PDF/preview.

**Archivo:** `src/lib/assessment-render.tsx`

- Verificar que el logo del `RenderContext` se use en el encabezado del documento renderizado.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/UtpUsageManager.tsx` | Filtrar datos por `colegio_id` del UTP |
| `src/pages/CrearPrueba.tsx` | Guard para admin puro; verificar logo resolution |
| `src/pages/Configuracion.tsx` | UTP: branding readonly desde tabla colegios |
| `src/components/AppLayout.tsx` | Verificar que UTP con colegio_id muestre badge institucional (posiblemente sin cambios) |

No se requieren migraciones de base de datos.
