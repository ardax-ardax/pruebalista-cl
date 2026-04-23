
# Corregir por qué la imagen de V/F sigue viéndose pequeña

## Diagnóstico

El problema principal no parece ser ya el layout de 2 columnas, sino el dato de ancho que sigue llegando como si fuera una imagen “normal”.

Hoy el editor usa `allowFullWidth` para MC/VF, pero en `ImageCropEditor.tsx` está forzando:

- `widthPct = MAX_IMAGE_WIDTH_PCT`
- y `MAX_IMAGE_WIDTH_PCT` en `assessment-schema.ts` vale `20`, no `100`

Eso significa que, aunque la imagen esté centrada en la columna derecha, sigue guardándose con un ancho efectivo de 20%. En imágenes no recortadas eso se traduce directamente en miniatura. Y en imágenes recortadas también puede seguir condicionando exportes y estados guardados.

## Qué cambiar

### 1) `src/components/test-builder/ImageCropEditor.tsx`
Corregir la lógica de “full width” para MC/VF:

- Cuando `allowFullWidth` esté activo, forzar:
  - `widthPct = 100`
  - `alignment = "center"`
- No reutilizar `MAX_IMAGE_WIDTH_PCT` en este modo, porque ese valor es el tope normal (20%), no el ancho completo.
- Ajustar también:
  - `onPick(...)`
  - el `useEffect(...)` que normaliza imágenes existentes
  - cualquier helper interno de clamp/max para que `allowFullWidth` realmente signifique 100%

## 2) `src/lib/assessment-render.tsx`
Blindar el render para preguntas split (MC/VF con imagen), de modo que no dependa del valor viejo guardado en storage:

- En `renderContainedImageHtml(...)`, ignorar `img.widthPct` para imágenes de columna y asumir siempre ancho completo de columna.
- Mantener la imagen centrada y escalada al alto disponible.
- Esto corrige también evaluaciones antiguas que ya quedaron persistidas con `widthPct = 20`.

## 3) `src/lib/assessment-docx.ts`
Alinear Word con el mismo criterio:

- En la tabla split de MC/VF, no usar `q.image.widthPct` para calcular el tamaño.
- Forzar ancho completo de la columna también en DOCX.
- Así preview, PDF y Word quedan consistentes.

## 4) `src/components/test-builder/QuestionEditor.tsx`
Ajustar el texto auxiliar para que no diga que se puede “ajustar su tamaño dentro de la columna”, porque ya no aplica.

## Resultado esperado

En Verdadero/Falso y Selección múltiple con imagen de enunciado:

- la imagen sigue en la columna derecha,
- se mantiene centrada,
- deja de comportarse como si estuviera limitada al 20%,
- y puede crecer realmente hasta el alto disponible de la columna.

## Detalle técnico

El síntoma “parece que sigue usando solo un %” encaja con el código actual: el modo `allowFullWidth` está usando por error la constante de ancho normal (`20`) en vez de `100`. Aunque el CSS de alto esté mejorado, si la imagen base sigue entrando como `width: 20%`, visualmente seguirá pareciendo miniatura.

Por eso la corrección debe hacerse en dos capas:

1. editor: guardar 100 en MC/VF nuevos,
2. renderer/export: ignorar anchos antiguos ya persistidos y tratar siempre estas imágenes como de ancho completo de columna.
