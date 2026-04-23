

# Imagen centrada hasta 50% + centrado dentro de columna

## Cambios

### 1) Schema (`src/lib/assessment-schema.ts`)
- Añadir constante `MAX_IMAGE_WIDTH_CENTER_PCT = 50` (sigue 20% para left/right).
- Nueva función `clampWidthPctByAlign(n, alignment)` que devuelve el clamp adecuado: 50% si `center`, 20% en otro caso.
- `clampWidthPct` se mantiene (compat).

### 2) Editor (`src/components/test-builder/ImageCropEditor.tsx`)
- El campo "Ancho (%)" usa `max` dinámico según `value.alignment`: 50 si centro, 20 si no.
- Texto de ayuda muestra el límite efectivo (`Máx. 50%` / `Máx. 20%`).
- Al cambiar alignment, si el `widthPct` actual excede el nuevo máximo, se re-clampa automáticamente con `clampWidthPctByAlign`.
- Usar `clampWidthPctByAlign` en el `onChange` del input numérico.

### 3) Renderer web/PDF (`src/lib/assessment-render.tsx`)
- En `renderImageHtml`: el clamp `Math.max(10, Math.min(20, img.widthPct))` pasa a depender de la alineación → `Math.min(img.alignment === "center" ? 50 : 20, ...)`.
- El layout split (`renderContainedImageHtml`) **centra** la imagen dentro de la celda: añadir `pa-align-center` por defecto al wrapper independientemente del `alignment` original. Es decir, dentro de la celda del split, ignoramos el alignment y siempre centramos.
- CSS sin cambios estructurales (ya existe `.pa-align-center`).

### 4) DOCX (`src/lib/assessment-docx.ts`)
- En `buildImageRun`: el clamp `Math.min(20, ...)` pasa a `Math.min(img.alignment === "center" ? 50 : 20, ...)` cuando `allowFullWidth` es false.
- En la rama `isSplit` (split layout), forzar `AlignmentType.CENTER` en el párrafo de la celda de imagen, ignorando `q.image.alignment`.

## Resultado esperado

- Cuando el usuario elige alineación "Centro", el slider/input de ancho permite hasta 50% del ancho útil.
- Para "Izquierda" o "Derecha" el tope sigue siendo 20%.
- En layout dos columnas (`side-right`/`side-left`), la imagen siempre se centra horizontalmente dentro de su columna, sin importar el `alignment` configurado.
- Borradores existentes con widthPct ≤ 20 siguen funcionando; al cambiar a centro, el usuario puede subir hasta 50.

