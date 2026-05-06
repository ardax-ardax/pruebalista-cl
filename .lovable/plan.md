
# Formatos Especiales SIMCE/PAES

## Resumen

Agregar un selector de formato explícito ("Evaluación Estándar", "SIMCE", "PAES") al inicio del creador de pruebas, con reglas dinámicas que restrinjan grados, alternativas, OA y cantidad de preguntas según el formato elegido. También incluir contexto de formato en el prompt de IA.

## Cambios

### 1. Selector de formato en AssessmentMetaForm

Agregar un selector de 3 opciones al inicio del formulario (antes de la plantilla). Al cambiar formato:

- **Estándar**: comportamiento actual, sin restricciones.
- **SIMCE**: filtra plantilla a `ensayo-simce`, auto-selecciona 4 alternativas, sugiere 35 preguntas.
- **PAES**: filtra plantilla a `ensayo-paes`, auto-selecciona alternativas según asignatura (4 para Mat M1, 5 resto), sugiere 65 preguntas.

El selector reemplaza la necesidad de que el usuario elija manualmente la plantilla de ensayo. Al cambiar formato se auto-asigna el `templateId` correspondiente.

### 2. Restricciones de grado

**Archivos**: `src/components/test-builder/AssessmentMetaForm.tsx`

- **SIMCE**: Actualizar `SIMCE_ALLOWED_GRADES` para incluir `8ºBásico`: `["4ºBásico", "6ºBásico", "8ºBásico", "IIMedioA", "IIMedioB"]`.
- **PAES**: Actualizar `PAES_FORCED_GRADES` para incluir III Medio: `["IIIMedioA", "IIIMedioB", "IVMedioA", "IVMedioB"]`. Dejar el selector habilitado (no bloqueado) para que el docente elija entre III y IV.
- **SIMCE aviso**: Si el grado seleccionado no está en `SIMCE_ALLOWED_GRADES`, mostrar alerta "Formato no disponible para este nivel" e impedir avanzar.

### 3. Alternativas automáticas

Al seleccionar formato o cambiar asignatura:
- **SIMCE**: `defaultMcOptions = 4`
- **PAES + Matemática M1 (variante "m1")**: `defaultMcOptions = 4`
- **PAES + resto**: `defaultMcOptions = 5`

El selector de alternativas sigue visible para ajuste manual.

### 4. Sugerencia de cantidad de preguntas

Agregar campo `suggestedQuestionCount` al meta (o mostrarlo como hint en la UI):
- **SIMCE**: mostrar hint "Se sugieren 35 preguntas" junto al contenido.
- **PAES**: mostrar hint "Se sugieren 65 preguntas" (varía por variante, ya existe en `PAES_VARIANTS`).

No se bloquea, es informativo.

### 5. OA oculto en PAES

Ya implementado. Se mantiene sin cambios.

### 6. Contexto IA (edge function)

**Archivos**: `src/lib/assessment-ai.ts`, `supabase/functions/generate-question/index.ts`

- Agregar campo opcional `essayMode?: "simce" | "paes"` al payload de `GenerateQuestionParams` y al body del edge function.
- En el prompt del sistema del edge function, si `essayMode` está presente, agregar: "Genera una evaluación bajo el estándar oficial de [SIMCE/PAES] de Chile para la asignatura [subjectLabel]."

### 7. Validación

**Archivo**: `src/pages/CrearPrueba.tsx`

- Si formato es SIMCE y grado no está en los permitidos: error "El formato SIMCE no está disponible para este nivel".
- Si formato es PAES y grado no es III/IV Medio: error "El formato PAES solo aplica a III y IV Medio".

Estas validaciones se agregan al `validate()` existente.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/test-builder/AssessmentMetaForm.tsx` | Selector de formato, restricciones de grado, auto-alternativas, hints |
| `src/pages/CrearPrueba.tsx` | Validación de compatibilidad grado/formato |
| `src/lib/assessment-ai.ts` | Agregar `essayMode` al payload |
| `supabase/functions/generate-question/index.ts` | Incluir contexto SIMCE/PAES en prompt |
| `src/components/test-builder/AIGenerateDialog.tsx` | Pasar `essayMode` a `generateQuestion` |

No se requieren migraciones de base de datos.
