// Bases Curriculares de Chile (Mineduc) — muestra inicial de Objetivos de Aprendizaje (OA).
// Estructura indexada por `gradeValue` y `subjectValue` (alineada con `catalog.ts`).
// Esta data es ampliable: agregar más cursos/asignaturas/OAs aquí.

export interface OA {
  code: string;        // Código corto, p.ej. "OA 03"
  description: string; // Texto del objetivo (Mineduc)
  eje?: string;        // Eje temático (opcional)
}

// Record<gradeValue, Record<subjectValue, OA[]>>
export const CURRICULUM: Record<string, Record<string, OA[]>> = {
  "5ºBásico": {
    Lenguaje: [
      {
        code: "OA 03",
        eje: "Lectura",
        description:
          "Leer y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo, desarrollar su imaginación y reconocer su valor social y cultural.",
      },
      {
        code: "OA 05",
        eje: "Lectura",
        description:
          "Analizar aspectos relevantes de narraciones leídas para profundizar su comprensión: interpretando el lenguaje figurado, expresando opiniones fundamentadas en el texto, identificando personajes principales y secundarios, describiendo el ambiente y la época.",
      },
      {
        code: "OA 06",
        eje: "Lectura",
        description:
          "Leer independientemente y comprender textos no literarios (cartas, biografías, relatos históricos, libros y artículos informativos, noticias, etc.) para ampliar su conocimiento del mundo y formarse una opinión.",
      },
      {
        code: "OA 17",
        eje: "Escritura",
        description:
          "Escribir, revisar y editar sus textos para satisfacer un propósito y transmitir sus ideas con claridad, considerando su estructura, coherencia, ortografía y vocabulario.",
      },
      {
        code: "OA 22",
        eje: "Comunicación oral",
        description:
          "Comprender y disfrutar versiones completas de obras de la literatura, narradas o leídas por un adulto, como cuentos folclóricos y de autor, leyendas, mitos y poemas.",
      },
    ],
    Matemática: [
      {
        code: "OA 03",
        eje: "Números y operaciones",
        description:
          "Demostrar que comprenden la multiplicación de números naturales de tres dígitos por números de dos dígitos, usando estrategias con o sin material concreto, utilizando las tablas de multiplicación y aplicando el algoritmo de la multiplicación.",
      },
      {
        code: "OA 05",
        eje: "Números y operaciones",
        description:
          "Realizar cálculos que involucren las cuatro operaciones, aplicando las reglas relativas a paréntesis y la prevalencia de la multiplicación y división por sobre la adición y sustracción cuando corresponda.",
      },
      {
        code: "OA 08",
        eje: "Números y operaciones",
        description:
          "Demostrar que comprenden las fracciones propias: representándolas de manera concreta, pictórica y simbólica; comparando fracciones con igual y distinto denominador.",
      },
      {
        code: "OA 16",
        eje: "Geometría",
        description:
          "Identificar y dibujar puntos en el primer cuadrante del plano cartesiano, dadas sus coordenadas en números naturales.",
      },
      {
        code: "OA 22",
        eje: "Datos y probabilidades",
        description:
          "Calcular el promedio de datos e interpretarlo en su contexto.",
      },
    ],
  },
  "6ºBásico": {
    Lenguaje: [
      {
        code: "OA 03",
        eje: "Lectura",
        description:
          "Leer y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo, desarrollar su imaginación y reconocer su valor social y cultural.",
      },
      {
        code: "OA 04",
        eje: "Lectura",
        description:
          "Analizar aspectos relevantes de narraciones leídas para profundizar su comprensión: interpretando el lenguaje figurado, analizando las acciones de los personajes, explicando las actitudes de los personajes, justificando sus opiniones haciendo referencia a lo leído.",
      },
      {
        code: "OA 06",
        eje: "Lectura",
        description:
          "Leer independientemente y comprender textos no literarios para ampliar su conocimiento del mundo y formarse una opinión: extrayendo información explícita e implícita, haciendo inferencias, comparando información entre dos textos.",
      },
      {
        code: "OA 15",
        eje: "Escritura",
        description:
          "Escribir artículos informativos para comunicar información sobre un tema: organizándolos en una estructura clara, desarrollando una idea central por párrafo, agregando las fuentes utilizadas.",
      },
      {
        code: "OA 24",
        eje: "Comunicación oral",
        description:
          "Expresarse de manera clara y efectiva en exposiciones orales para comunicar temas de su interés, presentando información fundamentada y usando un vocabulario variado.",
      },
    ],
    Matemática: [
      {
        code: "OA 03",
        eje: "Números y operaciones",
        description:
          "Demostrar que comprenden el concepto de razón de manera concreta, pictórica y simbólica, en forma manual y/o usando software educativo.",
      },
      {
        code: "OA 05",
        eje: "Números y operaciones",
        description:
          "Demostrar que comprenden el concepto de porcentaje de manera pictórica y simbólica, de forma manual y/o usando software educativo: representando porcentajes en cuadrículas, calculando porcentajes en situaciones cotidianas.",
      },
      {
        code: "OA 06",
        eje: "Números y operaciones",
        description:
          "Demostrar que comprenden la multiplicación y la división de decimales por números naturales de un dígito, múltiplos de 10 y decimales hasta la milésima de manera concreta, pictórica y simbólica.",
      },
      {
        code: "OA 09",
        eje: "Patrones y álgebra",
        description:
          "Demostrar que comprenden la relación entre los valores de una tabla y aplicarla en la resolución de problemas sencillos: identificando patrones entre los valores de la tabla, formulando una regla con lenguaje matemático.",
      },
      {
        code: "OA 18",
        eje: "Geometría",
        description:
          "Calcular áreas de triángulos, paralelogramos y trapecios, y estimar áreas de figuras irregulares aplicando estrategias.",
      },
    ],
  },
};

export const getOAs = (gradeValue: string, subjectValue: string): OA[] => {
  return CURRICULUM[gradeValue]?.[subjectValue] ?? [];
};

export const findOA = (gradeValue: string, subjectValue: string, code: string): OA | undefined =>
  getOAs(gradeValue, subjectValue).find((o) => o.code === code);
