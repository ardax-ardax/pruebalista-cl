
## Plan: Optimización estética + Dashboard Institucional + RLS + Notificaciones

### 1. Landing Page — Ajustes estéticos menores

La Landing ya tiene implementados el header con tagline, footer con contacto/redes/legal, bordes redondeados y tarjetas above-the-fold. Se revisará en viewport móvil (402px) para verificar que todo sea visible sin scroll excesivo, y se harán ajustes de padding/spacing si es necesario.

**Archivos**: `src/pages/Landing.tsx`

---

### 2. Dashboard Docente Institucional (`/docente/dashboard`)

Reescribir `DocenteDashboardInstitucional.tsx` con:

- **Saludo personalizado**: "Hola [Nombre], bienvenido al panel de [Nombre del Colegio]". Se obtiene el nombre del usuario via `useAuth` y el nombre del colegio consultando la tabla `colegios` via `colegio_id` del perfil.
- **Sección de Notificaciones**: Consulta evaluaciones del docente con `status = 'rechazado'` o `status = 'aprobado'` que tengan `utp_feedback` no vacío. Se muestran como tarjetas de notificación con badge de estado y el mensaje de la UTP. Reemplazar cualquier mención de "Encargos" por "Notificaciones".
- **Accesos rápidos**: Botones prominentes para "Crear Evaluación" y "Mis Evaluaciones".
- **Estadísticas rápidas**: Pruebas creadas, preguntas en banco, créditos IA (respetando `hideCredits`).

**Archivos**: `src/pages/DocenteDashboardInstitucional.tsx`

---

### 3. Privacidad del Banco de Preguntas (RLS)

Actualizar la política SELECT de `question_bank`:

- **Docente**: solo ve sus propias preguntas (`user_id = auth.uid()`) que no estén ocultas.
- **UTP/Admin**: ve todas las preguntas de docentes de su mismo colegio (via `is_same_colegio`) que no estén ocultas.

Esto requiere una migración SQL para reemplazar la política `Read own not hidden or same colegio` actual por una más restrictiva:

```sql
DROP POLICY "Read own not hidden or same colegio" ON public.question_bank;

CREATE POLICY "Docente reads own, staff reads colegio"
ON public.question_bank FOR SELECT TO authenticated
USING (
  NOT (auth.uid() = ANY(hidden_by_users))
  AND (
    user_id = auth.uid()
    OR is_staff(auth.uid()) AND is_same_colegio(auth.uid(), user_id)
  )
);
```

Esto restringe a que docentes normales solo vean sus propias preguntas, mientras que UTP/Admin ven las de su colegio.

**Herramienta**: Migration tool

---

### 4. Flujo de Feedback UTP → Docente

La tabla `assessments` ya tiene `utp_feedback` y `status`. El punto 2 (Dashboard) ya incluirá la lectura de estos campos como "Notificaciones". No se requiere nueva tabla ni migración adicional — las evaluaciones con status `rechazado` o `aprobado` que tengan `utp_feedback` aparecerán automáticamente como notificaciones en el dashboard del docente.

---

### Resumen de cambios

| Archivo / Recurso | Acción |
|---|---|
| `src/pages/Landing.tsx` | Ajustes menores de spacing móvil |
| `src/pages/DocenteDashboardInstitucional.tsx` | Reescritura completa con saludo, notificaciones y accesos rápidos |
| Migración SQL | Nueva política RLS para `question_bank` |
