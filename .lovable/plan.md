## Cambios propuestos

### 1. Mejorar el diálogo de edición de planes (UI overflow)

El diálogo de edición de plan en `PlansManager.tsx` crece demasiado cuando hay muchos cursos y no cabe en pantalla.

**Solución:**
- Cambiar `DialogContent` de `max-w-md` a `max-w-lg`
- Envolver el contenido del formulario en un `ScrollArea` con `max-h-[70vh]` para que sea scrollable
- Mantener el `DialogFooter` (botones Cancelar/Guardar) fuera del scroll, siempre visible

**Archivo:** `src/components/admin/PlansManager.tsx`

---

### 2. Filtrar cursos del docente según los cursos permitidos de su plan

Actualmente, aunque el admin asigne cursos a un plan, el docente sigue viendo todos los cursos del catálogo. Hay que aplicar la restricción.

**Lógica:**
- En `CrearPrueba.tsx`, después de cargar los grados, consultar `plan_allowed_courses` para el plan del usuario actual
- Si hay cursos restringidos, filtrar la lista de `grades` para mostrar solo los permitidos
- Si no hay restricciones (tabla vacía para ese plan), mostrar todos

**Archivos:**
- `src/pages/CrearPrueba.tsx` -- agregar consulta a `plan_allowed_courses` + `admin_courses` y filtrar grades
- `src/hooks/useUserUsage.tsx` -- ya expone `plan_type`, se usará para obtener el plan del usuario

---

### Resumen de archivos afectados

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/PlansManager.tsx` | ScrollArea en diálogo, mayor ancho |
| `src/pages/CrearPrueba.tsx` | Filtrar grades por cursos permitidos del plan |
