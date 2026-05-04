
ALTER TABLE public.plan_allowed_courses
  ADD CONSTRAINT fk_plan_allowed_courses_course
  FOREIGN KEY (course_id) REFERENCES public.admin_courses(id) ON DELETE CASCADE;

ALTER TABLE public.admin_course_subjects
  ADD CONSTRAINT fk_admin_course_subjects_course
  FOREIGN KEY (course_id) REFERENCES public.admin_courses(id) ON DELETE CASCADE;
