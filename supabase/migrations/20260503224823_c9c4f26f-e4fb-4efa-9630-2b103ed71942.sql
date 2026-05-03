
-- Función de validación: docentes con plan free no pueden tener más de 5 asignaciones
CREATE OR REPLACE FUNCTION public.validate_teacher_assignment_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
  user_plan text;
BEGIN
  SELECT plan_type INTO user_plan
  FROM public.user_usage
  WHERE user_id = NEW.teacher_user_id;

  IF user_plan IS DISTINCT FROM 'free' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO current_count
  FROM public.teacher_assignments
  WHERE teacher_user_id = NEW.teacher_user_id;

  IF current_count >= 5 THEN
    RAISE EXCEPTION 'Plan free permite máximo 5 asignaciones de curso/asignatura';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger antes de insertar
CREATE TRIGGER check_teacher_assignment_limit
BEFORE INSERT ON public.teacher_assignments
FOR EACH ROW
EXECUTE FUNCTION public.validate_teacher_assignment_limit();

-- RLS: docentes pueden insertar sus propias asignaciones
CREATE POLICY "Teachers can insert own assignments"
ON public.teacher_assignments
FOR INSERT
TO authenticated
WITH CHECK (teacher_user_id = auth.uid());

-- RLS: docentes pueden borrar sus propias asignaciones
CREATE POLICY "Teachers can delete own assignments"
ON public.teacher_assignments
FOR DELETE
TO authenticated
USING (teacher_user_id = auth.uid());
