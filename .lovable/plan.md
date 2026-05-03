
# Mejoras al Módulo Docente

## Explicación de cada punto

### 1. Posición del OA (antes o despues del titulo/instrucciones)
Actualmente el render HTML siempre pone los OA despues del titulo e instrucciones (linea 375 de `assessment-render.tsx`: `...title + instructions + oaHeader...`). Se agregara un campo `oaPosition: "before-title" | "after-instructions"` en `AssessmentMeta`. El docente lo elige con un selector en el formulario junto al switch de "Mostrar OA en encabezado". El render reordenara los bloques segun esa opcion.

### 2. Ocultar estados (borrador, pendiente, etc.) para docentes autonomos
Los docentes autonomos no dependen de UTP, asi que los badges de estado no tienen sentido para ellos. Se eliminaran los badges de estado en:
- `DashboardDocente.tsx` (pruebas recientes): ya filtra parcialmente pero aun muestra badges para `status !== "borrador"`. Se ocultaran completamente para docentes autonomos.
- `MisPruebas.tsx`: ocultar la columna/badge de estado y el filtro de estado cuando el usuario es docente autonomo.
- `CrearPrueba.tsx` (linea 415): ya se oculta con `!isAutonomous`, esto esta correcto.

### 3. Fix: editar prueba desde MisPruebas va al home en vez de CrearPrueba
En `MisPruebas.tsx` linea 219, el boton Editar navega a `/?id=${a.id}` (la ruta raiz, que ahora es el Dashboard). Debe navegar a `/crear-prueba?id=${a.id}`. Igualmente en la linea 83 (duplicar).

### 4. Creditos IA no se actualizan inmediatamente en el navbar
El hook `useUserUsage` en `AppLayout.tsx` se carga una sola vez al montar. Cuando el docente usa un credito en `AIGenerateDialog`, se llama `onCreditsUsed` -> `refreshUsage` pero eso solo actualiza el estado en `CrearPrueba`, no en `AppLayout` que tiene su propia instancia del hook. Solucion: convertir `useUserUsage` en un contexto global (provider) para que todas las instancias compartan el mismo estado y el `refresh()` actualice todas las vistas simultaneamente.

### 5. Al editar, solo modificar preguntas (no datos generales, excepto OA)
Cuando el docente abre una prueba existente (`editingId` presente), la pestana "Datos" sera de solo lectura excepto la seccion de OA. Se aplicara `pointer-events-none opacity-60` a los campos de datos generales (plantilla, curso, asignatura, titulo, instrucciones, etc.) pero se dejara la seccion de OA editable. El `AssessmentMetaForm` recibira un nuevo prop `readOnlyExceptOA` para controlar esto.

### 6. Cantidad de alternativas configurable (3 a 5)
Se agregara un selector en el formulario de metadatos para configurar la cantidad de alternativas por defecto: uno para seleccion multiple (3-5, default 4) y uno para V/F (2-4 afirmaciones, default 3). Estos valores se guardaran en `AssessmentMeta` como `defaultMcOptions` y `defaultTfStatements`. Cuando se crea una pregunta manualmente, `newQuestion()` usara estos valores. Cuando se genera con IA, el prompt incluira la cantidad solicitada.

### 7. Clarificar el indicador "nube + Al dia"
El icono de nube con "Al dia" (linea 452 de CrearPrueba.tsx) es el indicador de autoguardado. Es confuso. Se cambiara el texto a algo mas claro: "Guardado" con un checkmark, y se mejoraran todos los estados:
- idle sin cambios: "Guardado" (check verde)  
- dirty: "Cambios sin guardar" (punto amarillo)
- saving: "Guardando..." (spinner)
- saved: "Guardado" (check verde, se desvanece a idle)
- error: "Error al guardar" (icono rojo)

Se eliminara el icono de nube para simplificar.

---

## Cambios tecnicos

| Archivo | Cambio |
|---------|--------|
| `src/lib/assessment-schema.ts` | Agregar `oaPosition`, `defaultMcOptions`, `defaultTfStatements` a `AssessmentMeta`. Actualizar `newQuestion()` para aceptar cantidad de opciones. |
| `src/lib/assessment-render.tsx` | Reordenar `title`, `instructions`, `oaHeader` segun `oaPosition`. |
| `src/components/test-builder/AssessmentMetaForm.tsx` | Agregar selector de posicion OA, selectores de cantidad de alternativas, prop `readOnlyExceptOA`. |
| `src/pages/MisPruebas.tsx` | Fix links de editar/duplicar a `/crear-prueba?id=`. Ocultar badges y filtro de estado para docentes autonomos. |
| `src/pages/DashboardDocente.tsx` | Ocultar badges de estado completamente para docentes autonomos. |
| `src/pages/CrearPrueba.tsx` | Aplicar readonly a datos excepto OA al editar. Mejorar textos del indicador de guardado. Pasar `defaultMcOptions`/`defaultTfStatements` a QuestionList. |
| `src/hooks/useUserUsage.ts` | Refactorizar a contexto React global (provider + hook). |
| `src/components/AppLayout.tsx` | Usar el contexto global de usage en vez de instancia local. |
| `src/main.tsx` o `src/App.tsx` | Envolver con `UserUsageProvider`. |
| `src/components/test-builder/AIGenerateDialog.tsx` | Recibir y enviar cantidad de alternativas al prompt de IA. |
| `src/components/test-builder/QuestionList.tsx` | Pasar `defaultMcOptions` a `newQuestion()`. |
