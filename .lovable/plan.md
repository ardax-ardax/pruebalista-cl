
# Duplicar prueba desde Mis Pruebas

Agregar botón "Duplicar" en cada tarjeta de prueba en `/pruebas`.

## Cambio en `src/pages/MisPruebas.tsx`

- Importar `Copy` de lucide-react, `upsertAssessment` de assessment-storage, `newAssessmentId` de assessment-schema
- Agregar función `handleDuplicate(assessment)` que:
  1. Crea copia con nuevo ID via `newAssessmentId()`
  2. Título = "Copia de [título]"
  3. Status = "borrador", utpFeedback = null
  4. Guarda con `upsertAssessment`
  5. Navega a `/?id=nuevoId`
  6. Muestra toast de confirmación
- Agregar botón con ícono Copy entre Editar y Eliminar
