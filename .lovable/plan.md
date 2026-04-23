

# Ocultar control de ancho en imágenes de columna (MC y V/F)

## Diagnóstico

Cuando una imagen está en modo columna (MC o V/F con `allowFullWidth`), el editor sigue mostrando el control de "Ancho (%)". El usuario quiere que en ese modo la imagen se asuma siempre al 100% de la columna y el editor solo muestre el botón de **Recortar** (más Quitar).

Hoy `ImageCropEditor` con `allowFullWidth=true` ya oculta el selector de alineación, pero sigue mostrando el input numérico de ancho.

## Cambios

### `src/components/test-builder/ImageCropEditor.tsx`

- Cuando `allowFullWidth` está activo:
  - **Ocultar** el bloque "Ancho (%)" (input + texto auxiliar) además del selector de alineación.
  - Al recibir/cargar una imagen en este modo, forzar `widthPct = 100` y `alignment = "center"` para que el render use toda la columna.
- Mantener visibles únicamente: la miniatura recortada, el botón **Recortar** y el botón **Quitar**.
- En el modo normal (otros tipos de pregunta) nada cambia: siguen apareciendo ancho y alineación.

### Sin cambios en otros archivos

- `assessment-render.tsx` y `assessment-docx.ts` ya respetan `widthPct`; al forzarse a 100 desde el editor, la imagen ocupa toda la columna automáticamente.
- `QuestionEditor.tsx` no requiere cambios: ya pasa `allowFullWidth` para MC y V/F.

## Resultado

En preguntas MC o V/F con imagen, el editor del enunciado muestra solo: miniatura, **Recortar** y **Quitar**. La imagen siempre ocupa el 100% de su columna (40% del ancho de contenido), centrada.

