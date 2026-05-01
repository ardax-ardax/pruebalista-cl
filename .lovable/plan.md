
# Plan: Personalización para usuarios individuales

## Resumen
Implementar 5 mejoras para que los docentes que se registran individualmente (sin institución) tengan control sobre su experiencia: márgenes, tamaño de página, nombre de institución, logo y una página de perfil.

---

## 1. Migración de base de datos

**Tabla `profiles`**: agregar columnas:
- `custom_institution_name` (text, nullable) — nombre personalizado del colegio/institución
- `custom_logo_url` (text, nullable) — URL del logo subido

**Storage bucket `user-logos`**: bucket público para que cada usuario suba su logo en la carpeta `{user_id}/`.

RLS de storage: cada usuario sube/edita/borra solo en su carpeta; lectura pública.

---

## 2. Selector de tamaño de página

**`assessment-schema.ts`**: Agregar tipo `PageSizeKey` con 4 opciones (Folio, Carta, A4, Oficio) y campo `pageSizeKey` opcional en `AssessmentLayout`.

**`PreviewLayoutToolbar.tsx`**: Agregar un dropdown de tamaño de página sobre los sliders de margen. Funciona igual que los sliders — editable si `canEdit` es true.

**`assessment-pdf.ts`**: Si `layout.pageSizeKey` está definido, usar esas dimensiones en vez de las del template.

**`assessment-docx.ts`**: Misma lógica — priorizar `pageSizeKey` del layout sobre el template.

---

## 3. Desbloquear márgenes para usuarios individuales

**`CrearPrueba.tsx`** línea 506: Cambiar `canEdit={isStaff}` a:
```
canEdit={isStaff || effectivePlan !== "institucional"}
```
Esto permite que usuarios free/pro editen márgenes y tamaño de página libremente. Los docentes institucionales siguen bloqueados (solo la UTP controla sus márgenes).

---

## 4. Página de perfil (`/perfil`)

Nueva página accesible para **todos** los usuarios autenticados con:
- Campo de texto: "Nombre de tu institución" (se guarda en `profiles.custom_institution_name`)
- Subida de logo (se guarda en el bucket `user-logos`, URL en `profiles.custom_logo_url`)
- Vista previa del logo actual
- Botón guardar

**`App.tsx`**: Agregar ruta `/perfil` (sin AdminGuard).
**`AppLayout.tsx`**: Agregar enlace "Perfil" en el menú del avatar para todos los usuarios.

---

## 5. Usar branding personalizado en el builder

**`CrearPrueba.tsx`**: Al cargar, si el usuario NO es staff:
1. Leer `profiles.custom_institution_name` y `profiles.custom_logo_url`
2. Si existen, usarlos como `institutionName` y `logo` en el `RenderContext`
3. Si no existen, usar los valores institucionales por defecto (como ahora)

Esto hace que el encabezado de la prueba muestre el nombre y logo del usuario individual, en vez de "New Little College La Florida".

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `supabase/migrations/...sql` | Columnas en profiles + bucket storage |
| `src/lib/assessment-schema.ts` | PageSizeKey, campo pageSizeKey en layout |
| `src/components/test-builder/PreviewLayoutToolbar.tsx` | Dropdown de tamaño de página |
| `src/pages/CrearPrueba.tsx` | canEdit desbloqueo + branding personalizado |
| `src/lib/assessment-pdf.ts` | Respetar pageSizeKey override |
| `src/lib/assessment-docx.ts` | Respetar pageSizeKey override |
| `src/lib/profiles.ts` | Agregar getProfile, updateProfile con nuevos campos |
| `src/pages/Perfil.tsx` | Nueva página de perfil |
| `src/App.tsx` | Nueva ruta /perfil |
| `src/components/AppLayout.tsx` | Enlace a perfil en menú avatar |
