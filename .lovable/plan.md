
# Selectores de Curso y Asignatura en el nombre de archivo

Reemplazar los inputs de texto libre de "Asignatura" y "Curso" en el paso 3 (Nombre del archivo) por **menús desplegables** con listas predefinidas, para evitar errores de tipeo (ej. "Histora", "7° básico" vs "7Básico") y garantizar nombres de archivo consistentes.

## Cambios en la interfaz

**Paso 3 — Nombre del archivo:**
- "Número": se mantiene como input numérico.
- "Asignatura": pasa a ser un **selector** con la lista oficial de asignaturas del colegio.
- "Curso": pasa a ser un **selector** con la lista oficial de cursos del colegio.
- El nombre final del archivo se sigue construyendo igual: `{Prefijo}_N°{n}_{Asignatura}_{Curso}` (ej. `Ev_Sumativa_N°1_Historia_7Básico`).

## Listas propuestas

**Asignaturas** (nombres ya en formato sin espacios para el archivo):
- Lenguaje, Matemática, Historia, Ciencias, Inglés, Arte, Música, EducaciónFísica, Tecnología, Religión, Orientación

**Cursos** (formato compacto del colegio, ej. `7Básico`):
- 1Básico, 2Básico, 3Básico, 4Básico, 5Básico, 6Básico, 7Básico, 8Básico
- 1Medio, 2Medio, 3Medio, 4Medio
- Prekínder, Kínder

Cada opción mostrará una etiqueta legible (ej. "Educación Física", "7° Básico") pero al insertarse en el nombre del archivo usará el valor compacto sin espacios ni símbolos.

## Personalización desde Configuración

En la página **Configuración** se añadirá una sección nueva "Asignaturas y cursos" donde el equipo administrador podrá:
- Agregar, editar o eliminar asignaturas.
- Agregar, editar o eliminar cursos.
- Restaurar la lista por defecto del colegio.

Las listas se guardan en `localStorage` (igual que las plantillas y el logo), así cualquier cambio queda persistido en el navegador para todo el equipo que use ese equipo.

## Detalles técnicos

- Nuevo módulo `src/lib/catalog.ts` con tipos `SubjectOption` / `GradeOption` (`{ label, value }`), las listas por defecto, y funciones `loadSubjects/saveSubjects/loadGrades/saveGrades`.
- `src/pages/Index.tsx`: reemplazar los `Input` de asignatura y curso por componentes `Select` (ya disponible en `src/components/ui/select.tsx`). El estado pasa a guardar el `value` compacto seleccionado.
- `src/pages/Configuracion.tsx`: nueva sección con dos editores de lista (agregar/quitar/editar etiqueta y valor) y botón "Restaurar por defecto".
- Si una plantilla custom no requiere nombre estandarizado, el paso 3 sigue oculto como ahora.
