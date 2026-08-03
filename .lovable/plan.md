# Switch para mostrar/ocultar el contenido institucional (UTP) en la portada

Objetivo: el administrador general podrá apagar todo el contenido institucional de la portada pública, dejando la web como si el servicio fuera solo individual. El acceso y funcionamiento del perfil UTP no cambia: los usuarios UTP siguen iniciando sesión y usando su panel con total normalidad.

## Qué se agrega

1. Nuevo ajuste global `Mostrar módulo institucional (UTP) en la portada` (activado por defecto), en Admin > Ajustes Globales, junto a "Pagos habilitados", "Modo mantenimiento" y "Generación con IA".
2. La portada (`/` y `/landing`) reacciona al ajuste. Con el switch apagado se oculta:
   - La tarjeta de característica "Panel UTP".
   - El bloque "Colegios y equipos UTP" en la sección "Para quién" (la tarjeta de docentes autónomos pasa a ancho completo).
   - La pregunta del FAQ "¿Sirve para colegios completos?".
   - La mención a "equipos UTP" en el texto del hero (queda enfocado en docentes).
   - El plan institucional en la sección de planes (se ocultan planes institucionales).
3. Mientras carga el ajuste, la portada no muestra parpadeo: el contenido institucional solo aparece cuando el ajuste confirma que está activo.

## Detalles técnicos

- Migración: agregar columna `show_institutional_landing boolean not null default true` a `global_settings`. Debe ser legible públicamente (rol `anon`) porque la portada es pública; se expone únicamente esa columna a `anon` mediante la política/consulta existente, sin abrir columnas sensibles como `default_free_credits`.
- `src/lib/global-settings.ts`: añadir el campo a `GlobalSettings`, `DEFAULT_GLOBAL_SETTINGS` y al `select` de `loadGlobalSettings`. Añadir un lector liviano público (`loadPublicLandingSettings`) que solo consulte `show_institutional_landing` para usar en la portada sin requerir sesión.
- `src/pages/AdminDashboard.tsx`: nuevo `Switch` en la pestaña de ajustes; se guarda con el botón "Guardar ajustes" existente (ya envía el objeto completo a `updateGlobalSettings`).
- `src/pages/Landing.tsx`: estado local `showUtp` cargado en `useEffect`; se filtran `FEATURES` (por título "Panel UTP"), `FAQ` (pregunta de colegios) y los planes cuyo `id` sea `institucional` (o cuyo `label` contenga "Institucional"); condicional para la tarjeta de colegios y variante del texto del hero.
- No se toca ninguna ruta, guard, rol ni política de acceso: `/auth`, `AuthGuard`, `resolveDestination` y el panel UTP quedan intactos.
