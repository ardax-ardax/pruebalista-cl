## Cambio

En `src/pages/BancoPreguntas.tsx`, ocultar dos elementos cuando el usuario es docente (`!isStaff`):

1. **Filtro "Dificultad"** (linea ~207): envolver el `FilterSelect` de dificultad con `{isStaff && ...}` para que solo lo vean admin y UTP.

2. **Badge de dificultad** en cada fila (linea ~240): envolver el `Badge` con `{isStaff && row.difficulty && ...}` para que el docente no vea la dificultad de las preguntas.

No se requieren cambios en base de datos ni en otros archivos.