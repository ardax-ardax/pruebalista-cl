
## Flujo de Trabajo y Aprobación de Evaluaciones

### 1. Base de Datos

Migración SQL para agregar dos columnas a `assessments`:

```sql
ALTER TABLE assessments ADD COLUMN status text NOT NULL DEFAULT 'borrador';
ALTER TABLE assessments ADD COLUMN utp_feedback text;
```

Actualizar la política RLS de UPDATE para que:
- Los docentes (`user` role) solo puedan cambiar `status` de `borrador` a `pendiente_revision` o de `rechazado` a `pendiente_revision` en sus propias pruebas.
- Staff (`utp_head`/`admin`) puedan cambiar `status` a cualquier valor y escribir `utp_feedback`.

Se implementa con una función `security definer` que valide las transiciones permitidas, más políticas RLS ajustadas.

### 2. Schema TypeScript

- Agregar `status` y `utpFeedback` al tipo `Assessment` en `assessment-schema.ts`.
- Definir el tipo `AssessmentStatus = 'borrador' | 'pendiente_revision' | 'aprobado' | 'rechazado'`.
- Actualizar `emptyAssessment()` con `status: 'borrador'`.

### 3. Storage Layer

- Actualizar `assessment-storage.ts` para leer/escribir `status` y `utp_feedback` como columnas directas (no dentro del JSONB `data`).
- Agregar función `updateAssessmentStatus(id, status, feedback?)` que haga un UPDATE parcial.

### 4. Interfaz del Docente (CrearPrueba.tsx)

- Agregar botón **"Enviar a Revisión UTP"** visible cuando `status === 'borrador'` o `status === 'rechazado'`.
- Si `status` es `pendiente_revision` o `aprobado`, deshabilitar toda edición (tabs meta y contenido en modo lectura). Mostrar banner informativo.
- Si `status === 'rechazado'`, mostrar el feedback de UTP en un Alert prominente antes del formulario, con opción de corregir y reenviar.

### 5. Interfaz del Jefe UTP (MisPruebas.tsx)

- Agregar filtro de estado (Todos / Pendientes / Aprobados / Rechazados) junto a los filtros existentes.
- Al abrir una prueba ajena en `CrearPrueba.tsx`, si el usuario es UTP/admin y la prueba está en `pendiente_revision`, mostrar un panel de acciones con:
  - Botón **"Aprobar Evaluación"** (cambia a `aprobado`).
  - Botón **"Rechazar con Comentarios"** (abre textarea para feedback, cambia a `rechazado`).

### 6. Badges de Estado

- En `MisPruebas.tsx`, agregar un `Badge` junto al título de cada prueba:
  - Gris: Borrador
  - Amarillo: Pendiente de Revisión
  - Verde: Aprobado
  - Rojo: Rechazado

### Archivos a crear/editar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Nuevas columnas + políticas RLS |
| `src/lib/assessment-schema.ts` | Tipo `AssessmentStatus`, campos en `Assessment` |
| `src/lib/assessment-storage.ts` | Lectura/escritura de `status`/`utp_feedback`, función `updateAssessmentStatus` |
| `src/pages/MisPruebas.tsx` | Badges, filtro de estado |
| `src/pages/CrearPrueba.tsx` | Botón enviar a revisión, modo lectura, panel UTP, feedback display |
