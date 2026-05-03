## Cambios

### 1. Crear prueba siempre empieza desde cero

**Archivos:** `DashboardDocente.tsx`, `CrearPrueba.tsx`

- En `DashboardDocente.tsx`: cambiar los `navigate("/crear-prueba")` a `navigate("/crear-prueba?new=1")` (líneas 182 y 215).
- En `CrearPrueba.tsx`: cuando `searchParams` contenga `new=1`, llamar `clearDraft()` y crear un `emptyAssessment()` limpio, ignorando cualquier borrador previo.
- Deshabilitar las pestañas "Contenido" y "Vista previa" hasta que los campos obligatorios (curso, asignatura, título) estén completos, mostrando un tooltip indicando qué falta.

### 2. Rango de afirmaciones V/F: 3 a 5

**Archivo:** `AssessmentMetaForm.tsx`

- Cambiar las opciones del selector de Verdadero/Falso de `[2, 3, 4]` a `[3, 4, 5]` afirmaciones, alineándolo con el selector de alternativas múltiples.
