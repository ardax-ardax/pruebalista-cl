// Bases Curriculares de Chile (Mineduc) — Objetivos de Aprendizaje (OA).
// Estructura indexada por `gradeValue` y `subjectValue` (alineada con `catalog.ts`).
//
// IMPORTANTE: las keys deben coincidir EXACTAMENTE con los `value` de `DEFAULT_GRADES`
// y `DEFAULT_SUBJECTS` en `src/lib/catalog.ts`.
//   - Cursos: "1ºBásico", "2ºBásico", ... (carácter `º` U+00BA, sin espacio).
//   - Asignaturas: "Lenguaje" (Lenguaje y Comunicación), "Matemática", "Ciencias" (Ciencias Naturales).

export interface OA {
  code: string;        // Código corto, p.ej. "OA 03"
  description: string; // Texto del objetivo (Mineduc)
  eje?: string;        // Eje temático (opcional)
}

// === Habilidades Transversales (fallback genérico para combinaciones sin OA cargados) ===
export const TRANSVERSAL_SKILLS: OA[] = [
  {
    code: "HT 01",
    eje: "Pensamiento crítico",
    description:
      "Analizar, interpretar y evaluar información proveniente de distintas fuentes para formarse una opinión fundamentada.",
  },
  {
    code: "HT 02",
    eje: "Comunicación",
    description:
      "Comunicar ideas, opiniones y resultados de manera clara y coherente, utilizando lenguaje oral, escrito y visual apropiado al contexto.",
  },
  {
    code: "HT 03",
    eje: "Resolución de problemas",
    description:
      "Identificar problemas, plantear estrategias de solución, evaluar alternativas y aplicar la más adecuada al contexto.",
  },
  {
    code: "HT 04",
    eje: "Trabajo colaborativo",
    description:
      "Trabajar en equipo de manera responsable, respetando las ideas de los demás y aportando al logro de objetivos comunes.",
  },
  {
    code: "HT 05",
    eje: "Uso de TIC",
    description:
      "Utilizar herramientas tecnológicas para buscar, organizar, producir y comunicar información de manera ética y eficiente.",
  },
  {
    code: "HT 06",
    eje: "Autorregulación",
    description:
      "Planificar, monitorear y evaluar el propio aprendizaje, asumiendo responsabilidad sobre los procesos y resultados.",
  },
];

// Record<gradeValue, Record<subjectValue, OA[]>>
export const CURRICULUM: Record<string, Record<string, OA[]>> = {
  // ============================ 1º BÁSICO ============================
  "1ºBásico": {
    Lenguaje: [
      { code: "OA 02", eje: "Lectura", description: "Leer en voz alta para adquirir fluidez: pronunciando cada palabra con precisión, respetando el punto seguido y el punto aparte, sin detenerse en cada palabra." },
      { code: "OA 03", eje: "Lectura", description: "Identificar los sonidos que componen las palabras (conciencia fonológica), reconociendo, separando y combinando sus fonemas y sílabas." },
      { code: "OA 04", eje: "Lectura", description: "Leer palabras aisladas y en contexto, aplicando su conocimiento de la correspondencia letra-sonido en distintas combinaciones." },
      { code: "OA 06", eje: "Lectura", description: "Comprender textos aplicando estrategias de comprensión lectora; por ejemplo: relacionar la información del texto con sus experiencias y conocimientos, releer lo que no fue comprendido, visualizar lo que describe el texto." },
      { code: "OA 13", eje: "Escritura", description: "Experimentar con la escritura para comunicar hechos, ideas y sentimientos, entre otros." },
      { code: "OA 17", eje: "Escritura", description: "Escribir, con la mediación del docente, para desarrollar la creatividad y expresar sus ideas, textos como poemas, cuentos, descripciones, entre otros." },
      { code: "OA 21", eje: "Comunicación oral", description: "Participar activamente en conversaciones grupales sobre textos leídos o escuchados en clases o sobre experiencias personales, manteniendo el foco de la conversación, expresando sus ideas u opiniones, formulando preguntas para aclarar dudas." },
    ],
    Matemática: [
      { code: "OA 01", eje: "Números y operaciones", description: "Contar números del 0 al 100 de 1 en 1, de 2 en 2, de 5 en 5 y de 10 en 10, hacia adelante y hacia atrás, empezando por cualquier número menor que 100." },
      { code: "OA 03", eje: "Números y operaciones", description: "Leer números del 0 al 20 y representarlos en forma concreta, pictórica y simbólica." },
      { code: "OA 06", eje: "Números y operaciones", description: "Componer y descomponer números del 0 a 20 de manera aditiva, en forma concreta, pictórica y simbólica." },
      { code: "OA 09", eje: "Números y operaciones", description: "Demostrar que comprenden la adición y la sustracción de números del 0 al 20, progresivamente, de 0 a 5, de 6 a 10, de 11 a 20, con dos sumandos." },
      { code: "OA 12", eje: "Patrones y álgebra", description: "Reconocer, describir, crear y continuar patrones repetitivos (sonidos, figuras, ritmos, etc.) y patrones numéricos hasta el 20, crecientes y decrecientes, usando material concreto, pictórico y simbólico." },
      { code: "OA 15", eje: "Geometría", description: "Identificar y comparar la longitud de objetos, usando palabras como largo y corto." },
      { code: "OA 17", eje: "Geometría", description: "Identificar en el entorno figuras 3D y figuras 2D y relacionarlas, usando material concreto." },
      { code: "OA 19", eje: "Datos y probabilidades", description: "Recolectar y registrar datos para responder preguntas estadísticas sobre sí mismo y el entorno, usando bloques, tablas de conteo y pictogramas." },
    ],
    Ciencias: [
      { code: "OA 01", eje: "Ciencias de la vida", description: "Reconocer y observar, por medio de la exploración, que los seres vivos crecen, responden a estímulos del medio, se reproducen y necesitan agua, alimento y aire para vivir." },
      { code: "OA 03", eje: "Ciencias de la vida", description: "Observar y comparar las características de las etapas del ciclo de vida de distintos animales (mamíferos, aves, insectos y anfibios), relacionándolas con su hábitat." },
      { code: "OA 06", eje: "Ciencias de la vida", description: "Identificar la ubicación y explicar la función de algunas partes del cuerpo que son fundamentales para vivir: corazón, pulmones, estómago, esqueleto y músculos." },
      { code: "OA 08", eje: "Ciencias físicas y químicas", description: "Identificar y describir la ubicación y el movimiento aparente del Sol durante el día, considerando puntos de referencia." },
      { code: "OA 10", eje: "Ciencias de la Tierra y el Universo", description: "Describir y registrar el ciclo diario y las diferencias entre el día y la noche, a partir de la observación del Sol, la Luna, las estrellas y la luminosidad del cielo, entre otras, y reconocer los efectos del ciclo en los seres vivos y el ambiente." },
      { code: "OA 12", eje: "Ciencias de la Tierra y el Universo", description: "Describir el tiempo atmosférico, identificando instrumentos y eventos que permiten medirlo y registrarlo." },
    ],
  },

  // ============================ 2º BÁSICO ============================
  "2ºBásico": {
    Lenguaje: [
      { code: "OA 02", eje: "Lectura", description: "Leer en voz alta para adquirir fluidez: pronunciando cada palabra con precisión, respetando el punto seguido y el punto aparte, sin detenerse en cada palabra." },
      { code: "OA 04", eje: "Lectura", description: "Leer independientemente y comprender textos no literarios (cartas, notas, instrucciones y artículos informativos) para entretenerse y ampliar su conocimiento del mundo." },
      { code: "OA 05", eje: "Lectura", description: "Comprender poemas adecuados al nivel e interpretar el lenguaje figurado presente en ellos." },
      { code: "OA 07", eje: "Lectura", description: "Comprender textos aplicando estrategias de comprensión lectora; por ejemplo: relacionar la información del texto con sus experiencias y conocimientos, visualizar lo que describe el texto, hacer preguntas mientras se lee." },
      { code: "OA 15", eje: "Escritura", description: "Escribir artículos informativos para comunicar información sobre un tema: presentando el tema en una oración, desarrollando una idea central por párrafo." },
      { code: "OA 18", eje: "Escritura", description: "Escribir, revisar y editar sus textos para satisfacer un propósito y transmitir sus ideas con claridad." },
      { code: "OA 23", eje: "Comunicación oral", description: "Comprender y disfrutar versiones completas de obras de la literatura, narradas o leídas por un adulto, como cuentos folclóricos, fábulas y leyendas." },
    ],
    Matemática: [
      { code: "OA 01", eje: "Números y operaciones", description: "Contar números del 0 al 1.000 de 2 en 2, de 5 en 5, de 10 en 10 y de 100 en 100, hacia adelante y hacia atrás, empezando por cualquier número menor que 1.000." },
      { code: "OA 03", eje: "Números y operaciones", description: "Representar y describir números del 0 al 100, de manera concreta, pictórica y simbólica, formando grupos de 10 y los que sobran, descomponiéndolos de manera aditiva." },
      { code: "OA 06", eje: "Números y operaciones", description: "Demostrar y explicar, de manera concreta, pictórica y simbólica, el efecto de sumar y restar 0 a un número." },
      { code: "OA 09", eje: "Números y operaciones", description: "Demostrar que comprenden la adición y la sustracción en el ámbito del 0 al 100." },
      { code: "OA 11", eje: "Números y operaciones", description: "Demostrar que comprende la multiplicación: usando representaciones concretas y pictóricas, expresando una multiplicación como una adición de sumandos iguales, usando la distributividad como estrategia para construir las tablas hasta el 10." },
      { code: "OA 14", eje: "Patrones y álgebra", description: "Demostrar, explicar y registrar la igualdad y la desigualdad en forma concreta y pictórica del 0 al 20, usando el símbolo igual (=) y los símbolos no igual (>, <)." },
      { code: "OA 16", eje: "Geometría", description: "Identificar en el entorno figuras 3D (cubo, paralelepípedo, esfera, cono, cilindro) y describirlas usando los términos cara, arista y vértice." },
      { code: "OA 22", eje: "Datos y probabilidades", description: "Recolectar y registrar datos para responder preguntas estadísticas sobre juegos con monedas y dados, usando bloques y tablas de conteo y pictogramas." },
    ],
    Ciencias: [
      { code: "OA 01", eje: "Ciencias de la vida", description: "Observar, describir y clasificar a los vertebrados en mamíferos, anfibios, peces, aves y reptiles, a partir de características como cubierta corporal, presencia de mamas y la forma de respirar o de reproducirse." },
      { code: "OA 02", eje: "Ciencias de la vida", description: "Observar y comparar adaptaciones de animales y plantas para sobrevivir en los ecosistemas en relación con su estructura y conducta; por ejemplo: cubierta corporal, camuflaje, hibernación, entre otros." },
      { code: "OA 04", eje: "Ciencias de la vida", description: "Identificar la ubicación y explicar la función de algunas partes del cuerpo que son fundamentales para vivir: corazón, pulmones, estómago, esqueleto y músculos." },
      { code: "OA 06", eje: "Ciencias de la vida", description: "Identificar la importancia de algunas medidas de cuidado e higiene diaria como: lavarse las manos, ducharse, lavarse los dientes, descansar y comer en horarios establecidos." },
      { code: "OA 08", eje: "Ciencias físicas y químicas", description: "Identificar y comparar el uso de diversos materiales en la construcción de objetos, considerando sus propiedades (transparencia, dureza, flexibilidad)." },
      { code: "OA 10", eje: "Ciencias de la Tierra y el Universo", description: "Describir las características de algunos de los recursos naturales (agua, suelo, luz solar, aire) y dar ejemplos de su uso en la vida diaria." },
    ],
  },

  // ============================ 3º BÁSICO ============================
  "3ºBásico": {
    Lenguaje: [
      { code: "OA 02", eje: "Lectura", description: "Leer en voz alta de manera fluida variados textos apropiados a su edad: pronunciando las palabras con precisión, respetando la prosodia indicada por todos los signos de puntuación, decodificando de manera automática la mayoría de las palabras del texto." },
      { code: "OA 04", eje: "Lectura", description: "Profundizar su comprensión de las narraciones leídas: extrayendo información explícita e implícita, reconstruyendo la secuencia de las acciones en la historia, describiendo a los personajes, describiendo el ambiente en que ocurre la acción." },
      { code: "OA 06", eje: "Lectura", description: "Leer independientemente y comprender textos no literarios (cartas, biografías, relatos históricos, instrucciones, libros y artículos informativos, noticias, etc.) para ampliar su conocimiento del mundo y formarse una opinión." },
      { code: "OA 14", eje: "Escritura", description: "Escribir creativamente narraciones (experiencias personales, relatos de hechos, cuentos, etc.) que tengan una estructura clara, utilicen conectores adecuados, incluyan descripciones y diálogo (si es pertinente)." },
      { code: "OA 17", eje: "Escritura", description: "Planificar la escritura: estableciendo propósito y destinatario, generando ideas a partir de conversaciones, investigaciones, lluvia de ideas u otra estrategia." },
      { code: "OA 18", eje: "Escritura", description: "Escribir, revisar y editar sus textos para satisfacer un propósito y transmitir sus ideas con claridad. Durante este proceso: desarrollan las ideas agregando información, emplean un vocabulario preciso y variado, y un registro adecuado." },
      { code: "OA 27", eje: "Comunicación oral", description: "Expresarse de manera coherente y articulada sobre temas de su interés: presentando información o narrando un evento relacionado con el tema; incorporando frases descriptivas que ilustren lo dicho; utilizando un vocabulario variado." },
    ],
    Matemática: [
      { code: "OA 01", eje: "Números y operaciones", description: "Contar números del 0 al 1.000 de 5 en 5, de 10 en 10, de 100 en 100, hacia adelante y hacia atrás, empezando por cualquier número menor que 1.000." },
      { code: "OA 03", eje: "Números y operaciones", description: "Comparar y ordenar números naturales hasta 1.000, utilizando la recta numérica o la tabla posicional de manera manual y/o por medio de software educativo." },
      { code: "OA 06", eje: "Números y operaciones", description: "Demostrar que comprenden la adición y la sustracción de números del 0 al 1.000: usando estrategias personales con y sin material concreto, creando y resolviendo problemas de adición y sustracción que involucren operaciones combinadas." },
      { code: "OA 08", eje: "Números y operaciones", description: "Demostrar que comprenden las tablas de multiplicar hasta el 10 de manera progresiva: usando representaciones concretas y pictóricas, expresando una multiplicación como una adición de sumandos iguales, resolviendo problemas que involucren las tablas aprendidas hasta el 10." },
      { code: "OA 11", eje: "Patrones y álgebra", description: "Identificar y describir patrones numéricos en tablas que involucren una operación, de manera manual y/o usando software educativo." },
      { code: "OA 16", eje: "Geometría", description: "Describir cubos, paralelepípedos, esferas, conos, cilindros y pirámides de acuerdo a la forma de sus caras y al número de aristas y vértices." },
      { code: "OA 19", eje: "Medición", description: "Demostrar que comprenden la medición del peso (g y kg): comparando y ordenando dos o más objetos a partir de su peso de manera informal, usando modelos para explicar la equivalencia." },
      { code: "OA 23", eje: "Datos y probabilidades", description: "Realizar encuestas, clasificar y organizar los datos obtenidos en tablas y visualizarlos en gráficos de barra." },
    ],
    Ciencias: [
      { code: "OA 01", eje: "Ciencias de la vida", description: "Observar y comparar las características y necesidades de los vertebrados, destacando su importancia para la vida en distintos ambientes." },
      { code: "OA 03", eje: "Ciencias de la vida", description: "Observar y comparar las adaptaciones de plantas y animales para sobrevivir en los ecosistemas en relación con su estructura y conducta." },
      { code: "OA 05", eje: "Ciencias de la vida", description: "Identificar y describir la ubicación y la función de los sentidos, proponiendo medidas para protegerlos y para prevenir situaciones de riesgo." },
      { code: "OA 07", eje: "Ciencias de la vida", description: "Reconocer y explicar que los seres vivos están formados por una o más células y que estas se organizan en tejidos y órganos." },
      { code: "OA 09", eje: "Ciencias físicas y químicas", description: "Distinguir entre materiales naturales y fabricados por el ser humano (papel, género, vidrios, plásticos, cartón, otros), comparando sus propiedades específicas." },
      { code: "OA 11", eje: "Ciencias físicas y químicas", description: "Describir los cambios que se producen en los materiales por la acción del calor, el agua y la fuerza, distinguiendo entre cambios reversibles e irreversibles." },
      { code: "OA 12", eje: "Ciencias de la Tierra y el Universo", description: "Describir las características de las capas de la Tierra (atmósfera, litósfera e hidrósfera) que posibilitan el desarrollo de la vida y proveen recursos para el ser humano." },
    ],
  },

  // ============================ 4º BÁSICO ============================
  "4ºBásico": {
    Lenguaje: [
      { code: "OA 03", eje: "Lectura", description: "Leer y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo y desarrollar su imaginación; por ejemplo: poemas, cuentos folclóricos y de autor, fábulas, leyendas, mitos, novelas, historietas, otros." },
      { code: "OA 05", eje: "Lectura", description: "Comprender poemas adecuados al nivel e interpretar el lenguaje figurado presente en ellos." },
      { code: "OA 06", eje: "Lectura", description: "Leer independientemente y comprender textos no literarios (cartas, biografías, relatos históricos, instrucciones, libros y artículos informativos, noticias, etc.) para ampliar su conocimiento del mundo y formarse una opinión." },
      { code: "OA 07", eje: "Lectura", description: "Desarrollar el gusto por la lectura, leyendo habitualmente diversos textos." },
      { code: "OA 14", eje: "Escritura", description: "Escribir creativamente narraciones (experiencias personales, relatos de hechos, cuentos, etc.) que tengan una estructura clara, utilicen conectores adecuados, incluyan descripciones y diálogo (si es pertinente) para desarrollar la trama, los personajes y el ambiente." },
      { code: "OA 17", eje: "Escritura", description: "Planificar la escritura: estableciendo propósito y destinatario, generando ideas a partir de conversaciones, investigaciones, lluvia de ideas u otra estrategia." },
      { code: "OA 22", eje: "Comunicación oral", description: "Comprender y disfrutar versiones completas de obras de la literatura, narradas o leídas por un adulto, como cuentos folclóricos y de autor, leyendas, mitos, capítulos de novelas." },
    ],
    Matemática: [
      { code: "OA 01", eje: "Números y operaciones", description: "Representar y describir números del 0 al 10.000: contándolos de 10 en 10, de 100 en 100, de 1.000 en 1.000; leyéndolos y escribiéndolos; representándolos en forma concreta, pictórica y simbólica; comparándolos y ordenándolos en la recta numérica o la tabla posicional." },
      { code: "OA 03", eje: "Números y operaciones", description: "Demostrar que comprenden la adición y la sustracción de números hasta 1.000: usando estrategias personales para realizar estas operaciones, descomponiendo los números involucrados, estimando sumas y diferencias." },
      { code: "OA 06", eje: "Números y operaciones", description: "Demostrar que comprenden la multiplicación de números de tres dígitos por números de un dígito: usando estrategias con o sin material concreto, utilizando las tablas de multiplicación, estimando productos, usando la propiedad distributiva, aplicando el algoritmo de la multiplicación, resolviendo problemas rutinarios." },
      { code: "OA 08", eje: "Números y operaciones", description: "Demostrar que comprenden la división con dividendos de dos dígitos y divisores de un dígito: usando estrategias para dividir, con o sin material concreto, utilizando la relación que existe entre la división y la multiplicación, estimando el cociente, aplicando la estrategia por descomposición del dividendo, aplicando el algoritmo de la división." },
      { code: "OA 11", eje: "Números y operaciones", description: "Describir y representar decimales (décimos y centésimos): representándolos en forma concreta, pictórica y simbólica, de manera manual y/o con software educativo." },
      { code: "OA 16", eje: "Geometría", description: "Identificar y dibujar puntos en el primer cuadrante del plano cartesiano, dadas sus coordenadas en números naturales." },
      { code: "OA 19", eje: "Medición", description: "Leer y registrar diversas mediciones del tiempo en relojes análogos y digitales, usando los conceptos A.M., P.M. y 24 horas." },
      { code: "OA 25", eje: "Datos y probabilidades", description: "Realizar encuestas, analizar los datos y comparar con los resultados de muestras aleatorias, usando tablas y gráficos." },
    ],
    Ciencias: [
      { code: "OA 01", eje: "Ciencias de la vida", description: "Reconocer y explicar que los seres vivos están formados por una o más células y que estas se organizan en tejidos y órganos." },
      { code: "OA 03", eje: "Ciencias de la vida", description: "Reconocer, por medio de la exploración, que un ecosistema está compuesto por elementos vivos (animales, plantas, etc.) y no vivos (piedras, agua, tierra), que interactúan entre sí." },
      { code: "OA 04", eje: "Ciencias de la vida", description: "Analizar el equilibrio entre los organismos productores, consumidores y descomponedores que componen las cadenas alimentarias de los ecosistemas de Chile." },
      { code: "OA 06", eje: "Ciencias de la vida", description: "Identificar y describir, por medio de modelos, las estructuras básicas del sistema esquelético y muscular y algunas de sus funciones, como apoyo, protección y movimiento." },
      { code: "OA 09", eje: "Ciencias físicas y químicas", description: "Investigar experimentalmente y explicar las características del sonido; por ejemplo: viaja en todas las direcciones, se refleja, etc." },
      { code: "OA 11", eje: "Ciencias físicas y químicas", description: "Describir el cambio físico de los materiales que se produce por la acción del calor o la fuerza, distinguiéndolo del cambio químico." },
      { code: "OA 13", eje: "Ciencias de la Tierra y el Universo", description: "Describir las características de los componentes del Sistema Solar y su relación con el Sol, distinguiéndolos por tamaño, posición y composición." },
    ],
  },

  // ============================ 5º BÁSICO ============================
  "5ºBásico": {
    Lenguaje: [
      { code: "OA 03", eje: "Lectura", description: "Leer y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo, desarrollar su imaginación y reconocer su valor social y cultural." },
      { code: "OA 05", eje: "Lectura", description: "Analizar aspectos relevantes de narraciones leídas para profundizar su comprensión: interpretando el lenguaje figurado, expresando opiniones fundamentadas en el texto, identificando personajes principales y secundarios, describiendo el ambiente y la época." },
      { code: "OA 06", eje: "Lectura", description: "Leer independientemente y comprender textos no literarios (cartas, biografías, relatos históricos, libros y artículos informativos, noticias, etc.) para ampliar su conocimiento del mundo y formarse una opinión." },
      { code: "OA 17", eje: "Escritura", description: "Escribir, revisar y editar sus textos para satisfacer un propósito y transmitir sus ideas con claridad, considerando su estructura, coherencia, ortografía y vocabulario." },
      { code: "OA 22", eje: "Comunicación oral", description: "Comprender y disfrutar versiones completas de obras de la literatura, narradas o leídas por un adulto, como cuentos folclóricos y de autor, leyendas, mitos y poemas." },
    ],
    Matemática: [
      { code: "OA 03", eje: "Números y operaciones", description: "Demostrar que comprenden la multiplicación de números naturales de tres dígitos por números de dos dígitos, usando estrategias con o sin material concreto, utilizando las tablas de multiplicación y aplicando el algoritmo de la multiplicación." },
      { code: "OA 05", eje: "Números y operaciones", description: "Realizar cálculos que involucren las cuatro operaciones, aplicando las reglas relativas a paréntesis y la prevalencia de la multiplicación y división por sobre la adición y sustracción cuando corresponda." },
      { code: "OA 08", eje: "Números y operaciones", description: "Demostrar que comprenden las fracciones propias: representándolas de manera concreta, pictórica y simbólica; comparando fracciones con igual y distinto denominador." },
      { code: "OA 16", eje: "Geometría", description: "Identificar y dibujar puntos en el primer cuadrante del plano cartesiano, dadas sus coordenadas en números naturales." },
      { code: "OA 22", eje: "Datos y probabilidades", description: "Calcular el promedio de datos e interpretarlo en su contexto." },
    ],
    Ciencias: [
      { code: "OA 01", eje: "Ciencias de la vida", description: "Reconocer y explicar que los seres vivos están formados por una o más células y que estas se organizan en tejidos y órganos." },
      { code: "OA 02", eje: "Ciencias de la vida", description: "Identificar y describir, por medio de modelos, las estructuras básicas del sistema digestivo (boca, esófago, estómago, hígado, intestino delgado, intestino grueso) y sus funciones en la digestión, la absorción de nutrientes y la eliminación de desechos." },
      { code: "OA 05", eje: "Ciencias de la vida", description: "Analizar el consumo de alimento diario (variedad, tamaño y frecuencia de porciones) recomendado para una vida saludable." },
      { code: "OA 07", eje: "Ciencias físicas y químicas", description: "Investigar y explicar efectos positivos y negativos de la actividad humana en los océanos, lagos, ríos, glaciares, entre otros, proponiendo acciones de protección de las reservas hídricas en Chile." },
      { code: "OA 09", eje: "Ciencias físicas y químicas", description: "Investigar en diversas fuentes y comunicar los aportes de científicos que han contribuido al conocimiento del universo." },
      { code: "OA 12", eje: "Ciencias de la Tierra y el Universo", description: "Describir las características de las capas de la Tierra (atmósfera, hidrósfera, litósfera) que posibilitan el desarrollo de la vida y proveen recursos para el ser humano." },
    ],
  },

  // ============================ 6º BÁSICO ============================
  "6ºBásico": {
    Lenguaje: [
      { code: "OA 03", eje: "Lectura", description: "Leer y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo, desarrollar su imaginación y reconocer su valor social y cultural." },
      { code: "OA 04", eje: "Lectura", description: "Analizar aspectos relevantes de narraciones leídas para profundizar su comprensión: interpretando el lenguaje figurado, analizando las acciones de los personajes, explicando las actitudes de los personajes, justificando sus opiniones haciendo referencia a lo leído." },
      { code: "OA 06", eje: "Lectura", description: "Leer independientemente y comprender textos no literarios para ampliar su conocimiento del mundo y formarse una opinión: extrayendo información explícita e implícita, haciendo inferencias, comparando información entre dos textos." },
      { code: "OA 15", eje: "Escritura", description: "Escribir artículos informativos para comunicar información sobre un tema: organizándolos en una estructura clara, desarrollando una idea central por párrafo, agregando las fuentes utilizadas." },
      { code: "OA 24", eje: "Comunicación oral", description: "Expresarse de manera clara y efectiva en exposiciones orales para comunicar temas de su interés, presentando información fundamentada y usando un vocabulario variado." },
    ],
    Matemática: [
      { code: "OA 03", eje: "Números y operaciones", description: "Demostrar que comprenden el concepto de razón de manera concreta, pictórica y simbólica, en forma manual y/o usando software educativo." },
      { code: "OA 05", eje: "Números y operaciones", description: "Demostrar que comprenden el concepto de porcentaje de manera pictórica y simbólica, de forma manual y/o usando software educativo: representando porcentajes en cuadrículas, calculando porcentajes en situaciones cotidianas." },
      { code: "OA 06", eje: "Números y operaciones", description: "Demostrar que comprenden la multiplicación y la división de decimales por números naturales de un dígito, múltiplos de 10 y decimales hasta la milésima de manera concreta, pictórica y simbólica." },
      { code: "OA 09", eje: "Patrones y álgebra", description: "Demostrar que comprenden la relación entre los valores de una tabla y aplicarla en la resolución de problemas sencillos: identificando patrones entre los valores de la tabla, formulando una regla con lenguaje matemático." },
      { code: "OA 18", eje: "Geometría", description: "Calcular áreas de triángulos, paralelogramos y trapecios, y estimar áreas de figuras irregulares aplicando estrategias." },
    ],
    Ciencias: [
      { code: "OA 01", eje: "Ciencias de la vida", description: "Explicar, a partir de una investigación experimental, los requerimientos de agua, dióxido de carbono y energía lumínica para la producción de azúcar y liberación de oxígeno en la fotosíntesis." },
      { code: "OA 03", eje: "Ciencias de la vida", description: "Explicar, por medio de modelos, la respiración (inspiración, espiración, intercambio de oxígeno y dióxido de carbono, rol del diafragma) identificando sus estructuras principales (vías respiratorias, pulmones, diafragma)." },
      { code: "OA 05", eje: "Ciencias de la vida", description: "Explicar, por medio de modelos, la función del sistema circulatorio en relación con la nutrición, eliminación de desechos y defensa frente a microorganismos." },
      { code: "OA 07", eje: "Ciencias de la vida", description: "Investigar en diversas fuentes y explicar los efectos nocivos del consumo excesivo de alcohol y de drogas, en los ámbitos físico, social y mental." },
      { code: "OA 09", eje: "Ciencias físicas y químicas", description: "Investigar experimentalmente y explicar las características de las fuerzas de roce y la función de las fuerzas de gravedad en la realidad cotidiana." },
      { code: "OA 12", eje: "Ciencias de la Tierra y el Universo", description: "Explicar, con el modelo de la tectónica de placas, los patrones de distribución de la actividad geológica (volcanes y sismos), los tipos de interacción entre las placas (convergente, divergente y transformante) y su importancia en el ciclo de la roca." },
    ],
  },
};

// ¿Existen OA oficiales cargados para esta combinación?
export const hasCurriculum = (gradeValue: string, subjectValue: string): boolean => {
  if (!gradeValue || !subjectValue) return false;
  const oas = CURRICULUM[gradeValue]?.[subjectValue];
  return Array.isArray(oas) && oas.length > 0;
};

// Devuelve los OA oficiales de la combinación; si no existen, retorna las
// Habilidades Transversales como fallback. Si falta curso o asignatura,
// retorna [] (la UI muestra "selecciona curso y asignatura").
export const getOAs = (gradeValue: string, subjectValue: string): OA[] => {
  if (!gradeValue || !subjectValue) return [];
  const official = CURRICULUM[gradeValue]?.[subjectValue];
  if (official && official.length > 0) return official;
  return TRANSVERSAL_SKILLS;
};

export const findOA = (gradeValue: string, subjectValue: string, code: string): OA | undefined =>
  getOAs(gradeValue, subjectValue).find((o) => o.code === code);
