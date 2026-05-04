
## Problema

El diálogo de edición de planes en `PlansManager.tsx` tiene dos problemas:
1. **No hace scroll** — El `ScrollArea` de Radix no está funcionando correctamente dentro del flex layout del `DialogContent`, dejando el contenido "pegado" sin poder desplazarse.
2. **Ancho insuficiente** — Sigue siendo demasiado estrecho (`max-w-lg`) para la cantidad de contenido.

## Solución

**Archivo:** `src/components/admin/PlansManager.tsx`

1. **Reemplazar `ScrollArea` por un `div` con overflow nativo** — `ScrollArea` de Radix tiene problemas conocidos con flex containers. Un simple `<div className="overflow-y-auto max-h-[60vh] pr-2">` funciona de forma confiable.

2. **Ampliar el diálogo** — Cambiar `max-w-lg` a `max-w-2xl` para dar espacio al contenido (switches, checkboxes de plantillas, cursos).

3. **Asegurar que el `DialogFooter` quede fuera del scroll** — Ya está fuera del ScrollArea, solo hay que verificar que se mantenga así con el nuevo markup.

### Cambio concreto

- Línea 322: `max-w-lg` → `max-w-2xl`
- Línea 328: Reemplazar `<ScrollArea className="max-h-[60vh] pr-4">` por `<div className="overflow-y-auto max-h-[60vh] pr-2 flex-1 min-h-0">`
- Línea 470: Cerrar `</ScrollArea>` → `</div>`
- Eliminar import de `ScrollArea` si ya no se usa en el archivo
