
## Simplificar control de IA: solo switch global con mensaje de motivo

### Cambios en la base de datos

1. **Agregar campo `ai_disabled_reason`** a `global_settings` (texto, nullable) — para que el admin escriba el motivo al desactivar la IA
2. **Eliminar columna `ai_enabled`** de `user_usage` — ya no se necesita el control individual (los créditos ya cumplen esa función)

### Cambios en el código

**1. `src/lib/global-settings.ts`:**
- Agregar `ai_disabled_reason` al tipo e incluirlo en carga/guardado

**2. `src/hooks/useAIEnabled.ts`:**
- Simplificar: solo consulta `global_settings.ai_enabled` y `ai_disabled_reason`
- Ya no consulta `user_usage`

**3. `src/pages/AdminDashboard.tsx`:**
- Quitar la columna "IA" y el switch por usuario de la tabla de usuarios
- Agregar un campo de texto para el motivo debajo del switch global de IA en Ajustes (se habilita cuando la IA está desactivada)

**4. `src/components/test-builder/AIGenerateDialog.tsx`:**
- Mostrar el motivo del admin en la alerta cuando la IA está desactivada, junto con el mensaje de que los créditos no se pierden
