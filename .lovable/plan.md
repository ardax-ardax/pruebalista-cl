## Problema

El `useBlocker` agregado en CrearPrueba se activa porque el autosave pone `isDirty = true` en cada cambio de `assessment`, incluyendo la carga inicial. Aunque para borradores locales se resetea inmediatamente, React puede renderizar con `shouldBlock = true` antes del reset. Esto puede causar que al navegar desde CrearPrueba (o al volver) el blocker interfiera, mostrando el confirm dialog inesperadamente o dejando la página en blanco.

## Solución

### 1. Evitar que el blocker se active en la carga inicial (`CrearPrueba.tsx`)

- Agregar un `initialLoadRef = useRef(true)` que se pone en `false` después del primer render del assessment.
- Cambiar `shouldBlock` a: `isDirty && !editingId && !initialLoadRef.current`
- En el autosave effect, después de la primera ejecución, poner `initialLoadRef.current = false`.

### 2. No marcar `isDirty` en el autosave de borradores locales (`CrearPrueba.tsx`)

- Para borradores locales (sin `editingId`), el autosave ya guarda y resetea `isDirty` inmediatamente. Pero no debería marcar `isDirty = true` en primer lugar si es la carga inicial.
- Mover el `setIsDirty(true)` para que solo se ejecute después de la carga inicial.

### Cambios concretos

**Archivo: `src/pages/CrearPrueba.tsx`**

1. Agregar `const initialLoadRef = useRef(true);` junto a `saveTimerRef`.

2. En el autosave effect (línea ~230), después de guardar borrador local, agregar:
   ```ts
   initialLoadRef.current = false;
   ```

3. Cambiar `shouldBlock` (línea 79) a:
   ```ts
   const shouldBlock = isDirty && !editingId && !initialLoadRef.current;
   ```

4. Para robustez adicional, cambiar el blocker a usar la función callback form:
   ```ts
   const blocker = useBlocker(({ currentLocation, nextLocation }) =>
     shouldBlock && currentLocation.pathname !== nextLocation.pathname
   );
   ```

Esto asegura que el blocker solo se active cuando hay una navegación real a otra página y el usuario ha hecho ediciones reales (no la carga inicial).
