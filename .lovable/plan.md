
# Reporte de Arquitectura — PruebaLista.cl
**Fecha:** 5 de mayo de 2026 | **Stack:** React 18 + Vite + Tailwind + Lovable Cloud (Supabase)

---

## 1. Modelo de Roles y Permisos

### Roles (enum `app_role`)
| Rol | Prioridad | Descripción |
|---|---|---|
| `admin` | 3 | Super administrador global. Ve y controla todo. |
| `utp_head` | 2 | Jefe de UTP. Supervisa docentes **de su mismo colegio**. |
| `docente` | 1 | Rol por defecto al registrarse. Crea evaluaciones y usa IA. |

- Un usuario puede tener múltiples roles; el sistema toma el de mayor prioridad (`ROLE_PRIORITY`).
- El concepto **isStaff** = admin OR utp_head. Se usa para gates compartidos.
- Auto-asignación de rol al registro via trigger `handle_new_user()`:
  - Si `email = 'admin@cnlc.cl'` → admin.
  - Si existe invitación pendiente → rol de la invitación + se vincula al colegio.
  - Caso contrario → docente (sin colegio).

### Protección de rutas (frontend)
| Ruta | Guard |
|---|---|
| `/auth` | Pública |
| `/`, `/crear-prueba`, `/pruebas`, `/perfil`, `/banco-preguntas` | `AuthGuard` (usuario autenticado) |
| `/cursos`, `/configuracion`, `/admin/dashboard` | `AuthGuard` + `AdminGuard` (isStaff requerido) |

### Protección de datos (RLS)
- **Funciones SECURITY DEFINER** centrales: `has_role()`, `is_staff()`, `is_same_colegio()`.
- `is_same_colegio()` permite que un admin vea todo, que un staff vea solo su colegio, y que cada usuario se vea a sí mismo.
- Tablas admin-only para escritura: `plans`, `colegios`, `admin_courses`, `admin_subjects`, `global_settings`, `mineduc_subjects`.
- Tablas con visibilidad por colegio: `assessments`, `question_bank`, `profiles`.
- `user_usage`: lectura propia + staff lee todo + admin tiene ALL.

---

## 2. Lógica de Negocio y Monetización

### Planes actuales (tabla `plans`, configurables por admin)
| ID | Label | Créditos | Max Eval. | Max Asig. | Docx | Watermark | Edit Layout | OMR |
|---|---|---|---|---|---|---|---|---|
| `free` (default) | Plan Gratuito | 20 | 10 | 5 | No | Sí | Sí | No |
| `basic` | Plan Básico | 50 | 20 | 10 | No | Sí | Sí | No |
| `medium` | Plan Medio | 100 | 50 | 20 | No | Sí | Sí | No |
| `pro` | Plan Pro | 200 | 100 | 40 | Sí | No | Sí | No |
| `institucional` | Plan Institucional | 100 | ∞ | ∞ | Sí | No | No | No |

### Sistema de créditos
- Cada generación IA consume 1 crédito.
- Función atómica `deduct_credit(_user_id)`: usa `UPDATE ... WHERE credits_available > 0` con `RETURNING`, evita race conditions. Retorna -1 si no hay créditos.
- Plan institucional sin cuota (`monthly_quota IS NULL`) = ilimitado, no se descuenta.
- Plan institucional con cuota = se descuenta normalmente.
- La Edge Function hace refund si la IA falla (restaura el valor previo).

### Expiración de planes
- `plan_expires_at` en `user_usage`. Si la fecha ya pasó, `computeEffectivePlan()` degrada al plan default (free).
- Al asignar un plan no-default desde admin, se pone expiración a 30 días por defecto.

### Watermark condicional
- `showWatermark` es un booleano del plan. Free/Basic/Medium muestran marca de agua; Pro e Institucional no.
- Se renderiza en el HTML de preview vía clase CSS `.pa-watermark`.

---

## 3. Gestión Institucional (Panel UTP)

Accesible en `/configuracion` cuando `isUtpHead = true`. Tres pestañas:

### 3.1 Catálogos
- Gestión local de listas de asignaturas, cursos y docentes que alimentan selectores de nombre de archivo.
- Funciones reset para restaurar valores por defecto.

### 3.2 Políticas
- **Auto-asignación** (`allow_self_assignment`): si está activa, los docentes ven todo el catálogo curricular; si no, solo sus asignaciones.
- **Ocultar créditos** (`hide_credits_from_teachers`): cuando está activo, los docentes ven "Plan Institucional" en lugar del contador de créditos.

### 3.3 Docentes (UtpUsageManager)
- Tabla con columnas: Docente, Plan, Créditos, Cuota mensual, Evaluaciones creadas, Preguntas IA generadas.
- **Acciones por docente:**
  - Establecer cuota mensual (0 = sin límite).
  - Recargar créditos (+N al saldo actual).
- **Descarga CSV de auditoría**: genera un archivo con nombre `resumen_consumo_ia_YYYY-MM-DD.csv` con todos los datos de la tabla.

### Flujo de aprobación de evaluaciones
- Docente envía evaluación: estado cambia de `borrador` → `pendiente_revision`.
- Staff (UTP/Admin) puede:
  - **Aprobar**: estado → `aprobado`, limpia feedback.
  - **Rechazar**: estado → `rechazado`, con texto de feedback (`utp_feedback`).
- Docente rechazado puede editar y reenviar. No puede editar en estado `pendiente_revision` o `aprobado`.
- RLS: update requiere `(user_id = auth.uid() AND status IN ('borrador','rechazado'))` OR `is_same_colegio()`.

---

## 4. Panel de Administración Global

Accesible en `/admin/dashboard`, solo para `isAdmin = true`. Seis pestañas:

### 4.1 Ajustes globales (`global_settings`)
- Pagos habilitados (toggle, sin pasarela implementada aún).
- Modo mantenimiento.
- Generación con IA (on/off global + motivo de desactivación visible a usuarios).
- Créditos IA iniciales para nuevos usuarios.

### 4.2 Planes (PlansManager)
- CRUD completo de planes: id, label, créditos, límites, flags de features.
- Los planes son dinámicos; no están hardcodeados.

### 4.3 Usuarios
- Tabla de todos los usuarios con: nombre, email, plan, créditos, expiración.
- **Cambio de plan inline** (select por usuario, actualiza créditos y expiración).
- **Recarga de créditos** individual (diálogo con monto).
- **Edición de fecha de expiración** con calendario.

### 4.4 Instituciones (asignación masiva)
- Selección múltiple de usuarios con checkboxes.
- Selector de plan destino.
- Botón "Asignar plan (N)" que aplica el plan a todos los seleccionados.

### 4.5 Asignaturas (AdminSubjectsManager)
- Gestión del catálogo global de asignaturas con niveles (Básica/Media).

### 4.6 Cursos (AdminCoursesManager)
- Gestión del catálogo global de cursos con nivel, sección (A-F), y asignaturas por curso.

---

## 5. Flujo de Evaluación y IA

### Generación de preguntas (Edge Function `generate-question`)
1. **Autenticación**: valida JWT del usuario.
2. **Verificación de créditos**: consulta `user_usage` con service role.
   - Institucional sin cuota → ilimitado.
   - Resto → llama `deduct_credit()` atómicamente ANTES de invocar IA.
3. **Parámetros requeridos**: `oaCode`, `oaDescription`, `gradeLabel`, `subjectLabel`, `questionType`.
4. **Parámetros opcionales**: `indicators[]` (código + descripción), `optionCount` (3-5), `statementCount` (2-4).
5. **Modelo IA**: `google/gemini-3-flash-preview` vía Lovable AI Gateway.
6. **Tool calling**: la IA debe responder exclusivamente vía `emit_question` con schema estricto según tipo:
   - **Selección múltiple**: prompt, points, options[]{text, correct}, difficulty, rubricExplanation.
   - **Verdadero/Falso**: prompt, statements[]{text, answer, points}, difficulty, rubricExplanation.
   - **Desarrollo**: prompt, points, answerLines, difficulty, rubricExplanation.
7. **Rúbrica automática**: campo `rubricExplanation` obligatorio con respuesta correcta detallada y criterios de corrección.
8. **Refund**: si la IA falla (429, 402, error de parsing), se restaura el crédito descontado.
9. **Logging**: cada generación exitosa se registra en `ai_generation_log`.

### Banco de preguntas (`question_bank`)
- Las preguntas generadas o manuales se almacenan con: tipo, datos JSON, OA, dificultad, hash de contenido.
- Soft-delete: `hidden_by_users` (array de UUIDs). La UI dice "eliminar" pero solo oculta.
- Visibilidad RLS: preguntas propias + del mismo colegio, excluyendo las ocultadas.

---

## 6. Capacidades de Exportación

| Formato | Disponibilidad | Mecanismo |
|---|---|---|
| **PDF** | Todos los planes | Ventana de impresión del navegador (`window.print()`). Respeta tamaño de página del template, márgenes, columnas SIMCE/PAES. |
| **.docx** | Solo `pro` e `institucional` (`can_export_docx = true`) | Generación nativa con `docx-js`. Incluye encabezado institucional, logo, tablas, imágenes con crop. |

- Si `canExportDocx = false`, el botón .docx aparece deshabilitado con indicación de upgrade.
- La watermark se renderiza condicionalmente según `showWatermark` del plan.
- Los nombres de archivo se construyen dinámicamente: `{asignatura}_{curso}_{tipo}_{docente}.{ext}`.

---

## 7. Estado de la Infraestructura

### Tablas en base de datos (17 tablas)
| Tabla | RLS | Propósito |
|---|---|---|
| `profiles` | Sí | Datos de perfil (vinculado a colegio) |
| `user_roles` | Sí | Roles del sistema |
| `user_usage` | Sí | Créditos, plan, expiración, cuota |
| `plans` | Sí | Definición dinámica de planes |
| `assessments` | Sí | Evaluaciones creadas |
| `question_bank` | Sí | Banco de preguntas con soft-delete |
| `ai_generation_log` | Sí | Registro de generaciones IA |
| `curriculum_base` | Sí | OAs con indicadores (JSON) |
| `teacher_assignments` | Sí | Asignaciones curso-asignatura-docente |
| `courses` | Sí | Cursos del colegio |
| `students` | Sí | Alumnos por curso |
| `colegios` | Sí | Multi-colegio |
| `pending_invitations` | Sí | Invitaciones con rol y colegio |
| `admin_courses` | Sí | Catálogo global de cursos |
| `admin_subjects` | Sí | Catálogo global de asignaturas |
| `admin_course_subjects` | Sí | Relación curso-asignatura |
| `plan_allowed_courses` | Sí | Cursos permitidos por plan |
| `app_settings` | Sí | Config. institucional |
| `global_settings` | Sí | Config. global (admin) |
| `mineduc_subjects` | Sí | 9,504 asignaturas SIGE Mineduc (referencia futura) |

### Funciones de base de datos críticas
- `handle_new_user()` — trigger en auth.users, crea profile + usage + rol.
- `deduct_credit()` — descuento atómico de créditos con bloqueo a nivel de fila.
- `validate_teacher_assignment_limit()` — trigger que verifica límite del plan antes de insertar asignación.
- `validate_plan_type()` — trigger que valida que plan_type exista en tabla plans.
- `is_same_colegio()` — función RLS para aislamiento multi-colegio.
- `hide_question_for_user()` — soft-delete en question_bank.

### Edge Functions
- `generate-question`: generación IA con validación de créditos, tool calling, refund y logging.
- `sync-profiles`: sincronización de perfiles.

### Storage
- Bucket `user-logos` (público): logos institucionales.

---

## 8. Funcionalidades Activas — Checklist

| Funcionalidad | Estado |
|---|---|
| Autenticación email+password y Google OAuth | ✅ Activo |
| Sistema de 3 roles (admin, utp_head, docente) | ✅ Activo |
| Multi-colegio con aislamiento RLS | ✅ Activo |
| Invitaciones con rol y colegio pre-asignado | ✅ Activo |
| 5 planes dinámicos configurables por admin | ✅ Activo |
| Créditos IA con descuento atómico | ✅ Activo |
| Expiración de planes con degradación automática | ✅ Activo |
| Generación IA de preguntas (Gemini 3 Flash) | ✅ Activo |
| 3 tipos de pregunta (selección múltiple, V/F, desarrollo) | ✅ Activo |
| Indicadores de evaluación opcionales | ✅ Activo |
| Rúbrica automática en cada pregunta generada | ✅ Activo |
| Banco de preguntas con soft-delete | ✅ Activo |
| Flujo de aprobación UTP (enviar/aprobar/rechazar) | ✅ Activo |
| Exportación PDF (todos los planes) | ✅ Activo |
| Exportación .docx (planes Pro e Institucional) | ✅ Activo |
| Watermark condicional por plan | ✅ Activo |
| Panel UTP: gestión de créditos y cuotas por docente | ✅ Activo |
| Panel UTP: descarga CSV de auditoría | ✅ Activo |
| Panel UTP: ocultar créditos a docentes | ✅ Activo |
| Panel Admin: ajustes globales (IA, pagos, mantenimiento) | ✅ Activo |
| Panel Admin: CRUD de planes | ✅ Activo |
| Panel Admin: gestión de usuarios + recarga de créditos | ✅ Activo |
| Panel Admin: asignación masiva de planes | ✅ Activo |
| Panel Admin: catálogos de cursos y asignaturas | ✅ Activo |
| Gestión de plantillas de formato | ✅ Activo |
| Currículum (OAs + indicadores) importable por CSV | ✅ Activo |
| Tabla Mineduc (9,504 asignaturas SIGE) | ✅ Cargada (sin UI, para uso futuro) |
| Pasarela de pagos real | ⏳ Toggle existe, sin implementación |
| Hoja OMR | ⏳ Componente existe (`OmrSheetDialog`), gated por plan (`can_use_omr`), ningún plan lo habilita aún |

---

Este reporte refleja el estado real del código y la base de datos al 5 de mayo de 2026. Puede usarse como fuente de verdad para planificar sprints futuros.
