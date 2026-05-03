
## Objetivo

Restringir las secciones de Configuración y navegación para que cada rol vea solo lo que le corresponde:

- **Admin**: Datos del colegio, Gestión de Personal, Gestión Curricular, Plantillas de formato (editar las 5 base).
- **UTP**: Asignaturas/cursos/docentes, Política de asignación, Visibilidad de créditos IA, Consumo de IA por docente, Importación masiva, Asignación docente-curso-asignatura.

---

## Cambios

### 1. `src/components/AppLayout.tsx`
- Cambiar el menú "Cursos" de `isStaff` a `isUtpHead` (solo UTP lo necesita).

### 2. `src/pages/Configuracion.tsx`
Envolver secciones con condicionales de rol (usando `isAdmin` e `isUtpHead` del hook `useAuth`):

| Sección | Visible para |
|---|---|
| Datos del colegio (logo, nombre) | Admin |
| Asignaturas, cursos y docentes | UTP |
| Política de asignación de docentes | UTP |
| Visibilidad de créditos IA | UTP |
| Consumo de IA por Docente | UTP |
| Gestión de Personal | Admin |
| Gestión Curricular | Admin |
| Plantillas de formato (edición de base) | Admin |

Cambios concretos:
- Línea 63: agregar `isUtpHead` del destructuring de `useAuth()`
- Líneas 351-389 (Asignaturas, cursos y docentes): envolver con `{isUtpHead && ...}`
- Líneas 391-416 (Política de asignación): cambiar `isAdmin` a `isUtpHead`
- Líneas 418-443 (Visibilidad créditos): ya usa `isStaff`, cambiar a `isUtpHead`
- Línea 446 (Consumo IA): cambiar `isStaff` a `isUtpHead`
- Plantillas: mantener visibles pero restringir edición/duplicación/creación a `isAdmin`

No se requieren cambios en base de datos.
