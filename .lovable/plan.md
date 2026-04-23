

# Imagen MC/VF: forzar alto = alto de la columna de opciones

## Diagnóstico

`height: 100%` en el `<img>` dentro de un `<td height:1px>` no se resuelve correctamente: el navegador no propaga la altura calculada de la fila al contenido del `<td>` cuando el contenedor intermedio es `display:block`. Por eso la imagen se queda en su tamaño intrínseco (miniatura).

## Solución

Usar el patrón estándar de "hijo absoluto dentro de celda relativa" para que la imagen reciba un alto real desde el cual derivar `max-height: 100%`.

### `src/lib/assessment-render.tsx` — CSS `.pa-mc-image`

Reemplazar las reglas actuales por:

```css
.pa-mc-split td.pa-mc-image {
  width: 40%;
  padding-left: 8pt;
  position: relative;          /* contenedor para el wrapper absoluto */
}
.pa-mc-image .pa-image-wrap {
  position: absolute;
  inset: 0 0 0 8pt;            /* respeta el padding-left */
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pa-mc-image .pa-image-plain {
  max-height: 100%;
  max-width: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}
.pa-mc-image .pa-image-crop {
  max-height: 100%;
  max-width: 100%;
  height: 100%;                /* el inner usa overflow:hidden + img absoluta */
  width: auto;
  aspect-ratio: var(--pa-ar, auto);
  display: inline-block;
  overflow: hidden;
  position: relative;
}
.pa-mc-image .pa-image-crop-inner {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
```

Quitar la regla `height: 1px` del `<td>`. El truco real para igualar alto es: el `<td>` adopta el alto de la fila (definido por el `<td>` hermano con el contenido de opciones), y el wrapper absoluto se estira a ese alto vía `inset: 0`.

### Sin otros cambios

- `renderContainedImageHtml`: ya expone `--pa-ar` correctamente, no requiere cambios.
- `assessment-docx.ts`: sin cambios.
- Editor: sin cambios.

## Resultado esperado

En MC/VF con imagen, la imagen ocupa el 100% del alto de la columna de opciones/afirmaciones, centrada vertical y horizontalmente, manteniendo su proporción (recortada o no). Ya no aparece como miniatura.

