

# Forzar layout en columna para selección múltiple con imagen

## Cambio de comportamiento

Cuando una pregunta de selección múltiple **tiene imagen**, el layout será **siempre** dos columnas: opciones a la izquierda, imagen a la derecha (centrada en su columna). Se elimina la opción de elegir entre `block`, `side-right` o `side-left` para este caso.

Si la pregunta de selección múltiple **no tiene imagen**, no hay layout que elegir (las opciones ocupan el ancho completo, igual que hoy).

## Archivos a modificar

### 1) `src/components/test-builder/QuestionEditor.tsx`
- Quitar el control UI que permite elegir `imageLayout` (selector con `block` / `side-right` / `side-left`) **solo para preguntas de selección múltiple**.
- Cuando se sube/carga una imagen en una pregunta MC, asignar automáticamente `imageLayout = "side-right"`.
- Para los demás tipos de pregunta (verdadero/falso, respuesta corta) el control sigue como está.

### 2) `src/lib/assessment-render.tsx`
- En la lógica que decide `isSplit`, para `multiple-choice` con imagen forzar siempre split a la derecha, ignorando `imageLayout` distinto.
- Forzar la alineación de la imagen dentro de la columna a `center` (sin importar lo configurado), tanto en HTML como en CSS.

### 3) `src/lib/assessment-docx.ts`
- Misma lógica: en `multiple-choice` con imagen, generar siempre la tabla de dos columnas con la imagen a la derecha y centrada en su celda (`AlignmentType.CENTER`), ignorando `imageLayout` y `alignment` del schema.

### 4) Sin cambios de schema
- `imageLayout` y `alignment` siguen existiendo en el modelo (compatibilidad con borradores y con los otros tipos de pregunta).
- Para MC simplemente se ignoran al renderizar.

## Resultado esperado

- En cualquier pregunta de selección múltiple con imagen: opciones a la izquierda, imagen a la derecha centrada en su columna, en preview, PDF y Word.
- El editor ya no muestra opciones de layout/alineación de imagen para selección múltiple — se simplifica la UI.
- Borradores antiguos con `side-left` o `block` se renderizan automáticamente con el nuevo layout fijo.

