# Plan: Sistema de Ayuda y Feedback Integrado

## Objetivo
Agregar a la plataforma un canal de soporte y retroalimentación para usuarios que encuentren problemas, manteniendo la ayuda actual (FAQ + tour) y agregando un widget de reporte rápido que guarde los tickets internamente en la base de datos y un panel de gestión para admin.

## Alcance
- Mantener el botón de ayuda existente en el header (Centro de Ayuda + FAQ + tour).
- Agregar un widget flotante de feedback/reporte en la esquina inferior derecha de todas las pantallas autenticadas.
- Crear tabla `support_tickets` en la base de datos con contexto automático.
- Agregar nueva pestaña "Soporte" en el Panel de Administración para listar, filtrar y cerrar tickets.
- Garantizar seguridad multi-tenant: cada usuario solo crea/ve sus tickets; los admins ven todos.

## Detalle técnico

### 1. Base de datos
Nueva tabla `public.support_tickets`:
```
id: uuid primary key default gen_random_uuid()
user_id: uuid references auth.users(id) on delete cascade not null
message: text not null
category: text (ej: "bug", "duda", "mejora", "cuenta")
page_url: text
user_agent: text
role: text
status: text default "open" ("open" | "closed")
created_at: timestamptz default now()
updated_at: timestamptz default now()
```

Acciones:
- `GRANT SELECT, INSERT, UPDATE` a `authenticated`.
- `GRANT ALL` a `service_role`.
- Habilitar RLS.
- Política: usuarios autenticados pueden `SELECT` e `INSERT` solo sus propios registros (`user_id = auth.uid()`).
- Política: administradores pueden `SELECT` y `UPDATE` todos los registros (usando `public.has_role(auth.uid(), 'admin')`).
- Trigger para actualizar `updated_at` automáticamente.

### 2. Widget flotante de feedback
Nuevo componente `src/components/FeedbackWidget.tsx`:
- Botón flotante fijo en la esquina inferior derecha (ícono de mensaje/chat).
- Al hacer clic, se abre un pequeño panel con:
  - Selector de categoría (Bug, Duda, Mejora, Cuenta).
  - Textarea para describir el problema.
  - Botón "Enviar".
- Captura automática de contexto:
  - `window.location.href`
  - `navigator.userAgent`
  - Rol del usuario (desde `useAuth()`)
- Muestra confirmación tipo toast tras enviar.
- Solo visible para usuarios autenticados.
- Se monta en `AppLayout.tsx` una vez, para que aparezca en todas las páginas internas.

### 3. Ampliación del Centro de Ayuda
En `src/components/help/HelpModal.tsx`:
- Agregar tercera pestaña "Reportar problema".
- Incluir el mismo formulario de feedback (categoría + mensaje) dentro del modal, para que quienes usen el header también puedan reportar.
- Se reutiliza el mismo componente de formulario de feedback.

### 4. Panel de gestión de tickets
En `src/pages/AdminDashboard.tsx`:
- Nueva pestaña "Soporte" (ícono MessageSquare).
- Tabla con columnas: ID, Fecha, Usuario, Categoría, Mensaje, Estado, Acciones.
- Filtros: por estado (abierto/cerrado) y categoría.
- Acciones: marcar como cerrado/reabierto.
- Orden por fecha descendente.
- Query directo a `support_tickets` con join opcional a `profiles` para obtener email/display_name.

### 5. Librería de feedback
Nuevo archivo `src/lib/support-tickets.ts` con funciones:
- `createSupportTicket(data)` para insertar el ticket.
- `listMyTickets()` para el usuario final (opcional, si se usa en perfil o modal).
- `listAllTickets()` para admin.
- `updateTicketStatus(id, status)` para admin.

### 6. UX/Branding
- Usar la paleta de marca actual (turquesa/púrpura/lavanda) y el componente `Button` de shadcn.
- El widget flotante debe ser discreto: botón circular con ícono de mensaje, que se expande a card flotante al hacer clic.
- Asegurar que no tape contenido importante en móvil (margen inferior, ancho máximo).

### 7. Testing de verificación
- Verificar que el widget se renderiza en páginas autenticadas.
- Verificar que un usuario puede enviar un ticket y que aparece en la tabla de admin.
- Verificar que un usuario no puede ver tickets de otros usuarios.
- Verificar que un admin puede cerrar/reabrir tickets.
- Revisar políticas RLS con una query directa.

## Entregables
1. Migración de base de datos para `support_tickets`.
2. Componente `FeedbackWidget.tsx`.
3. Componente compartido de formulario de feedback.
4. Pestaña "Reportar problema" en `HelpModal.tsx`.
5. Pestaña "Soporte" en `AdminDashboard.tsx`.
6. Librería `src/lib/support-tickets.ts`.
7. Integración en `AppLayout.tsx`.

## No incluye
- Notificaciones por email al admin (puede agregarse después).
- Sistema de respuestas o mensajes entre admin y usuario (sería una segunda fase).
- Adjuntar archivos o capturas de pantalla.
