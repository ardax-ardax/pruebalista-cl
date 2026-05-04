
## Agregar drag & drop a la tabla de Asignaturas

Mismo patrón ya usado en `PlansManager.tsx` con `@dnd-kit`.

### Cambios en `src/components/admin/AdminSubjectsManager.tsx`

1. **Importar** `DndContext`, `closestCenter`, `PointerSensor`, `KeyboardSensor`, `useSensors`, `useSensor`, `DragEndEvent`, `arrayMove`, `SortableContext`, `sortableKeyboardCoordinates`, `useSortable`, `verticalListSortingStrategy`, `CSS` de `@dnd-kit`
2. **Extraer** cada fila de la tabla a un componente `SortableSubjectRow` que usa `useSortable` (igual que `SortableRow` en PlansManager)
3. **Agregar columna** de grip handle (`GripVertical`) como primera columna
4. **Envolver** `TableBody` en `SortableContext` + `DndContext`
5. **`handleDragEnd`**: reordena el array local con `arrayMove` y persiste los nuevos `sort_order` en la base de datos
6. **Quitar** la columna "Orden" numérica (ya no es necesaria, el orden se controla arrastrando)
7. **Quitar** el campo "Orden" del diálogo de edición (se maneja solo vía drag)
