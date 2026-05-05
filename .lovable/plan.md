
## Objetivo

Almacenar el catálogo completo de asignaturas del Mineduc (9,504 registros con código SIGE y nombre) en la base de datos para consulta futura.

## Datos del archivo

- **Archivo:** SubSectores_6.xls
- **Columnas:** `CODIGO` (entero, único) y `NOMBRE` (texto)
- **Registros:** 9,504 asignaturas únicas

## Plan

### 1. Crear tabla `mineduc_subjects`

Nueva tabla con:
- `id` (uuid, PK)
- `sige_code` (integer, unique, not null) -- código SIGE
- `nombre` (text, not null) -- nombre de la asignatura
- `created_at` (timestamptz, default now())

RLS: lectura para todos los autenticados, escritura solo admin.

### 2. Insertar los 9,504 registros

Script que lee el Excel y ejecuta INSERT masivo en la tabla.

---

No se modificará código de la app en este paso. La tabla quedará disponible como referencia para futuras funcionalidades (por ejemplo, vincular asignaturas del colegio con códigos SIGE oficiales).
