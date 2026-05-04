## Cambios propuestos

### 1. Corregir soft-delete en banco de preguntas (bug principal)

**Problema:** La politica RLS de SELECT tiene un OR con `is_same_colegio()` que ignora el filtro `hidden_by_users`. Ademas, la politica UPDATE solo permite actualizar preguntas propias, asi que ocultar preguntas de otros docentes del colegio falla silenciosamente.

**Solucion:**

**Migracion SQL:**
- Actualizar la politica RLS SELECT de `question_bank` para aplicar el filtro `hidden_by_users` en AMBAS ramas:
  ```sql
  NOT (auth.uid() = ANY(hidden_by_users)) 
  AND (user_id = auth.uid() OR is_same_colegio(auth.uid(), user_id))
  ```
- Crear una funcion `hide_question_for_user(question_id, user_id)` con SECURITY DEFINER que actualice el array `hidden_by_users` sin depender de la politica UPDATE del usuario.

**Archivo:** `src/lib/question-bank.ts`
- Cambiar `hideFromBank` para usar la nueva funcion RPC en vez de hacer fetch + update manual.

### 2. Terminologia para docentes en banco de preguntas

**Archivo:** `src/pages/BancoPreguntas.tsx`
- Cambiar "¿Ocultar esta pregunta de tu banco?" a "¿Eliminar esta pregunta del banco?"
- Cambiar "Pregunta ocultada de tu banco" a "Pregunta eliminada"
- Cambiar "No se pudo ocultar" a "No se pudo eliminar"

### 3. Drag-and-drop para ordenar planes (PlansManager)

**Dependencia:** Instalar `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

**Archivo:** `src/components/admin/PlansManager.tsx`
- Envolver la tabla en `DndContext` + `SortableContext`.
- Cada fila sera un item arrastrable con un handle (icono de grip).
- Eliminar el campo "Orden" del dialogo de edicion.
- Al soltar, recalcular `sort_order` secuencialmente y guardar en batch.
- Nuevos planes se crean con `sort_order` = max existente + 1.

### Archivos afectados

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | Fix RLS + funcion `hide_question_for_user` |
| `src/lib/question-bank.ts` | Usar RPC para hide |
| `src/pages/BancoPreguntas.tsx` | Textos ocultar -> eliminar |
| `src/components/admin/PlansManager.tsx` | Drag-and-drop + quitar campo orden |
| `package.json` | Agregar dnd-kit |
