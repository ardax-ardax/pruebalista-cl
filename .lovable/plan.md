## Cambio

Reorganizar la página de perfil del docente usando pestañas (`Tabs` de shadcn) en lugar de tarjetas apiladas verticalmente.

### Pestañas propuestas

1. **Datos personales** — Avatar, nombre y email (contenido actual de la primera Card).
2. **Mis cursos** — Asignaciones de cursos y asignaturas (solo visible para docentes, como ahora).
3. **Branding** — Nombre del colegio, logo y botón guardar.

### Archivo a editar

**`src/pages/Perfil.tsx`**:
- Importar `Tabs, TabsContent, TabsList, TabsTrigger` de `@/components/ui/tabs`.
- Reemplazar el `div.space-y-6` que contiene las 3 Cards por un componente `Tabs` con `defaultValue="datos"`.
- Cada `TabsContent` contiene el contenido actual de su Card correspondiente (sin cambios funcionales).
- Para docentes se muestran 3 pestañas; para staff solo 2 (sin "Mis cursos").
- Mantener el encabezado "Mi Perfil" fuera de las pestañas, arriba.

No se requieren cambios en base de datos ni otros archivos.