
# Mejoras UX: Drag & Drop, Preguntas Colapsables e Indicador de Autoguardado

## 1. Drag & Drop para reordenar preguntas

Instalar `@dnd-kit/core` y `@dnd-kit/sortable` para permitir arrastrar y soltar preguntas en lugar de usar solo las flechas arriba/abajo.

**Cambios:**
- **`QuestionList.tsx`**: Envolver la lista de preguntas con `DndContext` y `SortableContext`. Cada `QuestionEditor` se envuelve en un componente sortable que usa el `id` de la pregunta.
- **`QuestionEditor.tsx`**: Agregar un asa de arrastre (icono `GripVertical`) a la izquierda de cada pregunta. Los botones de flechas se mantienen como alternativa.

## 2. Preguntas colapsables

Permitir colapsar/expandir el contenido de cada pregunta para reducir el ruido visual en pruebas largas.

**Cambios:**
- **`QuestionEditor.tsx`**: Usar el componente `Collapsible` (ya existe en el proyecto) para envolver el cuerpo de cada pregunta. El encabezado (numero, tipo, botones) siempre visible; el contenido editable se puede colapsar con un click en el encabezado o un botón chevron.
- **`QuestionList.tsx`**: Agregar un botón "Colapsar todo / Expandir todo" en la barra superior para gestionar todas las preguntas a la vez.

## 3. Indicador de autoguardado

Mostrar un estado visual ("Guardando...", "Guardado ✓") para que el usuario sepa que sus cambios se persisten.

**Cambios:**
- **`CrearPrueba.tsx`**: Modificar el `useEffect` de autosave (linea ~184) para trackear el estado de guardado (`idle`, `saving`, `saved`, `error`). Mostrar un badge/texto discreto en el header de la página (junto al botón Guardar) con el estado actual. Después de guardar exitosamente, mostrar "Guardado ✓" durante 3 segundos y luego volver a idle.

## Detalle técnico

| Mejora | Archivos | Dependencias nuevas |
|--------|----------|-------------------|
| Drag & Drop | `QuestionList.tsx`, `QuestionEditor.tsx` | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| Colapsables | `QuestionEditor.tsx`, `QuestionList.tsx` | Ninguna (usa `Collapsible` existente) |
| Autoguardado | `CrearPrueba.tsx` | Ninguna |

No requiere cambios en base de datos.
