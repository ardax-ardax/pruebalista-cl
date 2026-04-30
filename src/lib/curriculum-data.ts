// Bases Curriculares de Chile (Mineduc) — Objetivos de Aprendizaje (OA)
// e Indicadores de Evaluación. Estructura indexada por `gradeValue` y `subjectValue`
// (alineada con `catalog.ts`).
//
// Las keys deben coincidir EXACTAMENTE con los `value` de `DEFAULT_GRADES`
// y `DEFAULT_SUBJECTS` en `src/lib/catalog.ts`.
//   - Cursos: "1ºBásico", "2ºBásico", ... (carácter `º` U+00BA, sin espacio).
//   - Asignaturas: "Lenguaje" (Lenguaje y Comunicación), "Matemática", "Ciencias" (Ciencias Naturales).

import { listOverrides, naturalSortByCode, type OverrideOA } from "./curriculum-overrides";

export interface Indicator {
  code: string;        // Código corto, p.ej. "1.1"
  description: string; // Texto del indicador (Mineduc / Programa de Estudio)
}

export interface OA {
  code: string;        // Código corto, p.ej. "OA 03"
  description: string; // Texto del objetivo (Mineduc)
  eje?: string;        // Eje temático (opcional)
  indicators: Indicator[]; // Indicadores de evaluación asociados
}

// Helper local para escribir indicadores compactos: ind("1.1", "texto")
const ind = (code: string, description: string): Indicator => ({ code, description });

// === Habilidades Transversales (fallback genérico) ===
export const TRANSVERSAL_SKILLS: OA[] = [
  {
    code: "HT 01",
    eje: "Pensamiento crítico",
    description: "Analizar, interpretar y evaluar información proveniente de distintas fuentes para formarse una opinión fundamentada.",
    indicators: [
      ind("1.1", "Compara información de al menos dos fuentes."),
      ind("1.2", "Distingue hechos de opiniones."),
      ind("1.3", "Fundamenta su postura con evidencia del texto o fuente."),
    ],
  },
  {
    code: "HT 02",
    eje: "Comunicación",
    description: "Comunicar ideas, opiniones y resultados de manera clara y coherente, utilizando lenguaje oral, escrito y visual apropiado al contexto.",
    indicators: [
      ind("2.1", "Organiza su mensaje con introducción, desarrollo y cierre."),
      ind("2.2", "Usa vocabulario preciso al contexto."),
      ind("2.3", "Apoya la comunicación con recursos visuales o ejemplos."),
    ],
  },
  {
    code: "HT 03",
    eje: "Resolución de problemas",
    description: "Identificar problemas, plantear estrategias de solución, evaluar alternativas y aplicar la más adecuada al contexto.",
    indicators: [
      ind("3.1", "Define el problema con sus propias palabras."),
      ind("3.2", "Propone al menos dos estrategias de resolución."),
      ind("3.3", "Verifica el resultado obtenido."),
    ],
  },
  {
    code: "HT 04",
    eje: "Trabajo colaborativo",
    description: "Trabajar en equipo de manera responsable, respetando las ideas de los demás y aportando al logro de objetivos comunes.",
    indicators: [
      ind("4.1", "Cumple con el rol asignado en el equipo."),
      ind("4.2", "Escucha y valora las ideas de sus compañeros."),
      ind("4.3", "Aporta al producto colectivo dentro del plazo."),
    ],
  },
  {
    code: "HT 05",
    eje: "Uso de TIC",
    description: "Utilizar herramientas tecnológicas para buscar, organizar, producir y comunicar información de manera ética y eficiente.",
    indicators: [
      ind("5.1", "Selecciona la herramienta adecuada para la tarea."),
      ind("5.2", "Cita las fuentes utilizadas."),
      ind("5.3", "Respeta normas de uso responsable y seguro."),
    ],
  },
  {
    code: "HT 06",
    eje: "Autorregulación",
    description: "Planificar, monitorear y evaluar el propio aprendizaje, asumiendo responsabilidad sobre los procesos y resultados.",
    indicators: [
      ind("6.1", "Establece metas concretas para la tarea."),
      ind("6.2", "Monitorea sus avances y ajusta estrategias."),
      ind("6.3", "Reflexiona sobre los resultados obtenidos."),
    ],
  },
];

// Indicadores genéricos por eje (fallback cuando un OA no trae indicadores propios).
const GENERIC_INDICATORS_BY_AREA: Record<string, Indicator[]> = {
  Lenguaje: [
    ind("g.1", "Identifica la información explícita relevante del texto."),
    ind("g.2", "Realiza inferencias o interpretaciones a partir del texto."),
    ind("g.3", "Comunica sus ideas usando vocabulario adecuado al nivel."),
  ],
  Matemática: [
    ind("g.1", "Aplica el procedimiento o algoritmo correspondiente."),
    ind("g.2", "Resuelve problemas en contextos cotidianos relacionados al OA."),
    ind("g.3", "Explica el resultado obtenido y su procedimiento."),
  ],
  Ciencias: [
    ind("g.1", "Observa, registra y describe el fenómeno indicado."),
    ind("g.2", "Explica la relación entre las variables o componentes involucrados."),
    ind("g.3", "Aplica el conocimiento a situaciones cotidianas."),
  ],
};

// Indicadores específicos por (grade, subject, oaCode). Se complementan con los genéricos
// del eje cuando un OA no aparece en este mapa.
const SPECIFIC_INDICATORS: Record<string, Record<string, Record<string, Indicator[]>>> = {
  "1ºBásico": {
    Lenguaje: {
      "OA 02": [ind("1.1", "Lee respetando el punto seguido y aparte."), ind("1.2", "Pronuncia cada palabra con precisión."), ind("1.3", "Lee con fluidez sin detenerse en cada palabra.")],
      "OA 03": [ind("3.1", "Reconoce los fonemas que componen una palabra."), ind("3.2", "Separa palabras en sílabas."), ind("3.3", "Combina fonemas y sílabas para formar palabras.")],
      "OA 04": [ind("4.1", "Asocia letras con sus sonidos."), ind("4.2", "Lee palabras aisladas correctamente."), ind("4.3", "Lee palabras dentro de oraciones simples.")],
      "OA 06": [ind("6.1", "Relaciona el texto con experiencias propias."), ind("6.2", "Relee fragmentos no comprendidos."), ind("6.3", "Visualiza personajes y escenarios descritos.")],
      "OA 13": [ind("13.1", "Escribe oraciones simples sobre hechos o ideas."), ind("13.2", "Comunica sentimientos en sus textos."), ind("13.3", "Usa la escritura con un propósito comunicativo.")],
      "OA 17": [ind("17.1", "Crea textos breves de carácter narrativo o poético."), ind("17.2", "Usa imágenes o palabras para expresar ideas."), ind("17.3", "Mantiene una idea central en su escritura.")],
      "OA 21": [ind("21.1", "Mantiene el foco de la conversación."), ind("21.2", "Expresa opiniones sobre lo escuchado."), ind("21.3", "Formula preguntas para aclarar dudas.")],
    },
    Matemática: {
      "OA 01": [ind("1.1", "Cuenta de 1 en 1 hasta 100."), ind("1.2", "Cuenta hacia adelante y atrás de 2 en 2 y 5 en 5."), ind("1.3", "Cuenta de 10 en 10 desde un número dado.")],
      "OA 03": [ind("3.1", "Lee números del 0 al 20."), ind("3.2", "Representa números con material concreto."), ind("3.3", "Escribe el símbolo correspondiente al número.")],
      "OA 06": [ind("6.1", "Compone números hasta 20 sumando."), ind("6.2", "Descompone un número en partes."), ind("6.3", "Representa la composición pictóricamente.")],
      "OA 09": [ind("9.1", "Suma dos números menores a 20."), ind("9.2", "Resta dos números menores a 20."), ind("9.3", "Resuelve problemas de suma o resta en contexto.")],
      "OA 12": [ind("12.1", "Reconoce un patrón repetitivo."), ind("12.2", "Continúa un patrón dado."), ind("12.3", "Crea patrones simples.")],
      "OA 15": [ind("15.1", "Compara longitudes usando 'largo/corto'."), ind("15.2", "Ordena objetos por longitud."), ind("15.3", "Identifica el más largo o más corto de un grupo.")],
      "OA 17": [ind("17.1", "Identifica figuras 2D en el entorno."), ind("17.2", "Identifica figuras 3D en el entorno."), ind("17.3", "Relaciona figuras 2D con caras de figuras 3D.")],
      "OA 19": [ind("19.1", "Recolecta datos sobre sí mismo o el entorno."), ind("19.2", "Registra datos en tablas de conteo."), ind("19.3", "Construye un pictograma simple.")],
    },
    Ciencias: {
      "OA 01": [ind("1.1", "Reconoce que los seres vivos crecen."), ind("1.2", "Identifica que necesitan agua, alimento y aire."), ind("1.3", "Reconoce que responden a estímulos del medio.")],
      "OA 03": [ind("3.1", "Describe etapas del ciclo de vida de un animal."), ind("3.2", "Compara ciclos de vida de distintos grupos."), ind("3.3", "Relaciona el ciclo con el hábitat del animal.")],
      "OA 06": [ind("6.1", "Ubica órganos básicos en su cuerpo."), ind("6.2", "Explica la función del corazón y pulmones."), ind("6.3", "Explica la función del estómago, esqueleto y músculos.")],
      "OA 08": [ind("8.1", "Describe el movimiento aparente del Sol."), ind("8.2", "Identifica puntos de referencia."), ind("8.3", "Reconoce momentos del día según la posición del Sol.")],
      "OA 10": [ind("10.1", "Diferencia día y noche."), ind("10.2", "Describe el ciclo diario."), ind("10.3", "Reconoce efectos del ciclo en seres vivos.")],
      "OA 12": [ind("12.1", "Describe el tiempo atmosférico del día."), ind("12.2", "Identifica instrumentos para medirlo."), ind("12.3", "Registra el tiempo durante varios días.")],
    },
  },
  "2ºBásico": {
    Lenguaje: {
      "OA 04": [ind("4.1", "Lee de forma autónoma textos no literarios."), ind("4.2", "Identifica el propósito del texto."), ind("4.3", "Extrae información explícita.")],
      "OA 05": [ind("5.1", "Identifica el tema del poema."), ind("5.2", "Interpreta una imagen o comparación."), ind("5.3", "Reconoce sensaciones evocadas por el poema.")],
      "OA 07": [ind("7.1", "Relaciona el texto con conocimientos previos."), ind("7.2", "Visualiza lo que describe el texto."), ind("7.3", "Formula preguntas durante la lectura.")],
      "OA 15": [ind("15.1", "Presenta el tema en una oración inicial."), ind("15.2", "Desarrolla una idea por párrafo."), ind("15.3", "Cierra el texto retomando el tema.")],
      "OA 18": [ind("18.1", "Revisa y corrige sus propios textos."), ind("18.2", "Mejora la claridad de sus ideas."), ind("18.3", "Aplica reglas básicas de ortografía.")],
      "OA 23": [ind("23.1", "Escucha versiones completas de obras."), ind("23.2", "Comenta hechos relevantes de la historia."), ind("23.3", "Reconoce elementos del género (cuento, fábula, leyenda).")],
    },
    Matemática: {
      "OA 01": [ind("1.1", "Cuenta hasta 1.000 en distintos saltos."), ind("1.2", "Cuenta hacia adelante y atrás."), ind("1.3", "Identifica el siguiente término en una secuencia.")],
      "OA 03": [ind("3.1", "Forma grupos de 10 y unidades sueltas."), ind("3.2", "Descompone aditivamente un número."), ind("3.3", "Representa números pictóricamente.")],
      "OA 06": [ind("6.1", "Reconoce que sumar 0 no cambia el número."), ind("6.2", "Reconoce que restar 0 no cambia el número."), ind("6.3", "Justifica su respuesta con material concreto.")],
      "OA 09": [ind("9.1", "Suma con o sin reserva hasta 100."), ind("9.2", "Resta con o sin canje hasta 100."), ind("9.3", "Resuelve problemas aditivos en contexto.")],
      "OA 11": [ind("11.1", "Expresa una multiplicación como suma reiterada."), ind("11.2", "Construye tablas hasta el 10."), ind("11.3", "Aplica la multiplicación a problemas simples.")],
      "OA 14": [ind("14.1", "Usa el símbolo = correctamente."), ind("14.2", "Usa los símbolos > y <."), ind("14.3", "Justifica una igualdad o desigualdad.")],
      "OA 16": [ind("16.1", "Identifica figuras 3D en el entorno."), ind("16.2", "Describe caras, aristas y vértices."), ind("16.3", "Compara dos figuras 3D.")],
      "OA 22": [ind("22.1", "Recolecta datos en juegos con monedas/dados."), ind("22.2", "Registra datos en tablas."), ind("22.3", "Representa los datos en un pictograma.")],
    },
    Ciencias: {
      "OA 01": [ind("1.1", "Clasifica vertebrados según cubierta corporal."), ind("1.2", "Distingue forma de respiración o reproducción."), ind("1.3", "Agrupa animales en mamíferos, aves, peces, anfibios y reptiles.")],
      "OA 02": [ind("2.1", "Describe una adaptación estructural."), ind("2.2", "Describe una adaptación conductual."), ind("2.3", "Relaciona la adaptación con el ecosistema.")],
      "OA 04": [ind("4.1", "Ubica órganos básicos en su cuerpo."), ind("4.2", "Explica la función de cada órgano."), ind("4.3", "Relaciona los órganos con la salud.")],
      "OA 06": [ind("6.1", "Identifica medidas de higiene diaria."), ind("6.2", "Explica por qué son importantes."), ind("6.3", "Aplica las medidas en su rutina.")],
      "OA 08": [ind("8.1", "Compara propiedades de materiales."), ind("8.2", "Relaciona propiedad y uso."), ind("8.3", "Selecciona material adecuado para una tarea.")],
      "OA 10": [ind("10.1", "Reconoce recursos naturales (agua, suelo, aire, luz)."), ind("10.2", "Describe usos cotidianos."), ind("10.3", "Reconoce su importancia para la vida.")],
    },
  },
  "3ºBásico": {
    Lenguaje: {
      "OA 02": [ind("2.1", "Lee respetando todos los signos de puntuación."), ind("2.2", "Decodifica de manera automática la mayoría de las palabras."), ind("2.3", "Lee con prosodia adecuada al texto.")],
      "OA 04": [ind("4.1", "Extrae información explícita e implícita."), ind("4.2", "Reconstruye la secuencia de la historia."), ind("4.3", "Describe personajes y ambiente.")],
      "OA 06": [ind("6.1", "Identifica el propósito del texto no literario."), ind("6.2", "Extrae ideas principales."), ind("6.3", "Forma una opinión fundamentada.")],
      "OA 14": [ind("14.1", "Escribe narraciones con estructura clara."), ind("14.2", "Usa conectores apropiados."), ind("14.3", "Incluye descripciones o diálogos.")],
      "OA 17": [ind("17.1", "Define propósito y destinatario."), ind("17.2", "Genera ideas por lluvia o investigación."), ind("17.3", "Organiza las ideas antes de escribir.")],
      "OA 18": [ind("18.1", "Agrega información para enriquecer ideas."), ind("18.2", "Usa vocabulario variado."), ind("18.3", "Aplica un registro adecuado al destinatario.")],
      "OA 27": [ind("27.1", "Presenta información de forma articulada."), ind("27.2", "Usa frases descriptivas."), ind("27.3", "Emplea vocabulario variado.")],
    },
    Matemática: {
      "OA 01": [ind("1.1", "Cuenta hasta 1.000 en saltos de 5, 10 y 100."), ind("1.2", "Cuenta hacia atrás desde un número dado."), ind("1.3", "Identifica el patrón en una secuencia.")],
      "OA 03": [ind("3.1", "Compara dos números hasta 1.000."), ind("3.2", "Ordena números en la recta numérica."), ind("3.3", "Usa la tabla posicional.")],
      "OA 06": [ind("6.1", "Suma y resta hasta 1.000 con estrategias propias."), ind("6.2", "Resuelve problemas de operaciones combinadas."), ind("6.3", "Estima resultados antes de calcular.")],
      "OA 08": [ind("8.1", "Recita las tablas hasta el 10."), ind("8.2", "Representa multiplicaciones pictóricamente."), ind("8.3", "Resuelve problemas con tablas conocidas.")],
      "OA 11": [ind("11.1", "Identifica patrones en tablas."), ind("11.2", "Describe la regla del patrón."), ind("11.3", "Completa una tabla siguiendo el patrón.")],
      "OA 16": [ind("16.1", "Describe cubos y paralelepípedos."), ind("16.2", "Cuenta caras, aristas y vértices."), ind("16.3", "Compara distintas figuras 3D.")],
      "OA 19": [ind("19.1", "Compara pesos de objetos informalmente."), ind("19.2", "Usa unidades g y kg."), ind("19.3", "Establece equivalencias simples.")],
      "OA 23": [ind("23.1", "Realiza una encuesta simple."), ind("23.2", "Organiza los datos en una tabla."), ind("23.3", "Construye un gráfico de barras.")],
    },
    Ciencias: {
      "OA 01": [ind("1.1", "Compara características de vertebrados."), ind("1.2", "Reconoce sus necesidades vitales."), ind("1.3", "Asocia vertebrados con su ambiente.")],
      "OA 03": [ind("3.1", "Identifica adaptaciones estructurales."), ind("3.2", "Identifica adaptaciones conductuales."), ind("3.3", "Relaciona adaptación con supervivencia.")],
      "OA 05": [ind("5.1", "Ubica los órganos de los sentidos."), ind("5.2", "Describe la función de cada sentido."), ind("5.3", "Propone medidas para protegerlos.")],
      "OA 07": [ind("7.1", "Reconoce a la célula como unidad básica."), ind("7.2", "Identifica tejidos y órganos."), ind("7.3", "Da ejemplos de organización celular.")],
      "OA 09": [ind("9.1", "Distingue materiales naturales y fabricados."), ind("9.2", "Compara propiedades de materiales."), ind("9.3", "Da ejemplos de uso cotidiano.")],
      "OA 11": [ind("11.1", "Distingue cambio reversible e irreversible."), ind("11.2", "Identifica el agente del cambio (calor, agua, fuerza)."), ind("11.3", "Describe el cambio observado.")],
      "OA 12": [ind("12.1", "Nombra las capas de la Tierra."), ind("12.2", "Describe características de cada capa."), ind("12.3", "Relaciona las capas con la vida y los recursos.")],
    },
  },
  "4ºBásico": {
    Lenguaje: {
      "OA 03": [ind("3.1", "Lee distintos géneros literarios."), ind("3.2", "Reconoce características del género."), ind("3.3", "Comenta el texto leído.")],
      "OA 05": [ind("5.1", "Identifica el tema y emoción del poema."), ind("5.2", "Interpreta lenguaje figurado simple."), ind("5.3", "Reconoce recursos sonoros.")],
      "OA 06": [ind("6.1", "Comprende textos no literarios."), ind("6.2", "Extrae información clave."), ind("6.3", "Relaciona el texto con el mundo real.")],
      "OA 07": [ind("7.1", "Lee con frecuencia distintos textos."), ind("7.2", "Comparte sus lecturas."), ind("7.3", "Selecciona lecturas según interés.")],
      "OA 14": [ind("14.1", "Construye narraciones con inicio, desarrollo y final."), ind("14.2", "Usa diálogos y descripciones."), ind("14.3", "Mantiene la coherencia de la trama.")],
      "OA 17": [ind("17.1", "Define propósito y destinatario."), ind("17.2", "Investiga sobre el tema."), ind("17.3", "Organiza ideas previas a escribir.")],
      "OA 22": [ind("22.1", "Escucha obras completas."), ind("22.2", "Recuerda hechos centrales."), ind("22.3", "Comenta personajes y desenlace.")],
    },
    Matemática: {
      "OA 01": [ind("1.1", "Lee y escribe números hasta 10.000."), ind("1.2", "Compara y ordena números."), ind("1.3", "Representa números en la tabla posicional.")],
      "OA 03": [ind("3.1", "Suma y resta hasta 1.000 con descomposición."), ind("3.2", "Estima sumas y diferencias."), ind("3.3", "Resuelve problemas aditivos.")],
      "OA 06": [ind("6.1", "Multiplica números de 3 dígitos por 1 dígito."), ind("6.2", "Aplica la propiedad distributiva."), ind("6.3", "Resuelve problemas multiplicativos.")],
      "OA 08": [ind("8.1", "Divide dividendos de 2 dígitos por divisores de 1 dígito."), ind("8.2", "Estima el cociente."), ind("8.3", "Aplica relación entre división y multiplicación.")],
      "OA 11": [ind("11.1", "Representa décimos y centésimos."), ind("11.2", "Lee y escribe decimales."), ind("11.3", "Ubica decimales en la recta.")],
      "OA 16": [ind("16.1", "Identifica coordenadas dadas."), ind("16.2", "Dibuja puntos en el plano cartesiano."), ind("16.3", "Comunica coordenadas correctamente.")],
      "OA 19": [ind("19.1", "Lee la hora en relojes análogos."), ind("19.2", "Lee la hora en relojes digitales."), ind("19.3", "Usa A.M., P.M. y formato 24 horas.")],
      "OA 25": [ind("25.1", "Realiza encuestas simples."), ind("25.2", "Organiza datos en tablas y gráficos."), ind("25.3", "Compara resultados de muestras.")],
    },
    Ciencias: {
      "OA 01": [ind("1.1", "Reconoce a la célula como unidad básica."), ind("1.2", "Identifica tejidos y órganos."), ind("1.3", "Da ejemplos de organización celular.")],
      "OA 03": [ind("3.1", "Distingue elementos vivos y no vivos."), ind("3.2", "Reconoce interacciones entre componentes."), ind("3.3", "Da ejemplos de un ecosistema local.")],
      "OA 04": [ind("4.1", "Identifica productores, consumidores y descomponedores."), ind("4.2", "Construye una cadena alimentaria."), ind("4.3", "Explica el equilibrio del ecosistema.")],
      "OA 06": [ind("6.1", "Identifica huesos principales."), ind("6.2", "Identifica músculos principales."), ind("6.3", "Explica funciones de apoyo, protección y movimiento.")],
      "OA 09": [ind("9.1", "Reconoce que el sonido viaja en todas direcciones."), ind("9.2", "Identifica reflexión del sonido."), ind("9.3", "Explica cómo se produce un sonido.")],
      "OA 11": [ind("11.1", "Distingue cambio físico y químico."), ind("11.2", "Identifica el agente del cambio."), ind("11.3", "Da ejemplos cotidianos.")],
      "OA 13": [ind("13.1", "Describe componentes del Sistema Solar."), ind("13.2", "Compara tamaños y posiciones."), ind("13.3", "Relaciona los planetas con el Sol.")],
    },
  },
  "5ºBásico": {
    Lenguaje: {
      "OA 03": [ind("3.1", "Lee variedad de géneros literarios."), ind("3.2", "Reconoce el valor cultural de la obra."), ind("3.3", "Justifica preferencias lectoras.")],
      "OA 05": [ind("5.1", "Interpreta lenguaje figurado."), ind("5.2", "Identifica personajes principales y secundarios."), ind("5.3", "Describe ambiente y época.")],
      "OA 06": [ind("6.1", "Comprende textos no literarios variados."), ind("6.2", "Distingue hecho y opinión."), ind("6.3", "Forma una opinión fundamentada.")],
      "OA 17": [ind("17.1", "Revisa estructura y coherencia."), ind("17.2", "Aplica reglas de ortografía."), ind("17.3", "Mejora vocabulario y precisión.")],
      "OA 22": [ind("22.1", "Escucha obras completas."), ind("22.2", "Comenta hechos relevantes."), ind("22.3", "Reconoce características del género.")],
    },
    Matemática: {
      "OA 03": [ind("3.1", "Multiplica números de 3 dígitos por 2 dígitos."), ind("3.2", "Aplica el algoritmo correctamente."), ind("3.3", "Resuelve problemas multiplicativos.")],
      "OA 05": [ind("5.1", "Aplica jerarquía de operaciones."), ind("5.2", "Usa paréntesis adecuadamente."), ind("5.3", "Resuelve combinaciones de operaciones.")],
      "OA 08": [ind("8.1", "Representa fracciones propias."), ind("8.2", "Compara fracciones de igual denominador."), ind("8.3", "Compara fracciones de distinto denominador.")],
      "OA 16": [ind("16.1", "Identifica coordenadas en el plano."), ind("16.2", "Dibuja puntos dados."), ind("16.3", "Comunica coordenadas con precisión.")],
      "OA 22": [ind("22.1", "Calcula el promedio de un conjunto de datos."), ind("22.2", "Interpreta el promedio en contexto."), ind("22.3", "Compara promedios entre dos grupos.")],
    },
    Ciencias: {
      "OA 01": [ind("1.1", "Reconoce a la célula como unidad de los seres vivos."), ind("1.2", "Identifica tejidos y órganos."), ind("1.3", "Explica la organización jerárquica.")],
      "OA 02": [ind("2.1", "Identifica órganos del sistema digestivo."), ind("2.2", "Describe sus funciones."), ind("2.3", "Explica la digestión y absorción.")],
      "OA 05": [ind("5.1", "Analiza variedad de alimentos."), ind("5.2", "Evalúa frecuencia y porciones."), ind("5.3", "Propone una dieta saludable.")],
      "OA 07": [ind("7.1", "Identifica efectos positivos de la actividad humana."), ind("7.2", "Identifica efectos negativos."), ind("7.3", "Propone acciones de protección hídrica.")],
      "OA 09": [ind("9.1", "Investiga aportes de un científico."), ind("9.2", "Comunica los hallazgos."), ind("9.3", "Cita fuentes utilizadas.")],
      "OA 12": [ind("12.1", "Nombra las capas de la Tierra."), ind("12.2", "Describe características."), ind("12.3", "Explica su importancia para la vida.")],
    },
  },
  "6ºBásico": {
    Lenguaje: {
      "OA 03": [ind("3.1", "Lee diversos géneros literarios."), ind("3.2", "Comenta el valor social y cultural."), ind("3.3", "Justifica sus preferencias.")],
      "OA 04": [ind("4.1", "Interpreta el lenguaje figurado."), ind("4.2", "Analiza acciones de los personajes."), ind("4.3", "Justifica opiniones con citas del texto.")],
      "OA 06": [ind("6.1", "Extrae información explícita e implícita."), ind("6.2", "Realiza inferencias."), ind("6.3", "Compara información entre dos textos.")],
      "OA 15": [ind("15.1", "Organiza el texto con estructura clara."), ind("15.2", "Desarrolla una idea por párrafo."), ind("15.3", "Cita las fuentes utilizadas.")],
      "OA 24": [ind("24.1", "Presenta información fundamentada."), ind("24.2", "Usa vocabulario variado."), ind("24.3", "Mantiene contacto visual y volumen apropiado.")],
    },
    Matemática: {
      "OA 03": [ind("3.1", "Comprende el concepto de razón."), ind("3.2", "Representa razones de manera pictórica."), ind("3.3", "Resuelve problemas con razones.")],
      "OA 05": [ind("5.1", "Representa porcentajes en cuadrículas."), ind("5.2", "Calcula porcentajes simples."), ind("5.3", "Aplica porcentajes a contextos cotidianos.")],
      "OA 06": [ind("6.1", "Multiplica decimales por números naturales."), ind("6.2", "Divide decimales hasta la milésima."), ind("6.3", "Resuelve problemas con decimales.")],
      "OA 09": [ind("9.1", "Identifica patrones en tablas."), ind("9.2", "Formula la regla con lenguaje matemático."), ind("9.3", "Resuelve problemas usando la regla.")],
      "OA 18": [ind("18.1", "Calcula áreas de triángulos."), ind("18.2", "Calcula áreas de paralelogramos y trapecios."), ind("18.3", "Estima áreas de figuras irregulares.")],
    },
    Ciencias: {
      "OA 01": [ind("1.1", "Reconoce los requerimientos de la fotosíntesis."), ind("1.2", "Identifica productos de la fotosíntesis."), ind("1.3", "Diseña una experiencia para evidenciarla.")],
      "OA 03": [ind("3.1", "Describe inspiración y espiración."), ind("3.2", "Identifica vías respiratorias y diafragma."), ind("3.3", "Explica el intercambio gaseoso.")],
      "OA 05": [ind("5.1", "Describe el rol del corazón y vasos sanguíneos."), ind("5.2", "Relaciona circulación con nutrición."), ind("5.3", "Explica el rol en la defensa del organismo.")],
      "OA 07": [ind("7.1", "Identifica efectos físicos del consumo."), ind("7.2", "Identifica efectos sociales y mentales."), ind("7.3", "Propone medidas de prevención.")],
      "OA 09": [ind("9.1", "Diseña una experiencia con fuerzas de roce."), ind("9.2", "Describe la función de la gravedad."), ind("9.3", "Aplica el concepto a situaciones cotidianas.")],
      "OA 12": [ind("12.1", "Explica la tectónica de placas."), ind("12.2", "Distingue tipos de interacción entre placas."), ind("12.3", "Relaciona placas con volcanes y sismos.")],
    },
  },
};

// === OAs base (sin indicadores embebidos; los indicadores se inyectan al consultar) ===
type BaseOA = Omit<OA, "indicators">;

const BASE_CURRICULUM: Record<string, Record<string, BaseOA[]>> = {
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
      { code: "OA 12", eje: "Patrones y álgebra", description: "Reconocer, describir, crear y continuar patrones repetitivos y patrones numéricos hasta el 20, crecientes y decrecientes." },
      { code: "OA 15", eje: "Geometría", description: "Identificar y comparar la longitud de objetos, usando palabras como largo y corto." },
      { code: "OA 17", eje: "Geometría", description: "Identificar en el entorno figuras 3D y figuras 2D y relacionarlas, usando material concreto." },
      { code: "OA 19", eje: "Datos y probabilidades", description: "Recolectar y registrar datos para responder preguntas estadísticas sobre sí mismo y el entorno, usando bloques, tablas de conteo y pictogramas." },
    ],
    Ciencias: [
      { code: "OA 01", eje: "Ciencias de la vida", description: "Reconocer y observar, por medio de la exploración, que los seres vivos crecen, responden a estímulos del medio, se reproducen y necesitan agua, alimento y aire para vivir." },
      { code: "OA 03", eje: "Ciencias de la vida", description: "Observar y comparar las características de las etapas del ciclo de vida de distintos animales (mamíferos, aves, insectos y anfibios), relacionándolas con su hábitat." },
      { code: "OA 06", eje: "Ciencias de la vida", description: "Identificar la ubicación y explicar la función de algunas partes del cuerpo que son fundamentales para vivir: corazón, pulmones, estómago, esqueleto y músculos." },
      { code: "OA 08", eje: "Ciencias físicas y químicas", description: "Identificar y describir la ubicación y el movimiento aparente del Sol durante el día, considerando puntos de referencia." },
      { code: "OA 10", eje: "Ciencias de la Tierra y el Universo", description: "Describir y registrar el ciclo diario y las diferencias entre el día y la noche." },
      { code: "OA 12", eje: "Ciencias de la Tierra y el Universo", description: "Describir el tiempo atmosférico, identificando instrumentos y eventos que permiten medirlo y registrarlo." },
    ],
  },
  "2ºBásico": {
    Lenguaje: [
      { code: "OA 04", eje: "Lectura", description: "Leer independientemente y comprender textos no literarios (cartas, notas, instrucciones y artículos informativos) para entretenerse y ampliar su conocimiento del mundo." },
      { code: "OA 05", eje: "Lectura", description: "Comprender poemas adecuados al nivel e interpretar el lenguaje figurado presente en ellos." },
      { code: "OA 07", eje: "Lectura", description: "Comprender textos aplicando estrategias de comprensión lectora; por ejemplo: relacionar la información con experiencias, visualizar, hacer preguntas." },
      { code: "OA 15", eje: "Escritura", description: "Escribir artículos informativos para comunicar información sobre un tema: presentando el tema en una oración, desarrollando una idea central por párrafo." },
      { code: "OA 18", eje: "Escritura", description: "Escribir, revisar y editar sus textos para satisfacer un propósito y transmitir sus ideas con claridad." },
      { code: "OA 23", eje: "Comunicación oral", description: "Comprender y disfrutar versiones completas de obras de la literatura, narradas o leídas por un adulto." },
    ],
    Matemática: [
      { code: "OA 01", eje: "Números y operaciones", description: "Contar números del 0 al 1.000 de 2 en 2, de 5 en 5, de 10 en 10 y de 100 en 100, hacia adelante y hacia atrás." },
      { code: "OA 03", eje: "Números y operaciones", description: "Representar y describir números del 0 al 100, de manera concreta, pictórica y simbólica, formando grupos de 10 y los que sobran." },
      { code: "OA 06", eje: "Números y operaciones", description: "Demostrar y explicar, de manera concreta, pictórica y simbólica, el efecto de sumar y restar 0 a un número." },
      { code: "OA 09", eje: "Números y operaciones", description: "Demostrar que comprenden la adición y la sustracción en el ámbito del 0 al 100." },
      { code: "OA 11", eje: "Números y operaciones", description: "Demostrar que comprende la multiplicación: usando representaciones concretas y pictóricas, expresando una multiplicación como una adición de sumandos iguales." },
      { code: "OA 14", eje: "Patrones y álgebra", description: "Demostrar, explicar y registrar la igualdad y la desigualdad en forma concreta y pictórica del 0 al 20, usando los símbolos =, > y <." },
      { code: "OA 16", eje: "Geometría", description: "Identificar en el entorno figuras 3D (cubo, paralelepípedo, esfera, cono, cilindro) y describirlas usando los términos cara, arista y vértice." },
      { code: "OA 22", eje: "Datos y probabilidades", description: "Recolectar y registrar datos para responder preguntas estadísticas sobre juegos con monedas y dados, usando bloques, tablas de conteo y pictogramas." },
    ],
    Ciencias: [
      { code: "OA 01", eje: "Ciencias de la vida", description: "Observar, describir y clasificar a los vertebrados en mamíferos, anfibios, peces, aves y reptiles." },
      { code: "OA 02", eje: "Ciencias de la vida", description: "Observar y comparar adaptaciones de animales y plantas para sobrevivir en los ecosistemas." },
      { code: "OA 04", eje: "Ciencias de la vida", description: "Identificar la ubicación y explicar la función de algunas partes del cuerpo que son fundamentales para vivir." },
      { code: "OA 06", eje: "Ciencias de la vida", description: "Identificar la importancia de algunas medidas de cuidado e higiene diaria." },
      { code: "OA 08", eje: "Ciencias físicas y químicas", description: "Identificar y comparar el uso de diversos materiales en la construcción de objetos, considerando sus propiedades." },
      { code: "OA 10", eje: "Ciencias de la Tierra y el Universo", description: "Describir las características de algunos de los recursos naturales (agua, suelo, luz solar, aire) y dar ejemplos de su uso." },
    ],
  },
  "3ºBásico": {
    Lenguaje: [
      { code: "OA 02", eje: "Lectura", description: "Leer en voz alta de manera fluida variados textos apropiados a su edad: pronunciando con precisión, respetando la prosodia indicada por todos los signos de puntuación." },
      { code: "OA 04", eje: "Lectura", description: "Profundizar su comprensión de las narraciones leídas: extrayendo información explícita e implícita, reconstruyendo la secuencia de las acciones, describiendo personajes y ambiente." },
      { code: "OA 06", eje: "Lectura", description: "Leer independientemente y comprender textos no literarios para ampliar su conocimiento del mundo y formarse una opinión." },
      { code: "OA 14", eje: "Escritura", description: "Escribir creativamente narraciones que tengan una estructura clara, utilicen conectores adecuados, incluyan descripciones y diálogo." },
      { code: "OA 17", eje: "Escritura", description: "Planificar la escritura: estableciendo propósito y destinatario, generando ideas a partir de conversaciones e investigaciones." },
      { code: "OA 18", eje: "Escritura", description: "Escribir, revisar y editar sus textos para satisfacer un propósito y transmitir sus ideas con claridad." },
      { code: "OA 27", eje: "Comunicación oral", description: "Expresarse de manera coherente y articulada sobre temas de su interés." },
    ],
    Matemática: [
      { code: "OA 01", eje: "Números y operaciones", description: "Contar números del 0 al 1.000 de 5 en 5, de 10 en 10, de 100 en 100, hacia adelante y hacia atrás." },
      { code: "OA 03", eje: "Números y operaciones", description: "Comparar y ordenar números naturales hasta 1.000, utilizando la recta numérica o la tabla posicional." },
      { code: "OA 06", eje: "Números y operaciones", description: "Demostrar que comprenden la adición y la sustracción de números del 0 al 1.000." },
      { code: "OA 08", eje: "Números y operaciones", description: "Demostrar que comprenden las tablas de multiplicar hasta el 10 de manera progresiva." },
      { code: "OA 11", eje: "Patrones y álgebra", description: "Identificar y describir patrones numéricos en tablas que involucren una operación." },
      { code: "OA 16", eje: "Geometría", description: "Describir cubos, paralelepípedos, esferas, conos, cilindros y pirámides de acuerdo a la forma de sus caras y al número de aristas y vértices." },
      { code: "OA 19", eje: "Medición", description: "Demostrar que comprenden la medición del peso (g y kg)." },
      { code: "OA 23", eje: "Datos y probabilidades", description: "Realizar encuestas, clasificar y organizar los datos obtenidos en tablas y visualizarlos en gráficos de barra." },
    ],
    Ciencias: [
      { code: "OA 01", eje: "Ciencias de la vida", description: "Observar y comparar las características y necesidades de los vertebrados, destacando su importancia para la vida en distintos ambientes." },
      { code: "OA 03", eje: "Ciencias de la vida", description: "Observar y comparar las adaptaciones de plantas y animales para sobrevivir en los ecosistemas." },
      { code: "OA 05", eje: "Ciencias de la vida", description: "Identificar y describir la ubicación y la función de los sentidos." },
      { code: "OA 07", eje: "Ciencias de la vida", description: "Reconocer y explicar que los seres vivos están formados por una o más células y que estas se organizan en tejidos y órganos." },
      { code: "OA 09", eje: "Ciencias físicas y químicas", description: "Distinguir entre materiales naturales y fabricados por el ser humano, comparando sus propiedades específicas." },
      { code: "OA 11", eje: "Ciencias físicas y químicas", description: "Describir los cambios que se producen en los materiales por la acción del calor, el agua y la fuerza, distinguiendo entre cambios reversibles e irreversibles." },
      { code: "OA 12", eje: "Ciencias de la Tierra y el Universo", description: "Describir las características de las capas de la Tierra (atmósfera, litósfera e hidrósfera)." },
    ],
  },
  "4ºBásico": {
    Lenguaje: [
      { code: "OA 03", eje: "Lectura", description: "Leer y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo y desarrollar su imaginación." },
      { code: "OA 05", eje: "Lectura", description: "Comprender poemas adecuados al nivel e interpretar el lenguaje figurado presente en ellos." },
      { code: "OA 06", eje: "Lectura", description: "Leer independientemente y comprender textos no literarios para ampliar su conocimiento del mundo y formarse una opinión." },
      { code: "OA 07", eje: "Lectura", description: "Desarrollar el gusto por la lectura, leyendo habitualmente diversos textos." },
      { code: "OA 14", eje: "Escritura", description: "Escribir creativamente narraciones que tengan una estructura clara, utilicen conectores adecuados, incluyan descripciones y diálogo." },
      { code: "OA 17", eje: "Escritura", description: "Planificar la escritura estableciendo propósito y destinatario." },
      { code: "OA 22", eje: "Comunicación oral", description: "Comprender y disfrutar versiones completas de obras de la literatura narradas o leídas por un adulto." },
    ],
    Matemática: [
      { code: "OA 01", eje: "Números y operaciones", description: "Representar y describir números del 0 al 10.000." },
      { code: "OA 03", eje: "Números y operaciones", description: "Demostrar que comprenden la adición y la sustracción de números hasta 1.000." },
      { code: "OA 06", eje: "Números y operaciones", description: "Demostrar que comprenden la multiplicación de números de tres dígitos por números de un dígito." },
      { code: "OA 08", eje: "Números y operaciones", description: "Demostrar que comprenden la división con dividendos de dos dígitos y divisores de un dígito." },
      { code: "OA 11", eje: "Números y operaciones", description: "Describir y representar decimales (décimos y centésimos)." },
      { code: "OA 16", eje: "Geometría", description: "Identificar y dibujar puntos en el primer cuadrante del plano cartesiano." },
      { code: "OA 19", eje: "Medición", description: "Leer y registrar diversas mediciones del tiempo en relojes análogos y digitales, usando los conceptos A.M., P.M. y 24 horas." },
      { code: "OA 25", eje: "Datos y probabilidades", description: "Realizar encuestas, analizar los datos y comparar con los resultados de muestras aleatorias." },
    ],
    Ciencias: [
      { code: "OA 01", eje: "Ciencias de la vida", description: "Reconocer y explicar que los seres vivos están formados por una o más células y que estas se organizan en tejidos y órganos." },
      { code: "OA 03", eje: "Ciencias de la vida", description: "Reconocer, por medio de la exploración, que un ecosistema está compuesto por elementos vivos y no vivos que interactúan entre sí." },
      { code: "OA 04", eje: "Ciencias de la vida", description: "Analizar el equilibrio entre los organismos productores, consumidores y descomponedores que componen las cadenas alimentarias de los ecosistemas de Chile." },
      { code: "OA 06", eje: "Ciencias de la vida", description: "Identificar y describir, por medio de modelos, las estructuras básicas del sistema esquelético y muscular y algunas de sus funciones." },
      { code: "OA 09", eje: "Ciencias físicas y químicas", description: "Investigar experimentalmente y explicar las características del sonido." },
      { code: "OA 11", eje: "Ciencias físicas y químicas", description: "Describir el cambio físico de los materiales que se produce por la acción del calor o la fuerza, distinguiéndolo del cambio químico." },
      { code: "OA 13", eje: "Ciencias de la Tierra y el Universo", description: "Describir las características de los componentes del Sistema Solar y su relación con el Sol." },
    ],
  },
  "5ºBásico": {
    Lenguaje: [
      { code: "OA 03", eje: "Lectura", description: "Leer y familiarizarse con un amplio repertorio de literatura para aumentar su conocimiento del mundo, desarrollar su imaginación y reconocer su valor social y cultural." },
      { code: "OA 05", eje: "Lectura", description: "Analizar aspectos relevantes de narraciones leídas para profundizar su comprensión." },
      { code: "OA 06", eje: "Lectura", description: "Leer independientemente y comprender textos no literarios para ampliar su conocimiento del mundo y formarse una opinión." },
      { code: "OA 17", eje: "Escritura", description: "Escribir, revisar y editar sus textos para satisfacer un propósito y transmitir sus ideas con claridad." },
      { code: "OA 22", eje: "Comunicación oral", description: "Comprender y disfrutar versiones completas de obras de la literatura, narradas o leídas por un adulto." },
    ],
    Matemática: [
      { code: "OA 03", eje: "Números y operaciones", description: "Demostrar que comprenden la multiplicación de números naturales de tres dígitos por números de dos dígitos." },
      { code: "OA 05", eje: "Números y operaciones", description: "Realizar cálculos que involucren las cuatro operaciones, aplicando las reglas relativas a paréntesis y la prevalencia de la multiplicación y división por sobre la adición y sustracción." },
      { code: "OA 08", eje: "Números y operaciones", description: "Demostrar que comprenden las fracciones propias." },
      { code: "OA 16", eje: "Geometría", description: "Identificar y dibujar puntos en el primer cuadrante del plano cartesiano." },
      { code: "OA 22", eje: "Datos y probabilidades", description: "Calcular el promedio de datos e interpretarlo en su contexto." },
    ],
    Ciencias: [
      { code: "OA 01", eje: "Ciencias de la vida", description: "Reconocer y explicar que los seres vivos están formados por una o más células y que estas se organizan en tejidos y órganos." },
      { code: "OA 02", eje: "Ciencias de la vida", description: "Identificar y describir, por medio de modelos, las estructuras básicas del sistema digestivo y sus funciones." },
      { code: "OA 05", eje: "Ciencias de la vida", description: "Analizar el consumo de alimento diario recomendado para una vida saludable." },
      { code: "OA 07", eje: "Ciencias físicas y químicas", description: "Investigar y explicar efectos positivos y negativos de la actividad humana en los océanos, lagos, ríos, glaciares, entre otros." },
      { code: "OA 09", eje: "Ciencias físicas y químicas", description: "Investigar en diversas fuentes y comunicar los aportes de científicos que han contribuido al conocimiento del universo." },
      { code: "OA 12", eje: "Ciencias de la Tierra y el Universo", description: "Describir las características de las capas de la Tierra (atmósfera, hidrósfera, litósfera)." },
    ],
  },
  "6ºBásico": {
    Lenguaje: [
      { code: "OA 03", eje: "Lectura", description: "Leer y familiarizarse con un amplio repertorio de literatura." },
      { code: "OA 04", eje: "Lectura", description: "Analizar aspectos relevantes de narraciones leídas para profundizar su comprensión." },
      { code: "OA 06", eje: "Lectura", description: "Leer independientemente y comprender textos no literarios para ampliar su conocimiento del mundo y formarse una opinión." },
      { code: "OA 15", eje: "Escritura", description: "Escribir artículos informativos para comunicar información sobre un tema." },
      { code: "OA 24", eje: "Comunicación oral", description: "Expresarse de manera clara y efectiva en exposiciones orales para comunicar temas de su interés." },
    ],
    Matemática: [
      { code: "OA 03", eje: "Números y operaciones", description: "Demostrar que comprenden el concepto de razón." },
      { code: "OA 05", eje: "Números y operaciones", description: "Demostrar que comprenden el concepto de porcentaje." },
      { code: "OA 06", eje: "Números y operaciones", description: "Demostrar que comprenden la multiplicación y la división de decimales por números naturales de un dígito, múltiplos de 10 y decimales hasta la milésima." },
      { code: "OA 09", eje: "Patrones y álgebra", description: "Demostrar que comprenden la relación entre los valores de una tabla y aplicarla en la resolución de problemas sencillos." },
      { code: "OA 18", eje: "Geometría", description: "Calcular áreas de triángulos, paralelogramos y trapecios, y estimar áreas de figuras irregulares." },
    ],
    Ciencias: [
      { code: "OA 01", eje: "Ciencias de la vida", description: "Explicar, a partir de una investigación experimental, los requerimientos de agua, dióxido de carbono y energía lumínica para la fotosíntesis." },
      { code: "OA 03", eje: "Ciencias de la vida", description: "Explicar, por medio de modelos, la respiración, identificando sus estructuras principales." },
      { code: "OA 05", eje: "Ciencias de la vida", description: "Explicar, por medio de modelos, la función del sistema circulatorio." },
      { code: "OA 07", eje: "Ciencias de la vida", description: "Investigar en diversas fuentes y explicar los efectos nocivos del consumo excesivo de alcohol y de drogas." },
      { code: "OA 09", eje: "Ciencias físicas y químicas", description: "Investigar experimentalmente y explicar las características de las fuerzas de roce y la función de las fuerzas de gravedad." },
      { code: "OA 12", eje: "Ciencias de la Tierra y el Universo", description: "Explicar, con el modelo de la tectónica de placas, los patrones de distribución de la actividad geológica." },
    ],
  },
};

// Construye los OAs efectivos hidratando indicadores específicos o genéricos.
const hydrateIndicators = (gradeValue: string, subjectValue: string, oa: BaseOA): OA => {
  const specific = SPECIFIC_INDICATORS[gradeValue]?.[subjectValue]?.[oa.code];
  const generic = GENERIC_INDICATORS_BY_AREA[subjectValue] ?? GENERIC_INDICATORS_BY_AREA.Lenguaje;
  return { ...oa, indicators: specific && specific.length > 0 ? specific : generic };
};

const buildBaseOAs = (gradeValue: string, subjectValue: string): OA[] => {
  const base = BASE_CURRICULUM[gradeValue]?.[subjectValue];
  if (!base) return [];
  return base.map((b) => hydrateIndicators(gradeValue, subjectValue, b));
};

// Convierte un OverrideOA al formato OA.
const overrideToOA = (o: OverrideOA): OA => ({
  code: o.oa_code,
  description: o.oa_description,
  eje: o.eje,
  indicators: Array.isArray(o.indicators) ? o.indicators : [],
});

// Aplica overrides admin sobre el listado base.
const applyOverrides = (gradeValue: string, subjectValue: string, baseList: OA[]): OA[] => {
  const overrides = listOverrides(gradeValue, subjectValue);
  if (!overrides.length) return baseList;
  const byCode = new Map<string, OA>(baseList.map((o) => [o.code, o]));
  for (const ov of overrides) byCode.set(ov.oa_code, overrideToOA(ov));
  // Ordena: primero los que existen en base (en orden), luego los nuevos.
  const baseCodes = baseList.map((o) => o.code);
  const result: OA[] = baseCodes
    .filter((c) => byCode.has(c))
    .map((c) => byCode.get(c) as OA);
  for (const ov of overrides) {
    if (!baseCodes.includes(ov.oa_code)) result.push(overrideToOA(ov));
  }
  return result;
};

// === API pública ===

export const hasCurriculum = (gradeValue: string, subjectValue: string): boolean => {
  if (!gradeValue || !subjectValue) return false;
  if (BASE_CURRICULUM[gradeValue]?.[subjectValue]?.length) return true;
  return listOverrides(gradeValue, subjectValue).length > 0;
};

export const getOAs = (gradeValue: string, subjectValue: string): OA[] => {
  if (!gradeValue || !subjectValue) return [];
  const base = buildBaseOAs(gradeValue, subjectValue);
  const effective = applyOverrides(gradeValue, subjectValue, base);
  if (effective.length > 0) return effective;
  return TRANSVERSAL_SKILLS;
};

export const findOA = (gradeValue: string, subjectValue: string, code: string): OA | undefined =>
  getOAs(gradeValue, subjectValue).find((o) => o.code === code);

export const findIndicators = (gradeValue: string, subjectValue: string, oaCode: string): Indicator[] =>
  findOA(gradeValue, subjectValue, oaCode)?.indicators ?? [];

// Compat: export del antiguo CURRICULUM (algunos imports legados podrían usarlo).
export const CURRICULUM = BASE_CURRICULUM;
