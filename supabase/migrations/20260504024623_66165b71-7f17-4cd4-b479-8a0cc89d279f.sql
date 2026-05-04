
CREATE TABLE public.admin_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_value text NOT NULL UNIQUE,
  subject_label text NOT NULL,
  levels text[] NOT NULL DEFAULT '{Básica,Media}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can insert admin_subjects" ON public.admin_subjects FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update admin_subjects" ON public.admin_subjects FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete admin_subjects" ON public.admin_subjects FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read admin_subjects" ON public.admin_subjects FOR SELECT TO authenticated USING (true);

-- Seed con asignaturas actuales
INSERT INTO public.admin_subjects (subject_value, subject_label, levels, sort_order) VALUES
  ('Lenguaje', 'Lenguaje y Comunicación', '{Básica}', 1),
  ('Lengua', 'Lengua y Literatura', '{Media}', 2),
  ('TDHLengua', 'Taller de Habilidades Lingüísticas', '{Básica}', 3),
  ('Matemática', 'Matemática', '{Básica,Media}', 4),
  ('TDHMatemática', 'Taller de Habilidades Matemática', '{Básica}', 5),
  ('Ciencias', 'Ciencias Naturales', '{Básica}', 6),
  ('Biología', 'Biología', '{Media}', 7),
  ('Física', 'Física', '{Media}', 8),
  ('Química', 'Química', '{Media}', 9),
  ('Historia', 'Historia, Geografía y Ciencias Sociales', '{Básica,Media}', 10),
  ('Filosofía', 'Filosofía', '{Media}', 11),
  ('CienciasCiudadanía', 'Ciencias para la Ciudadanía', '{Media}', 12),
  ('EdCiudadana', 'Educación Ciudadana', '{Media}', 13),
  ('MundoGlobal', 'Mundo Global', '{Media}', 14),
  ('ChileLatam', 'Chile y la Región Latinoamericana', '{Media}', 15),
  ('Inglés', 'Inglés', '{Básica,Media}', 16),
  ('Tecnología', 'Tecnología', '{Básica,Media}', 17),
  ('Música', 'Música', '{Básica,Media}', 18),
  ('Artes', 'Artes Visuales', '{Básica,Media}', 19),
  ('ArtesElectivo', 'Artes (Electivo)', '{ElectivoMedia}', 20),
  ('EdFísica', 'Educación Física y Salud', '{Básica,Media}', 21),
  ('Orientación', 'Orientación', '{Básica,Media}', 22),
  ('Religión', 'Religión', '{Básica,Media}', 23),
  ('DesarrolloPersonal', 'Desarrollo Personal', '{Media}', 24),
  ('Probabilidades', 'Probabilidades y Estadística', '{ElectivoMedia}', 25),
  ('Teatro', 'Interpretación y Creación en Teatro', '{ElectivoMedia}', 26),
  ('ComprensiónHistórica', 'Comprensión Histórica del Presente', '{ElectivoMedia}', 27),
  ('BiologíaCelular', 'Biología Celular y Molecular', '{ElectivoMedia}', 28),
  ('InterpretaciónMusical', 'Interpretación Musical', '{ElectivoMedia}', 29),
  ('Economía', 'Economía y Sociedad', '{ElectivoMedia}', 30),
  ('CienciasSalud', 'Ciencias de la Salud', '{ElectivoMedia}', 31),
  ('ParticipaciónDemocracia', 'Participación y Argumentación en Democracia', '{ElectivoMedia}', 32),
  ('Programación', 'Pensamiento Computacional y Programación', '{ElectivoMedia}', 33),
  ('BiologíaEcosistemas', 'Biología de los Ecosistemas', '{ElectivoMedia}', 34),
  ('EstilosVidaSaludable', 'Promoción de Estilos de Vida Activos y Saludables', '{ElectivoMedia}', 35),
  ('DiseñoArquitectura', 'Diseño y Arquitectura', '{ElectivoMedia}', 36),
  ('LecturaEscritura', 'Lectura y Escritura Especializada', '{ElectivoMedia}', 37),
  ('LímitesDerivadas', 'Límites, Derivadas e Integrales', '{ElectivoMedia}', 38),
  ('GeografíaTerritorio', 'Geografía, Territorio y Desafíos Socioambientales', '{ElectivoMedia}', 39),
  ('Estética', 'Estética', '{ElectivoMedia}', 40),
  ('FilosofíaPolítica', 'Filosofía Política', '{ElectivoMedia}', 41),
  ('SeminarioFilosofía', 'Seminario de Filosofía', '{ElectivoMedia}', 42),
  ('ArtesVisualesAudiovisuales', 'Artes Visuales, Audiovisuales y Multimediales', '{ElectivoMedia}', 43);
