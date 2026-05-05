
## Rediseño completo de Landing Page + Enrutamiento inteligente post-login

### Archivos a modificar

| Archivo | Acción |
|---------|--------|
| `src/pages/Landing.tsx` | Reescribir completo |
| `src/lib/resolve-destination.ts` | Actualizar lógica docente institucional |
| `src/App.tsx` | Agregar ruta `/docente/dashboard` |
| `src/pages/DocenteDashboardInstitucional.tsx` | Crear (página placeholder institucional) |

---

### 1. Landing.tsx -- Rediseño completo

**Hero Section:**
- Badge superior: "Plataforma alineada al currículum Mineduc"
- Titulo: "Potencia tu gestión pedagógica con IA alineada al Mineduc"
- Subtitulo: "Estandariza tus evaluaciones, ahorra horas de trabajo y asegura la cobertura curricular usando tu cuenta de Google"
- Fondo con gradiente azul profundo sutil, estilo corporativo limpio

**Cards de acceso con Google branding:**

Ambas tarjetas tendrán botones con el logo oficial de Google (SVG "G" multicolor inline) y texto "Ingresar con Google", con estilo estándar Google (fondo blanco, borde `#dadce0`, texto `#3c4043`, hover `#f7f8f8`, font-weight medium).

- **Card Docente**: icono GraduationCap, titulo "Acceso Docente", descripcion "Crea evaluaciones profesionales, accede al banco de preguntas y genera material con IA en segundos". Features: Generacion IA, Banco de preguntas, Exportacion PDF/DOCX.
- **Card UTP/Admin**: icono Building2, titulo "Gestion Institucional / UTP", descripcion "Supervisa el consumo, aprueba evaluaciones y toma el control de la calidad educativa de tu colegio". Features: Revision y aprobacion, Asignacion de cursos, Reportes de uso.

Cada card guarda un `loginIntent` en estado local (`"docente"` o `"institucional"`) antes de llamar `signInWithGoogle()`.

**Loading Spinner:**
Mientras se procesa el login (entre clic y redireccion), overlay con spinner animado CSS y texto "Conectando con Google..."

**Feedback de permisos post-login:**
En el `useEffect` de redireccion, si `loginIntent === "institucional"` pero el rol es `docente` (no admin/utp_head), mostrar toast: "Tu cuenta no tiene permisos directivos. Entrando a tu panel docente..." y redirigir al destino docente.

**Franja inferior de confianza:**
Iconos destacando: "Conexion con OAs del Mineduc", "Formatos SIMCE/PAES", "Flujo UTP Integrado". Con iconos en circulos con fondo `primary/10`.

**Responsivo:**
- Mobile: cards en columna, hero con texto mas pequeno, padding ajustado
- Desktop: cards en grid 2 columnas, hero con texto grande

---

### 2. resolve-destination.ts -- Ruta docente institucional

Cambiar la linea que retorna `/` cuando el docente tiene `colegioId`, para que retorne `/docente/dashboard` en su lugar.

```
if (profile?.colegioId) return "/docente/dashboard";
```

---

### 3. App.tsx -- Nueva ruta

Agregar:
```
<Route path="/docente/dashboard" element={<AuthGuard><DocenteDashboardInstitucional /></AuthGuard>} />
```

---

### 4. DocenteDashboardInstitucional.tsx -- Pagina placeholder

Pagina simple con `AppLayout` que muestra un mensaje de bienvenida:
- Titulo: "Bienvenido! Tu colegio ya es parte de PruebaLista"
- Subtitulo: "Estamos preparando tu nuevo panel institucional"
- Boton para ir a `/crear-prueba` como accion principal
- Links rapidos a Banco de Preguntas y Mis Pruebas

Esta pagina sera el destino de docentes que pertenecen a un colegio, diferenciandolos de los independientes que van directo a `/crear-prueba`.

---

### Notas tecnicas

- El `loginIntent` se guarda en `useState` y se persiste en `sessionStorage` para sobrevivir el redirect de OAuth.
- No se modifica `useAuth.tsx` ni `AuthGuard.tsx`.
- La paleta existente (azul profundo `215 70% 32%`, success verde `145 60% 38%`) se mantiene. Se agrega verde esmeralda como acento en la franja de confianza via clases Tailwind (`emerald-500`).
