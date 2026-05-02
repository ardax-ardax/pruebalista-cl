
# Layout lado a lado: Editor + Vista Previa en tiempo real

## Resumen

Modificar la página "Crear prueba" para que en pantallas grandes (≥1024px) el tab "Contenido" muestre el editor de preguntas a la izquierda y la vista previa del documento a la derecha, sincronizados en tiempo real. En móvil se mantiene el sistema de tabs actual.

## Cambios en `src/pages/CrearPrueba.tsx`

1. **Reemplazar el tab "Vista previa" separado** por un layout de dos columnas dentro del tab "Contenido" (solo en desktop):
   - Columna izquierda (~50%): `QuestionList` (editor de preguntas)
   - Columna derecha (~50%): `AssessmentPreview` con `PreviewLayoutToolbar`, dentro de un contenedor sticky para que siga visible al hacer scroll

2. **En móvil** (< 1024px): mantener los 3 tabs como están (Datos, Contenido, Vista previa). Sin cambios en la experiencia móvil.

3. **En desktop** (≥ 1024px): mostrar solo 2 tabs (Datos, Contenido + Preview). El tab "Vista previa" se oculta porque ya está integrado en "Contenido".

4. La vista previa derecha usa `position: sticky; top: 80px` para mantenerse visible mientras el usuario hace scroll por las preguntas.

## Detalles técnicos

- Se usa `useIsMobile()` o media query `lg:` de Tailwind para determinar el layout
- No se crean componentes nuevos; se reorganiza el JSX existente
- No requiere cambios en base de datos
- No requiere nuevas dependencias
