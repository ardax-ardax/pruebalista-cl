
## Control de IA Multinivel para el Administrador

### ¿Qué se va a construir?

Un sistema que permite al admin activar o desactivar el uso de IA a dos niveles:

1. **Global** — Un switch maestro. Si está apagado, nadie en la plataforma puede usar IA.
2. **Por usuario** — Desactivar IA para profesores específicos, incluso si globalmente está activa.

> **Nota:** El nivel "por institución" queda preparado para el futuro si la plataforma escala a múltiples colegios. Por ahora no aplica porque es un solo colegio.

### ¿Cómo funciona la lógica?

- **IA global OFF** → Todos los profesores ven el botón de IA deshabilitado con mensaje: *"La generación con IA está deshabilitada por el administrador"*
- **IA global ON + usuario con IA OFF** → Solo ese profesor ve el mensaje de deshabilitado
- **IA global ON + usuario con IA ON** → Funciona normal (verifica créditos como ahora)

### Cambios en la base de datos

**1. Agregar columna `ai_enabled` a `global_settings`:**
- Tipo `boolean`, default `true`
- Controla el switch maestro global

**2. Agregar columna `ai_enabled` a `user_usage`:**
- Tipo `boolean`, default `true`
- Controla el acceso por usuario individual

### Cambios en el código

**1. Actualizar `src/lib/global-settings.ts`:**
- Agregar `ai_enabled` al tipo `GlobalSettings` y a las funciones de carga/actualización

**2. Crear hook `useAIEnabled`:**
- Consulta `global_settings.ai_enabled` y `user_usage.ai_enabled`
- Retorna `{ aiEnabled: boolean, reason?: string }` 
- Combina ambos niveles: si cualquiera es `false`, retorna `false` con el motivo

**3. Actualizar `AIGenerateDialog.tsx`:**
- Usar el nuevo hook para mostrar/ocultar el botón de generación
- Si IA está desactivada, mostrar alerta explicativa en vez del formulario

**4. Panel Admin — Sección "Control de IA":**
- Switch global de IA (ON/OFF) en la configuración general
- En la lista de usuarios, agregar un toggle individual de IA por profesor
- Indicador visual: ícono junto al nombre del profesor mostrando si tiene IA activa

### Resumen visual del flujo

```text
Admin Panel
├── Configuración General
│   └── [Toggle] Generación con IA: ON/OFF  ← global_settings.ai_enabled
│
└── Gestión de Usuarios
    └── Lista de profesores
        ├── Profesor A  [IA: ✓]  ← user_usage.ai_enabled
        ├── Profesor B  [IA: ✗]
        └── Profesor C  [IA: ✓]
```

### Lo que NO cambia
- El sistema de créditos sigue funcionando igual
- Los logs de generación (`ai_generation_log`) siguen registrando todo
- La edge function `generate-question` no necesita cambios (el control es del lado del cliente antes de llamarla)
