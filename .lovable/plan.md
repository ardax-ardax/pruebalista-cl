
## Plan: Corrección de persistencia y verificación de features institucionales

### Diagnóstico

Tras revisar el código, los puntos 3 (branding), 4 (badge institucional) y 5 (botón re-envío) ya están implementados. El bug crítico es el punto 1: pérdida de `gradeValue`/`subjectValue` al editar pruebas.

**Causa raíz del bug de persistencia**: El autosave (`useEffect` línea 275) usa `initialLoadRef` para saltar el primer render, pero efectos secundarios como el auto-assign de docente (línea 323) o la recarga de templates cuando `allowedTemplates` cambia (línea 227) provocan renders adicionales que disparan el autosave antes de que el estado esté completo. Además, el efecto de carga principal (línea 185) tiene `[editingId, allowedTemplates, isStaff]` como dependencias — cuando `allowedTemplates` cambia asincrónicamente, el efecto recarga la prueba y puede crear condiciones de carrera.

### Cambios

#### 1. Fix persistencia de gradeValue/subjectValue (`CrearPrueba.tsx`)

- Reemplazar `initialLoadRef` por un mecanismo más robusto: un **contador de cambios del usuario** (`userEditCountRef`). El autosave solo se activa cuando el usuario ha hecho al menos un cambio explícito.
- Marcar el assessment como "cargado desde DB" con un ref (`loadedAssessmentIdRef`) para evitar que la auto-asignación de docente o los re-renders por carga de grades/templates disparen el autosave.
- En el `useEffect` de auto-assign de docente (línea 323): no incrementar el contador de edición del usuario — es un cambio automático, no del usuario.
- Agregar un debounce de 1.5s al autosave para evitar múltiples llamadas rápidas.

#### 2. Sincronización UTP (`CrearPrueba.tsx`)

- Verificado: `upsertAssessment` ya guarda en el registro principal. El `ownerId` se preserva correctamente. No requiere cambios adicionales.
- Agregar un `console.log` al cargar la prueba para confirmar que `gradeValue` y `subjectValue` vienen correctos desde la DB.

#### 3. Branding institucional — ya implementado, sin cambios

- Líneas 152-161: docentes con `colegioId` heredan nombre/logo del colegio.
- `Perfil.tsx`: tab de branding oculto para institucionales.

#### 4. Badge institucional — ya implementado, sin cambios

- `AppLayout.tsx` línea 109-113: badge "Cuenta Institucional" visible para usuarios con `colegioId`.

#### 5. Botón re-envío — ya implementado, sin cambios

- Línea 614-618: botón muestra "Re-enviar a Revisión" cuando `assessmentStatus === "rechazado"`.

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/CrearPrueba.tsx` | Reemplazar `initialLoadRef` por mecanismo de userEditCount + debounce en autosave |

### Detalle técnico

El nuevo mecanismo de autosave:

```
const userHasEditedRef = useRef(false);
const loadedAssessmentIdRef = useRef<string | null>(null);

// Cuando cargamos assessment de DB:
loadedAssessmentIdRef.current = found.id;
userHasEditedRef.current = false;

// onChange del usuario (en setAssessment manual):
// Wrapper que marca userHasEditedRef = true

// Autosave effect:
if (!userHasEditedRef.current) return; // skip automatic changes
// ... debounced upsert
```

Esto elimina la posibilidad de que cambios automáticos (auto-assign docente, recarga de templates) disparen un save prematuro con datos incompletos.
