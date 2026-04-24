# Arreglar detección de admin (error 403 en `has_role`)

## Diagnóstico

Los logs de red muestran que la consulta a `user_roles` desde el cliente devuelve **403** con el mensaje:

```
permission denied for function has_role
```

Esto ocurre porque la política RLS de `user_roles` ("Users can view their own roles") usa `has_role(auth.uid(), 'admin')` en su `USING`, pero el rol `authenticated` de PostgREST no tiene `EXECUTE` sobre esa función. Cuando PostgREST evalúa la política, la llamada a la función falla y se rechaza la consulta — incluso aunque el usuario solo quiera ver sus propios roles.

Resultado: el frontend nunca confirma que el usuario es admin → `isAdmin` queda en `false` → no aparece "Configuración" en el menú.

El usuario `admin@cnlc.cl` SÍ tiene el rol admin asignado (el trigger `handle_new_user` lo asignó al registrarse), el problema es solo de permisos para leerlo.

## Cambios

### Migración SQL
1. `GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;`
2. Simplificar la política SELECT de `user_roles` para que un usuario pueda ver sus propios roles **sin** depender de `has_role` (evita el problema y es más simple):
   ```sql
   DROP POLICY "Users can view their own roles" ON public.user_roles;
   CREATE POLICY "Users can view their own roles"
     ON public.user_roles FOR SELECT TO authenticated
     USING (user_id = auth.uid());
   ```
   La política "Admins can manage roles" sigue cubriendo el caso admin.

### Verificación posterior
Tras aplicar la migración, recargar la app con la sesión de `admin@cnlc.cl` y comprobar que:
- La consulta a `user_roles` devuelve `200` con `[{"role":"admin"}]`.
- Aparece el badge "Admin" en el menú de usuario y el enlace "Configuración" en el header.

## Archivos

- Nueva migración SQL (sin cambios en código frontend; `useAuth` ya consulta correctamente).
