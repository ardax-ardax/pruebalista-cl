
## Plan: Ajustes críticos de interfaz administrativa

### 1. Refactorización de "Gestión de Consumo" (`UtpUsageManager.tsx`)

Reemplazar los inputs inline + botones pequeños ("Cuota", "+Créditos") por dos botones claros en la columna de acciones:

- **"Ajustar Límite"**: Abre un `Dialog` modal con un input numérico para establecer la cuota mensual (0 = sin límite). Llama a la misma lógica `handleSetQuota`.
- **"Añadir Créditos"**: Abre un `Dialog` modal con un input numérico para sumar créditos. Llama a `handleRechargeCredits`.

Se eliminan los estados `editingQuota` y `editingCredits` en favor de un estado de modal (`modalTarget: { userId, type: 'quota' | 'credits' } | null`) y un valor numérico temporal.

### 2. Selector de vinculación con nombre + email (`ColegiosManager.tsx`)

En el `SelectItem` del selector de usuarios no vinculados (línea 321), cambiar la etiqueta de:
```
{u.display_name || u.email || u.id.slice(0, 8)}
```
a:
```
{u.display_name && u.email
  ? `${u.display_name} (${u.email})`
  : u.display_name || u.email || u.id.slice(0, 8)}
```

### 3. Restricción del rol Admin (`AppLayout.tsx`)

- Ocultar "Crear prueba" si `isAdmin && !isUtpHead && !isDocente` (admin puro).
- Ocultar "Mis pruebas" y "Banco" para admin puro.
- "Cursos" ya solo se muestra para `isUtpHead`, no requiere cambio.

Se añade una variable `isAdminOnly = isAdmin && !isUtpHead` y se condiciona la visibilidad de esos NavItems con `!isAdminOnly`.

### 4. Invitaciones pendientes en ColegiosManager

Dentro de cada colegio expandido, después de la lista de miembros y antes del selector de vinculación, mostrar una sección "Invitaciones pendientes":

- Al hacer `refresh()`, cargar también `pending_invitations` filtrando por cada `colegio_id`.
- Mostrar cada email pendiente con un badge "Pendiente" en amarillo y la fecha de creación.
- Esto explica por qué un colegio puede tener 0 miembros pero ya tiene una invitación UTP.

### 5. Limpieza visual: badges de rol y mensaje "no vinculado"

- Definir colores consistentes para badges de rol en todo el proyecto:
  - Admin: `bg-red-100 text-red-800`
  - Jefe UTP: `bg-blue-100 text-blue-800`
  - Docente: `bg-green-100 text-green-800`
- Aplicar estos colores en `ColegiosManager` (miembros), `StaffManager`, y `UtpTeamManager`.
- En `UtpReviewCenter` y `UtpTeamManager`, el mensaje "cuenta no vinculada" solo se muestra si el rol es `utp_head` o `docente` (no admin). Verificar que no se dispare para admin.

---

### Archivos a modificar

| Archivo | Cambios |
|---|---|
| `src/components/admin/UtpUsageManager.tsx` | Reemplazar inputs inline por modales de Dialog |
| `src/components/admin/ColegiosManager.tsx` | Selector nombre+email, sección invitaciones pendientes |
| `src/components/AppLayout.tsx` | Ocultar nav items para admin puro |
| `src/components/admin/UtpReviewCenter.tsx` | Badge colores, verificar condición no-vinculado |
| `src/components/admin/UtpTeamManager.tsx` | Badge colores, verificar condición no-vinculado |
| `src/components/admin/StaffManager.tsx` | Badge colores consistentes |

No se requieren cambios de base de datos.
