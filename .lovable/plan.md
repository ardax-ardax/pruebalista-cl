
## Problema

El docente no institucional actualmente:
1. Ve botones de "Enviar a Revisión UTP" y estados de borrador/pendiente/rechazado/aprobado, que no aplican a un usuario autónomo.
2. No tiene dónde configurar su propio nombre de colegio y logo (solo existe en Perfil, pero no se conecta bien al flujo de creación).
3. Puede editar las plantillas base del admin, y no tiene forma clara de crear plantillas propias sin tocar las base.

---

## Solución

### 1. Eliminar flujo UTP para docentes autónomos (`CrearPrueba.tsx`)

Un docente sin asignaciones UTP (`restrictedAssignments === null` y `!isStaff`) es autónomo. Para estos usuarios:

- **Ocultar** el botón "Enviar a Revisión UTP" (línea ~451).
- **Ocultar** el banner read-only de "pendiente de revisión" y "aprobada" (línea ~460).
- **Ocultar** el badge de estado (borrador/pendiente/aprobado/rechazado) en el título (línea ~392).
- **Ocultar** el banner de "Evaluación rechazada por UTP" (línea ~473).
- Las pruebas del docente autónomo se guardan siempre como `borrador` y se pueden editar/exportar libremente sin pasar por ningún flujo de aprobación.

Se añade una variable `isAutonomous = !isStaff && restrictedAssignments === null` para simplificar las condiciones.

### 2. Branding del docente en Perfil (`Perfil.tsx`) — ya funciona

La página de Perfil ya permite al docente editar `custom_institution_name` y `custom_logo_url`. Y `CrearPrueba.tsx` (líneas 96-101) ya aplica ese branding personalizado al preview/export cuando el usuario no es staff.

**Ajuste menor**: si el docente no tiene branding configurado, los campos del encabezado de la prueba deben quedar vacíos (no mostrar "New Little College La Florida"). Se modifica la lógica de fallback en `CrearPrueba.tsx` para que docentes autónomos arranquen con nombre vacío y sin logo si no tienen datos propios — así los formatos "vienen vacíos" como se requiere.

### 3. Plantillas: solo lectura para docentes, crear personalizadas (`Configuracion.tsx`)

Actualmente las plantillas solo se muestran al admin en Configuración. El docente necesita:

- **Ver** las plantillas base (las 5 built-in) en modo solo lectura — sin botones de Editar, Eliminar ni Restaurar.
- **Poder duplicar** una plantilla base para crear una personalizada propia.
- **Poder crear, editar y eliminar** solo sus plantillas personalizadas (las que tienen `isBuiltIn: false`).

**Implementación**: en `Configuracion.tsx`, se agrega una sección de plantillas visible también para docentes (`!isAdmin && !isUtpHead`). En esta sección:
- Las plantillas built-in se muestran como tarjetas de solo lectura con un botón "Duplicar" únicamente.
- Las plantillas custom del usuario se muestran con Editar/Eliminar.
- Se mantiene el botón "Nueva plantilla" para crear desde cero.

Nota: las plantillas se guardan en `localStorage`, por lo que cada usuario ya tiene su propia copia local. No hay conflicto entre admin y docente.

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/pages/CrearPrueba.tsx` | Variable `isAutonomous`; ocultar botón UTP, badges de estado y banners de revisión para docentes autónomos; fallback de branding vacío para autónomos |
| `src/pages/Configuracion.tsx` | Sección de plantillas visible para docentes: solo lectura en built-in, CRUD en personalizadas |

No se requieren migraciones de base de datos.
