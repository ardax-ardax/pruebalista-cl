## Dashboard de inicio para Docentes

Actualmente la ruta `/` lleva directo al formulario "Crear Prueba". Se creará un **Dashboard** como página de inicio para docentes (rol `docente`), mientras que Admin y UTP mantienen su flujo actual.

### Distinción importante
- **Docente autónomo** (colegio_id = null): independiente, sin UTP ni flujo de revisión.
- **Profesor** (colegio_id != null): vinculado a un colegio, depende de UTP para revisión.

El dashboard se adapta a ambos casos.

---

### Qué se construye

**Nueva página `src/pages/DashboardDocente.tsx`** con:

1. **Saludo personalizado** — "Hola, [nombre]" con avatar.

2. **Tarjetas de resumen** (3 cards horizontales):
   - Pruebas creadas (total)
   - Preguntas en el banco (total propias)
   - Créditos IA restantes (o "Plan Institucional" si ocultos)

3. **Pruebas recientes** (últimas 5):
   - Título, asignatura, fecha, estado (badge color)
   - Clic → abre en editor (`/crear-prueba?id=...`)
   - Solo para **profesores** (con colegio): mostrar estado de revisión UTP (pendiente/aprobada/rechazada)
   - Para **docentes autónomos**: no mostrar estado de revisión (no aplica)

4. **Acciones rápidas** (botones):
   - "Crear nueva prueba" → `/`  (se cambiará la ruta de CrearPrueba a `/crear-prueba`)
   - "Ver banco de preguntas" → `/banco-preguntas`
   - "Ver todas mis pruebas" → `/pruebas`

---

### Cambios técnicos

| Archivo | Cambio |
|---------|--------|
| `src/pages/DashboardDocente.tsx` | Nuevo — página completa del dashboard |
| `src/App.tsx` | Ruta `/` → DashboardDocente para docentes; `/crear-prueba` → CrearPrueba |
| `src/components/AppLayout.tsx` | Actualizar NavItem de "Crear prueba" a `/crear-prueba`; agregar "Inicio" → `/` |
| `src/pages/MisPruebas.tsx` | Actualizar links internos si apuntan a `/` |
| `mem://features/modules` | Actualizar distinción docente autónomo vs profesor |

### Datos que consulta el Dashboard
- `listAssessments()` — ya existe, retorna pruebas del usuario (RLS)
- `searchBank({ userId })` — ya existe, cuenta preguntas propias
- `useUserUsage()` — ya existe, créditos IA
- `getMyProfile()` — ya existe, para saber si tiene colegio_id (profesor vs autónomo)

No se necesitan cambios de base de datos.
