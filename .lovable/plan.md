
## Objetivo

Tres mejoras:
1. Permitir que docentes no institucionales (sin asignaciones UTP) creen pruebas libremente.
2. Preview de prueba con escala automática (sin barras de scroll).
3. Confirmar que el banco de preguntas muestra solo las preguntas propias para docentes.

---

## Cambios

### 1. Docente autónomo — `src/pages/CrearPrueba.tsx`

Actualmente, si un docente no tiene `teacher_assignments`, el array queda vacío y bloquea la selección de asignaturas/niveles.

- Modificar el `useEffect` que carga asignaciones (línea ~82-86): si el resultado es un array vacío, setear `restrictedAssignments(null)` en lugar de un array vacío. Esto desbloquea todos los catálogos para docentes sin asignaciones.
- Lógica: `if (isStaff) null; else if (assignments.length === 0) null; else assignments;`

### 2. Perfil del docente — acceso a branding personalizado en `src/pages/Perfil.tsx`

- Agregar campos editables para "Nombre de institución" y "Logo" en la página de perfil, usando los campos existentes `custom_institution_name` y `custom_logo_url` de la tabla `profiles`.
- Solo visible para docentes no institucionales (rol `user`).

### 3. Preview con escala automática — `src/components/test-builder/PaginatedAssessmentPreview.tsx`

- Envolver el contenedor de páginas en un `div` con `ref` que mida su ancho disponible.
- Calcular `scale = Math.min(1, containerWidth / geom.widthPx)`.
- Aplicar `transform: scale(${scale})` con `transform-origin: top center` al contenedor de cada página.
- Ajustar la altura del wrapper con `height * scale` para evitar espacio vacío.
- Escuchar `resize` para recalcular.

### 4. Banco de preguntas — sin cambios necesarios

El RLS ya restringe correctamente: docentes ven solo sus preguntas, admin/staff ve todas. El frontend en `BancoPreguntas.tsx` ya usa `isAdmin` para control de eliminación. No requiere modificaciones.

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/pages/CrearPrueba.tsx` | Desbloquear catálogos para docentes sin asignaciones |
| `src/pages/Perfil.tsx` | Campos de branding personalizado para docentes |
| `src/components/test-builder/PaginatedAssessmentPreview.tsx` | Escala automática fit-to-width |

No se requieren migraciones de base de datos.
