
## Reorganizar página Configuración en pestañas

La página actual muestra todas las secciones apiladas verticalmente. Se organizará en pestañas usando el componente `Tabs` de shadcn (ya usado en Perfil.tsx).

### Estructura por rol

**Admin** (4 pestañas):
1. **Colegio** -- Datos del colegio (logo + nombre) + ColegiosManager
2. **Personal** -- StaffManager
3. **Currículum** -- CurriculumManager
4. **Plantillas** -- Editor de plantillas de formato

**UTP** (3 pestañas):
1. **Catálogos** -- Asignaturas, cursos y docentes (CatalogManager x3)
2. **Políticas** -- Política de asignación + Visibilidad de créditos
3. **Docentes** -- Consumo de IA por docente (UtpUsageManager)

**Docente** (sin pestañas, solo la sección de plantillas como está ahora)

### Archivo modificado

`src/pages/Configuracion.tsx`:
- Importar `Tabs, TabsContent, TabsList, TabsTrigger` (ya disponibles en el proyecto).
- Envolver las secciones de admin en un `Tabs` con las 4 pestañas descritas.
- Envolver las secciones de UTP en un `Tabs` con las 3 pestañas.
- La vista docente queda sin cambios (solo plantillas).
- Agregar iconos a las pestañas para mejor UX (Building2, Users, BookOpen, LayoutTemplate, Shield, BarChart3).

No hay cambios en base de datos ni en otros archivos.
