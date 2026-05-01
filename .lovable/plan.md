# Restringir tipos de pregunta en modo PAES

## Problema
Al elegir la plantilla **Ensayo PAES** siguen visibles botones y opciones de tipos de pregunta que no corresponden al formato oficial PAES (que es 100% selección múltiple con 5 alternativas). Hoy se filtran solo "Verdadero/Falso" y "Desarrollo", pero quedan activos:

- **Bloque info** y **Sección** en la barra "Agregar".
- En el diálogo **Generar con IA**, el selector permite elegir V/F y Desarrollo.
- En **SIMCE** la regla es similar pero algo más laxa (puede tener bloques de lectura → "info-block" sí aplica).

## Cambios

### 1. `src/components/test-builder/QuestionList.tsx`
Diferenciar el filtro `addable` según `essayMode`:

- **PAES**: dejar únicamente `multiple-choice`. Ocultar V/F, Desarrollo, Bloque info y Sección (el formato oficial no usa secciones internas; el cuadernillo es lineal).
- **SIMCE**: mantener `multiple-choice`, `info-block` (necesario para textos de lectura) y `section-title`. Excluir V/F y Desarrollo (igual que hoy).
- **Sin essayMode**: comportamiento actual (todos los tipos).

### 2. `src/components/test-builder/AIGenerateDialog.tsx`
Aceptar prop opcional `essayMode?: "simce" | "paes" | null` desde `QuestionList`. Cuando sea `"paes"`:
- Forzar `type = "multiple-choice"` al abrir.
- Ocultar las opciones `true-false` y `short-answer` del Select (o deshabilitar el Select y mostrar texto fijo "Selección múltiple — formato PAES").

Cuando sea `"simce"`: ocultar también V/F y Desarrollo (alineado con la barra de tipos).

### 3. Validación defensiva
En `QuestionList.tsx`, si `essayMode === "paes"` y existen preguntas con `type` distinto a `multiple-choice` (ej. importadas de versiones anteriores), no eliminarlas automáticamente, pero mostrar un aviso suave en el editor de esa pregunta indicando que no corresponde al formato PAES.

## Fuera de alcance
No se tocan: el motor PDF/DOCX, los ejes temáticos, ni el esquema de datos. Solo restricciones de UI en la creación de preguntas.
