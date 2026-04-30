## Diagnóstico

El mensaje "permission denied for function is_staff" aparece porque la función `public.is_staff(uuid)` se creó sin conceder permisos de ejecución a los roles `authenticated` y `anon`.

Verificación en la base de datos:

```text
has_role  → EXECUTE: postgres, service_role, sandbox_exec, authenticated, anon  ✅
is_staff  → EXECUTE: postgres, service_role, sandbox_exec                       ❌
```

Como las policies RLS de `profiles`, `assessments`, `curriculum_base` y `teacher_assignments` evalúan `is_staff(auth.uid())`, cualquier `SELECT` sobre esas tablas desde el cliente (incluyendo el del Admin) falla con ese error antes incluso de evaluar el resultado de la función. Por eso `listProfiles()` devuelve vacío y aparece el banner rojo en `StaffManager`.

No es un problema de rol del usuario ni de RLS lógicamente mal escrita: es un permiso a nivel de función.

## Cambios propuestos

### 1. Migración SQL (única y mínima)

Conceder `EXECUTE` sobre `is_staff` y, por seguridad, reafirmarlo también para `has_role` (idempotente).

```sql
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
```

Esto no toca esquemas reservados ni cambia la lógica de seguridad: las funciones siguen siendo `SECURITY DEFINER` y solo devuelven `true/false` según el contenido de `user_roles`.

### 2. Validación posterior

Después de aplicar la migración:
- Recargar `Configuración` con la sesión de Admin.
- Confirmar que el banner rojo desaparece.
- Confirmar que la lista "Roles de usuarios" se llena (al menos con el propio admin) y que el botón "Sincronizar perfiles desde Auth" trae el resto.
- Verificar de paso que `MisPruebas` (vista UTP/Admin) y la lectura de `curriculum_base` siguen funcionando con normalidad.

## Archivos que se modifican

- Nueva migración SQL en Supabase (gestionada por la herramienta de migraciones). No se modifica código de la app — el bug es 100% de permisos en la base.

¿Apruebas aplicar este `GRANT EXECUTE`?
