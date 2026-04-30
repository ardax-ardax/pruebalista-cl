# Mover Optimización de Espacio sobre la Vista Previa

## Diagnóstico

Hoy el panel está dentro de la pestaña **"Datos"**, lo que obliga a saltar entre pestañas para ajustar márgenes y volver a "Vista previa" para ver el efecto. La pestaña **"Vista previa"** (`/CrearPrueba` → tab `preview`) sólo tiene un `Card` con `<AssessmentPreview ctx={renderCtx} />`.

## Cambios

### 1. `src/components/test-builder/AssessmentMetaForm.tsx`

- **Eliminar** la sección `LayoutOptimizationSection` del formulario de metadatos (queda solo con curso/asignatura/OAs/etc.).
- Quitar la prop `canEditLayout` (ya no se usa aquí).
- Mantener `LayoutOptimizationSection` y exportarlo para reusarlo desde la vista previa, o moverlo a un archivo nuevo.

### 2. Crear `src/components/test-builder/PreviewLayoutToolbar.tsx`

Componente nuevo, compacto y horizontal, pensado para vivir sobre la previsualización:

- Recibe `meta`, `onMetaChange`, `canEdit`.
- Render colapsado por defecto: una **barra fina** con título "Optimización de papel" + chip mostrando configuración actual (ej. `M:20·20·25mm · Esp:6pt · 1col`) + botón "Ajustar" / chevron.
- Al expandir, muestra los 4 sliders + el switch de 2 columnas en una **grid horizontal** (4 columnas en desktop, 2 en tablet, 1 en mobile) para no empujar mucho la previsualización hacia abajo.
- Botón "Restablecer" a `DEFAULT_LAYOUT`.
- Si `!canEdit`: candado, todo `disabled`, mensaje "Solo Admin/UTP puede modificar".
- Como cualquier cambio actualiza `meta.layout`, la `PaginatedAssessmentPreview` ya re-mide automáticamente (no hace falta tocarla).

### 3. `src/pages/CrearPrueba.tsx`

- Quitar `canEditLayout={isStaff}` del `<AssessmentMetaForm>`.
- En `<TabsContent value="preview">`, antes del `Card` de la previsualización, insertar:

```tsx
<PreviewLayoutToolbar
  meta={assessment.meta}
  onMetaChange={(meta) => setAssessment({ ...assessment, meta })}
  canEdit={isStaff}
/>
```

## Resultado esperado

```text
Pestaña "Vista previa"
┌──────────────────────────────────────────────┐
│ ✦ Optimización de papel · M:20·20·25 · 1col  │
│   [Ajustar ▾]                  [Restablecer] │
├──────────────────────────────────────────────┤  ← al expandir
│ Sup [●==] Inf [●==] Lat [●==] Esp [●==] [⚪] │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│             [vista previa pag. 1]            │
│             [vista previa pag. 2]            │
└──────────────────────────────────────────────┘
```

Mover los sliders re-pagina la prueba en vivo, sin cambiar de pestaña. Para docentes (`user`) la barra sigue visible pero en solo lectura.
