
# Correcciones: asignaciones docente

## Problema 1: Card de asignaciones no aparece en perfil
La condición `role === "docente"` requiere que `role` haya cargado. Como `role` se obtiene de forma asíncrona, puede ser `null` al momento del render inicial. Cambiaremos la condición a `!isStaff && role !== null` para que aparezca para cualquier usuario no-staff una vez que el rol haya cargado.

**Archivo**: `src/pages/Perfil.tsx` linea 53
- Cambiar `const isDocente = role === "docente"` a `const isDocente = !isStaff && role !== null`

## Problema 2: Docentes sin asignaciones pueden crear pruebas
Agregar validación en `CrearPrueba.tsx`: si el docente no es staff, tiene asignaciones cargadas (array vacío, no null), y el array está vacío, mostrar un mensaje indicando que debe configurar sus cursos en el perfil antes de crear pruebas.

**Archivo**: `src/pages/CrearPrueba.tsx`
- Detectar estado "docente sin asignaciones" después de cargar
- Mostrar mensaje con link a `/perfil` en lugar del formulario de creación

## Archivos afectados
- `src/pages/Perfil.tsx` — corregir condición isDocente
- `src/pages/CrearPrueba.tsx` — bloquear creación sin asignaciones
