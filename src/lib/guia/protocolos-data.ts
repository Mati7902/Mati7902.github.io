// Generado a partir de la Guía clínica avanzada. Editar a mano para ajustar el contenido.
/** Protocolos de sesión por sesión. */
import type { Protocol } from "./types";

export const PROTOCOLS: Protocol[] = [
 {
  "id": 1,
  "title": "Depresión en adultos",
  "intro": "Protocolo basado en activación conductual con componentes cognitivos y de prevención de recaídas. Es adecuado para la depresión leve a moderada y como inicio en la moderadamente grave, con coordinación médica si corresponde.",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**NICE NG222 (2022):** para la depresión menos grave, considerar primero la opción menos intrusiva. Las opciones psicológicas incluyen TCC individual, activación conductual, solución de problemas, psicoterapia interpersonal, autoayuda guiada y ejercicio grupal. **Certeza: sólida.**",
       "**Metaanálisis en red (Cuijpers et al., 2021):** las principales psicoterapias tienen eficacia comparable. **Certeza: sólida.**",
       "**Activación conductual:** eficaz (Ekers et al., 2014) y no inferior a la TCC cuando la aplican profesionales con formación breve (Richards et al., 2016). **Certeza: sólida.**",
       "**Contextos de bajos recursos:** el Healthy Activity Program, basado en activación conductual y de hasta ocho sesiones, fue eficaz en atención primaria (Patel et al., 2017). **Certeza: moderada a sólida.**"
      ]
     }
    ]
   },
   {
    "title": "Criterios para usar este protocolo o derivar",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**Usar:** depresión sin psicosis, sin riesgo suicida agudo y sin antecedentes de manía.",
       "**Derivar o coordinar con psiquiatría:** síntomas psicóticos, sospecha de bipolaridad, riesgo suicida alto, deterioro grave del autocuidado o ausencia de respuesta a las 6–8 semanas."
      ]
     }
    ]
   },
   {
    "title": "Criterios en la sesión 8",
    "blocks": [
     {
      "k": "table",
      "h": [
       "Resultado",
       "Decisión"
      ],
      "r": [
       [
        "Mejora clara y objetivos alcanzados",
        "Alta con plan de recaídas y sesión de refuerzo"
       ],
       [
        "Mejora parcial",
        "Continuar 4 a 8 sesiones con foco en los objetivos pendientes"
       ],
       [
        "Sin mejora o empeoramiento",
        "Revisar la formulación y derivar a psiquiatría o a un tratamiento más intensivo"
       ]
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Una mujer de 42 años, docente, tiene ánimo bajo desde hace cuatro meses tras su separación. En la sesión 1 refiere dormir mucho, abandono de actividades y autocrítica, sin ideación suicida. Entre las sesiones 2 y 4 retoma caminatas y el contacto con dos amigas. En la sesión 5 trabaja el pensamiento «fracasé como madre». En la sesión 6 ensaya una conversación con su exmarido sobre los hijos. En la sesión 8 sus medidas muestran mejora y se decide el alta con sesión de refuerzo."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Evaluación, alianza y formulación inicial",
    "objective": "comprender el problema, evaluar el riesgo y acordar la forma de trabajo.",
    "contents": [
     "Entrevista (capítulo 2) con descripción de un día típico",
     "Cribado de riesgo, consumo y antecedentes de manía",
     "PHQ-9, GAD-7 y AUDIT",
     "Encuadre de confidencialidad",
     "Primer esbozo del ciclo de la depresión con datos del paciente"
    ],
    "examples": [
     "Cuénteme cómo fue ayer, desde que se despertó. ¿En qué momentos se sintió un poco mejor o peor?"
    ],
    "homework": "registrar actividades y ánimo (0–10) durante tres días.",
    "measures": "PHQ-9, C-SSRS de cribado, GAD-7, AUDIT.",
    "extra": []
   },
   {
    "n": "2",
    "name": "Psicoeducación y monitoreo",
    "objective": "construir con el paciente el modelo de la inactividad y la evitación.",
    "contents": [
     "Revisión del registro",
     "Identificación de los momentos de mejor y peor ánimo",
     "Dibujo del ciclo (ánimo bajo → menos actividad → menos recompensa → más ánimo bajo)",
     "Explicación de la lógica de actuar «de afuera hacia adentro»",
     "Definición de dos o tres objetivos con la escala de logro"
    ],
    "examples": [
     "Fíjese: el martes, cuando salió a comprar con su vecina, su ánimo subió a 5. No es casualidad: es un dato."
    ],
    "homework": "registro completo de la semana con placer (P) y logro (L).",
    "measures": "escala de logro de objetivos (línea de base).",
    "extra": []
   },
   {
    "n": "3",
    "name": "Valores y primeras actividades",
    "objective": "vincular las actividades con lo que importa a la persona.",
    "contents": [
     "Exploración de valores en familia, trabajo, salud, comunidad y espiritualidad",
     "Lista de actividades por valor",
     "Jerarquía de fácil a difícil",
     "Programación de dos o tres actividades fáciles con día, hora y lugar",
     "Anticipación de obstáculos"
    ],
    "examples": [
     "Si su depresión mejorara un poco, ¿qué haría distinto el sábado? Empecemos por una parte pequeña de eso."
    ],
    "homework": "realizar las actividades programadas y registrar el ánimo antes y después.",
    "measures": "PHQ-9.",
    "extra": []
   },
   {
    "n": "4",
    "name": "Evitación y solución de obstáculos",
    "objective": "identificar patrones de evitación y reemplazarlos por conductas de afrontamiento.",
    "contents": [
     "Análisis funcional de una actividad no realizada (capítulo 4)",
     "Formato TRAP-TRAC (desencadenante, respuesta, patrón de evitación → alternativa de afrontamiento)",
     "División de tareas en pasos más pequeños",
     "Solución de problemas para barreras concretas (capítulo 12)"
    ],
    "examples": [
     "Cuando pensó en llamar a su hermana, ¿qué sintió? ¿Qué hizo en lugar de llamar? ¿Qué pasó con el malestar en ese momento y más tarde?"
    ],
    "homework": "aumentar a cuatro o cinco actividades y aplicar una alternativa de afrontamiento ante un patrón de evitación.",
    "measures": "registro de actividades.",
    "extra": []
   },
   {
    "n": "5",
    "name": "Pensamientos depresivos y rumiación",
    "objective": "reducir el impacto de la autocrítica y la rumiación sobre la conducta.",
    "contents": [
     "Identificación de pensamientos automáticos (registro de pensamientos, capítulo 10)",
     "Preguntas de examen de evidencia",
     "Para la rumiación, defusión y análisis de su función («¿pensar en esto me ayuda a resolver algo?»)",
     "Redirección de la atención hacia la actividad"
    ],
    "examples": [
     "Su mente le dice “no sirvo para nada”. Si un amigo suyo pensara eso de sí mismo, ¿qué evidencia le pediría?"
    ],
    "homework": "registro de un pensamiento por día con una respuesta alternativa, y mantener las actividades.",
    "measures": "PHQ-9 y escala de logro de objetivos (revisión intermedia).",
    "extra": []
   },
   {
    "n": "6",
    "name": "Vínculos y apoyo social",
    "objective": "recuperar el contacto social y resolver un problema interpersonal relevante.",
    "contents": [
     "Mapa de la red de apoyo",
     "Programación de contactos",
     "Ensayo conductual de una conversación difícil (pedir ayuda, poner un límite)",
     "Solución de problemas para un conflicto actual"
    ],
    "examples": [
     "Practiquemos cómo podría pedirle a su hija que la acompañe al médico. Yo hago de ella."
    ],
    "homework": "dos contactos sociales planificados y la conversación ensayada.",
    "measures": "registro de actividades sociales.",
    "extra": []
   },
   {
    "n": "7",
    "name": "Consolidación y señales de alerta",
    "objective": "consolidar lo aprendido e identificar las señales tempranas de recaída.",
    "contents": [
     "Revisión de las gráficas de ánimo y actividades",
     "Identificación de qué funcionó",
     "Elaboración del plan de prevención de recaídas tipo semáforo (capítulo 13)"
    ],
    "examples": [
     "Si dentro de seis meses empezara a sentirse mal otra vez, ¿qué sería lo primero que notaría su familia?"
    ],
    "homework": "completar el plan de recaídas y mantener las actividades sin guía del terapeuta durante la semana.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "8",
    "name": "Evaluación y decisión",
    "objective": "evaluar los resultados y decidir los próximos pasos.",
    "contents": [
     "PHQ-9, GAD-7 y escala de logro de objetivos comparados con la sesión 1",
     "Devolución de los resultados",
     "Decisión compartida: alta con seguimiento, continuación con más sesiones o derivación"
    ],
    "examples": [
     "En la primera sesión su puntaje era alto. Hoy bajó bastante. ¿Qué cree que lo hizo posible?"
    ],
    "homework": "aplicar el plan de recaídas; sesión de refuerzo en 4 a 6 semanas.",
    "measures": "PHQ-9, GAD-7, escala de logro de objetivos.",
    "extra": []
   }
  ],
  "tests": [
   {
    "name": "PHQ-9",
    "when": "Sesiones 1, 3, 5, 8 (o en cada sesión)",
    "why": "Gravedad y cambio; revisar siempre el ítem 9"
   },
   {
    "name": "C-SSRS (versión de cribado)",
    "when": "Sesión 1 y si el ítem 9 es positivo",
    "why": "Ideación y conducta suicida"
   },
   {
    "name": "GAD-7",
    "when": "Sesiones 1 y 8",
    "why": "Comorbilidad ansiosa"
   },
   {
    "name": "AUDIT",
    "when": "Sesión 1",
    "why": "Consumo de alcohol"
   },
   {
    "name": "Escala de logro de objetivos",
    "when": "Sesiones 2, 5, 8",
    "why": "Objetivos funcionales"
   },
   {
    "name": "Pregunta sobre manía o hipomanía",
    "when": "Sesión 1",
    "why": "Diagnóstico diferencial de bipolaridad"
   }
  ],
  "refs": "Cuijpers et al. (2021); Ekers et al. (2014); Kroenke et al. (2001); NICE (2022, NG222); Patel et al. (2017); Posner et al. (2011); Richards et al. (2016); Spitzer et al. (2006); Babor et al. (2001). Referencias completas en la bibliografía de la Parte V y en el anexo A7."
 },
 {
  "id": 2,
  "title": "Depresión en adolescentes",
  "intro": "Protocolo de TCC con activación conductual adaptada a la adolescencia, con sesiones o segmentos para los cuidadores. La participación familiar y el abordaje de la confidencialidad son parte del tratamiento, no un agregado.",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**Alianza con jóvenes:** se asocia a los resultados (r = 0,19; Karver et al., 2018). La alianza con los cuidadores también importa. **Certeza: moderada.**",
       "**Autolesiones en adolescentes:** si aparecen autolesiones repetidas, el abordaje de elección con mejor respaldo es la DBT-A (Mehlum et al., 2014; protocolo 8). **Certeza: moderada.**",
       "**Inferencia clínica:** las intervenciones con respaldo en adultos (activación conductual, reestructuración, solución de problemas) se adaptan a la edad con formatos más visuales, participación familiar y coordinación escolar.",
       "**Guía de referencia adicional:** NICE NG134 (depresión en niños y jóvenes). **[No verificada en esta revisión; consultar la versión vigente.]**"
      ]
     }
    ]
   },
   {
    "title": "Criterios para usar este protocolo o derivar",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**Usar:** depresión leve a moderada sin riesgo suicida agudo.",
       "**Derivar o escalar:** ideación con plan, autolesiones repetidas (protocolo 8), síntomas psicóticos, abuso o violencia (activar protección, capítulo 21), consumo grave."
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Un adolescente de 15 años, derivado por la escuela por bajo rendimiento e irritabilidad. En la sesión 1 aparecen aislamiento, insomnio con uso de pantallas hasta la madrugada e ideación pasiva sin plan. Se acuerda un plan de seguridad y se informa a la madre con su conocimiento. Las sesiones 3 y 4 se centran en el fútbol con amigos y el sueño. La sesión 6 reduce las discusiones con la madre por los horarios. En la sesión 8 la ideación remitió y el ánimo mejoró. Se decide un seguimiento mensual."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Encuadre doble y evaluación",
    "objective": "construir dos alianzas y evaluar el riesgo.",
    "contents": [
     "Apertura conjunta",
     "Tiempo a solas con el adolescente",
     "Encuadre de confidencialidad y sus límites",
     "HEEADSSS",
     "Cribado de riesgo y consumo",
     "RCADS en ambas versiones",
     "Cierre conjunto con un mensaje de esperanza"
    ],
    "examples": [
     "Acá no vamos a hablar de vos sin vos. Lo que contés a solas queda acá, salvo que haya riesgo para tu vida. En ese caso te aviso antes."
    ],
    "homework": "el adolescente registra tres momentos del día con su ánimo (0–10), por ejemplo en el celular.",
    "measures": "RCADS, PHQ-9, C-SSRS de cribado, CRAFFT.",
    "extra": []
   },
   {
    "n": "2",
    "name": "Psicoeducación para el adolescente y los cuidadores",
    "objective": "comprender la depresión sin culpa y alinear a la familia.",
    "contents": [
     "Con el adolescente: ciclo de inactividad, aislamiento y ánimo bajo, con sus propios ejemplos. Con los cuidadores (segmento de 15 minutos): la irritabilidad como síntoma posible",
     "Cómo responder sin sermonear",
     "Qué hacer ante señales de riesgo",
     "Restricción de acceso a medios en el hogar (medicamentos, armas)"
    ],
    "examples": [
     "Ejemplo para cuidadores: La irritabilidad de su hijo puede ser parte de la depresión. No es falta de respeto. Lo que más ayuda es menos discusión y más acompañamiento en actividades concretas."
    ],
    "homework": "el adolescente elige una actividad que antes disfrutaba y la hace una vez. Los cuidadores registran un momento positivo por día con su hijo.",
    "measures": "registro del ánimo.",
    "extra": []
   },
   {
    "n": "3",
    "name": "Activación conductual con foco social",
    "objective": "aumentar las actividades placenteras y el contacto con pares.",
    "contents": [
     "Valores adaptados a la edad (amistad, deporte, música, autonomía)",
     "Lista de actividades",
     "Programación concreta",
     "Plan B ante obstáculos"
    ],
    "examples": [
     "¿Qué te gustaría que fuera distinto en tu semana? Elijamos algo chico que dependa de vos."
    ],
    "homework": "tres actividades programadas, incluida una social.",
    "measures": "PHQ-9.",
    "extra": []
   },
   {
    "n": "4",
    "name": "Sueño, pantallas y rutinas",
    "objective": "abordar mantenedores frecuentes en la adolescencia.",
    "contents": [
     "Diario de sueño",
     "Acuerdo negociado (no impuesto) sobre el uso nocturno de pantallas",
     "Horario regular de levantarse",
     "Con los cuidadores, apoyo a las rutinas sin control excesivo"
    ],
    "examples": [
     "No se trata de prohibirte el celular. Se trata de que tu cuerpo pueda dormir lo que necesita. ¿Qué te parece un acuerdo que puedas cumplir?"
    ],
    "homework": "aplicar el acuerdo de sueño durante una semana.",
    "measures": "diario de sueño.",
    "extra": []
   },
   {
    "n": "5",
    "name": "Pensamientos y solución de problemas",
    "objective": "trabajar la autocrítica y problemas concretos (escuela, amigos, familia).",
    "contents": [
     "Registro de pensamientos simplificado (situación, pensamiento, emoción, otra forma de verlo)",
     "Solución de problemas en cinco pasos con un problema real (capítulo 12)"
    ],
    "examples": [
     "Tu mente dice “nadie me quiere en el grupo”. ¿Qué pasó exactamente? ¿Hay otra explicación posible?"
    ],
    "homework": "aplicar la solución de problemas a una situación concreta.",
    "measures": "PHQ-9 y revisión de objetivos.",
    "extra": []
   },
   {
    "n": "6",
    "name": "Comunicación familiar",
    "objective": "reducir el conflicto y mejorar la validación en la familia.",
    "contents": [
     "Sesión conjunta con reglas de turno",
     "Práctica de validación (los cuidadores repiten lo que escucharon antes de responder)",
     "Un acuerdo concreto sobre un tema de conflicto. Se pospone si hay violencia en la familia"
    ],
    "examples": [
     "Antes de responder, intente decirle a su hija lo que entendió que ella siente."
    ],
    "homework": "aplicar el acuerdo y practicar una conversación con validación.",
    "measures": "escala de logro de objetivos familiares.",
    "extra": []
   },
   {
    "n": "7",
    "name": "Escuela y plan de recaídas",
    "objective": "coordinar con la escuela si hace falta y preparar la prevención de recaídas.",
    "contents": [
     "Con acuerdo del adolescente, contacto con un referente escolar para adaptaciones temporales",
     "Plan de señales y acciones (semáforo), compartido con los cuidadores en la parte que el adolescente acepte"
    ],
    "examples": [
     "¿Qué parte de tu plan querés que sepan tus papás y cuál no?"
    ],
    "homework": "completar el plan.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "8",
    "name": "Evaluación y decisión",
    "objective": "evaluar el cambio con dos informantes y decidir.",
    "contents": [
     "RCADS en ambas versiones y PHQ-9",
     "Devolución",
     "Decisión compartida entre adolescente, cuidadores y terapeuta"
    ],
    "examples": [],
    "homework": "seguimiento en 4 a 6 semanas.",
    "measures": "RCADS, PHQ-9, C-SSRS si corresponde.",
    "extra": []
   }
  ],
  "tests": [
   {
    "name": "RCADS (adolescente y cuidadores)",
    "when": "Sesiones 1 y 8",
    "why": "Depresión y ansiedad, con dos informantes"
   },
   {
    "name": "PHQ-9 (o PHQ-A si se dispone de versión validada)",
    "when": "Sesiones 1, 3, 5, 8",
    "why": "Gravedad y cambio"
   },
   {
    "name": "C-SSRS",
    "when": "Sesión 1 y cuando haya indicios",
    "why": "Ideación y conducta suicida"
   },
   {
    "name": "CRAFFT",
    "when": "Sesión 1",
    "why": "Consumo de sustancias"
   },
   {
    "name": "HEEADSSS (entrevista)",
    "when": "Sesión 1",
    "why": "Áreas psicosociales de riesgo"
   }
  ],
  "refs": "Chorpita et al. (2000); Goldenring y Rosen (2004); Karver et al. (2018); Knight et al. (2002); Mehlum et al. (2014); Posner et al. (2011)."
 },
 {
  "id": 3,
  "title": "Ansiedad generalizada",
  "intro": "Protocolo de TCC centrado en la preocupación como intento de control, la intolerancia a la incertidumbre y la evitación sutil. Combina psicoeducación, diferenciación de preocupaciones, solución de problemas y exposición a la incertidumbre.",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**NICE CG113:** modelo de atención por pasos, empezando por la intervención eficaz menos intrusiva (psicoeducación y autoayuda guiada) y escalando a la TCC individual según la gravedad y la respuesta. **Certeza: sólida.**",
       "**ACT:** eficacia comparable a la TCC en trastornos de ansiedad (A-Tjak et al., 2015). Es una alternativa razonable. **Certeza: moderada.**"
      ]
     }
    ]
   },
   {
    "title": "Criterios para usar este protocolo o derivar",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**Antes de empezar:** descartar causas médicas (tiroides, cafeína, estimulantes) y consumo o abstinencia de sedantes.",
       "**Derivar o coordinar:** depresión grave, riesgo suicida, consumo de riesgo de sedantes o alcohol."
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Una comerciante de 40 años se preocupa por la salud de sus hijos, el dinero y la inseguridad, y llama a sus hijos varias veces al día. Con la clasificación de preocupaciones resuelve un problema financiero concreto en la sesión 3. Entre las sesiones 4 y 6 reduce las llamadas y practica la exposición escrita. En la sesión 8 duerme mejor y se preocupa menos tiempo por día."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Evaluación y línea de base",
    "objective": "comprender el patrón de preocupación y su impacto.",
    "contents": [
     "Entrevista",
     "Episodio reciente de preocupación",
     "Conductas de seguridad (llamadas de control, búsqueda de reaseguro, sobrepreparación, evitación de noticias)",
     "Cribado de riesgo, consumo y sueño",
     "GAD-7, PHQ-9, ISI"
    ],
    "examples": [
     "Cuando empieza a preocuparse por sus hijos, ¿qué hace para calmarse? ¿Cuánto le dura el alivio?"
    ],
    "homework": "registro de preocupaciones: momento, tema, intensidad y qué hizo.",
    "measures": "GAD-7, PHQ-9, ISI, AUDIT.",
    "extra": []
   },
   {
    "n": "2",
    "name": "Psicoeducación: el ciclo de la preocupación",
    "objective": "entender que la preocupación promete control, pero mantiene la ansiedad.",
    "contents": [
     "Modelo con los datos del registro",
     "Creencias sobre la utilidad de preocuparse («si me preocupo, estoy preparada»)",
     "Costos y beneficios de la preocupación",
     "Normalización de la ansiedad como respuesta, no como peligro"
    ],
    "examples": [
     "¿Cuántas de las cosas que le preocuparon el mes pasado ocurrieron? Y las que ocurrieron, ¿las resolvió gracias a la preocupación o a lo que hizo?"
    ],
    "homework": "seguir el registro y marcar qué preocupaciones se cumplieron.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "3",
    "name": "Problemas actuales o hipotéticos",
    "objective": "separar lo que se resuelve de lo que se tolera.",
    "contents": [
     "Clasificador de preocupaciones (capítulo 14)",
     "Para las actuales, solución de problemas en cinco pasos",
     "Para las hipotéticas, preparación para la exposición a la incertidumbre"
    ],
    "examples": [
     "¿Hay algo que pueda hacer hoy sobre esto? Si la respuesta es no, es una preocupación hipotética."
    ],
    "homework": "aplicar la solución de problemas a un problema actual.",
    "measures": "GAD-7.",
    "extra": []
   },
   {
    "n": "4",
    "name": "Tiempo de preocupación y aplazamiento",
    "objective": "recuperar el control sobre cuándo preocuparse.",
    "contents": [
     "«tiempo de preocupación» diario de 15–20 minutos, en horario fijo y lejos de la hora de dormir",
     "Aplazamiento de la preocupación fuera de ese tiempo",
     "Atención al presente"
    ],
    "examples": [
     "Cuando aparezca la preocupación a las 11 de la noche, anótela y dígase: “la atiendo mañana a las 18”."
    ],
    "homework": "practicar el aplazamiento diariamente.",
    "measures": "registro de minutos de preocupación por día.",
    "extra": []
   },
   {
    "n": "5",
    "name": "Intolerancia a la incertidumbre y conductas de seguridad",
    "objective": "reducir las conductas que buscan certeza.",
    "contents": [
     "Lista de conductas de seguridad",
     "Jerarquía de experimentos (no llamar para controlar durante dos horas, decidir sin consultar, mandar un mensaje sin releerlo)",
     "Predicción y resultado (capítulo 11)"
    ],
    "examples": [
     "Probemos no llamar a su hijo hasta la noche. ¿Qué predice que va a pasar? ¿Cuánto cree que va a durar su ansiedad?"
    ],
    "homework": "dos experimentos de incertidumbre.",
    "measures": "GAD-7 y revisión de objetivos.",
    "extra": []
   },
   {
    "n": "6",
    "name": "Exposición a la preocupación temida",
    "objective": "reducir la evitación de las imágenes temidas.",
    "contents": [
     "Exposición imaginaria escrita a la peor preocupación, sin neutralizar ni tranquilizarse",
     "Consolidación de lo aprendido. Si hay insomnio marcado, se agregan componentes de TCC-I (protocolo 12)"
    ],
    "examples": [
     "Escriba en detalle lo que más teme, sin agregar “pero seguro no pasa”. Quédese con eso unos minutos."
    ],
    "homework": "repetir la exposición escrita de tres a cuatro veces.",
    "measures": "ansiedad al inicio y al final de cada exposición, y lo aprendido.",
    "extra": []
   },
   {
    "n": "7",
    "name": "Valores, autocuidado y recaídas",
    "objective": "orientar la energía hacia lo valioso y preparar el plan de recaídas.",
    "contents": [
     "Actividades de valor desplazadas por la preocupación",
     "Plan semáforo",
     "Señales personales (más llamadas de control, insomnio)"
    ],
    "examples": [],
    "homework": "completar el plan.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "8",
    "name": "Evaluación y decisión",
    "objective": "",
    "contents": [
     "GAD-7, PHQ-9 e ISI comparados con la sesión 1",
     "Devolución",
     "Decisión de alta, continuación o derivación"
    ],
    "examples": [],
    "homework": "",
    "measures": "GAD-7, PHQ-9, ISI.",
    "extra": []
   }
  ],
  "tests": [
   {
    "name": "GAD-7",
    "when": "Sesiones 1, 3, 5, 8",
    "why": "Gravedad y cambio. Punto de corte 10 en la validación original (Spitzer et al., 2006)"
   },
   {
    "name": "PHQ-9",
    "when": "Sesiones 1 y 8",
    "why": "Comorbilidad depresiva"
   },
   {
    "name": "ISI",
    "when": "Sesión 1",
    "why": "Insomnio asociado"
   },
   {
    "name": "AUDIT",
    "when": "Sesión 1",
    "why": "Consumo como automedicación"
   },
   {
    "name": "Registro de preocupaciones",
    "when": "Semanal",
    "why": "Frecuencia, contenido y conductas asociadas"
   }
  ],
  "refs": "A-Tjak et al. (2015); Bastien et al. (2001); Craske et al. (2014); NICE (2011, CG113); Spitzer et al. (2006)."
 },
 {
  "id": 4,
  "title": "Trastorno de pánico y agorafobia",
  "intro": "Protocolo de TCC con psicoeducación, reestructuración de las interpretaciones catastróficas, exposición interoceptiva y exposición situacional con retiro de conductas de seguridad.",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**NICE CG113:** para el trastorno de pánico, primero reconocimiento e intervenciones de baja intensidad, y luego TCC. **Certeza: sólida.**",
       "**Aprendizaje inhibitorio:** las estrategias para optimizar la exposición (violación de expectativas, retiro de señales de seguridad, variabilidad de contextos) buscan reducir el retorno del miedo (Craske et al., 2014). **Certeza: moderada.**"
      ]
     }
    ]
   },
   {
    "title": "Criterios para usar este protocolo o derivar",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**Requisito previo:** evaluación médica de los síntomas físicos (cardiológicos, respiratorios, tiroideos), especialmente en el primer episodio o con factores de riesgo.",
       "**Precaución:** la exposición interoceptiva intensa requiere autorización médica ante enfermedades cardíacas, asma, epilepsia o embarazo."
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Un hombre de 35 años, con estudio cardiológico normal, evita los ómnibus y solo sale con agua y el celular cargado. Predice que «se va a desmayar». En la sesión 4, al girar en una silla, comprueba que el mareo no lo lleva al desmayo. Entre las sesiones 5 y 7 viaja en ómnibus cada vez más lejos y sin agua. En la sesión 8 la evitación se redujo de forma marcada y se acuerda una sesión de refuerzo."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Evaluación y modelo",
    "objective": "describir los ataques y el patrón de evitación.",
    "contents": [
     "Reconstrucción del último ataque (sensación → interpretación → miedo → más sensación)",
     "Conductas de seguridad (acompañante, agua, celular, sentarse cerca de la puerta)",
     "Situaciones evitadas",
     "PDSS, PHQ-9 y AUDIT",
     "Confirmación del estudio médico"
    ],
    "examples": [
     "En el momento de mayor miedo, ¿qué pensó que le iba a pasar?"
    ],
    "homework": "registro de ataques: situación, sensaciones, pensamiento, conducta.",
    "measures": "PDSS y lista de evitación.",
    "extra": []
   },
   {
    "n": "2",
    "name": "Psicoeducación: el círculo del pánico",
    "objective": "reinterpretar las sensaciones como respuestas de alarma no peligrosas.",
    "contents": [
     "Fisiología de la ansiedad (taquicardia, mareo, falta de aire) en lenguaje simple",
     "El círculo del pánico con sus datos",
     "Cómo la evitación y las conductas de seguridad impiden comprobar que no ocurre la catástrofe"
    ],
    "examples": [
     "Si llevar el agua le impide desmayarse, nunca va a poder saber que no se habría desmayado igual."
    ],
    "homework": "leer el material y seguir el registro.",
    "measures": "registro de ataques.",
    "extra": []
   },
   {
    "n": "3",
    "name": "Reestructuración de la interpretación catastrófica",
    "objective": "examinar la creencia central (por ejemplo, «me voy a desmayar» o «es un infarto»).",
    "contents": [
     "Probabilidad estimada antes y después de examinar la evidencia («¿cuántos ataques tuvo? ¿cuántas veces se desmayó?»)",
     "Explicaciones alternativas",
     "Preparación de experimentos"
    ],
    "examples": [
     "Tuvo unos cuarenta ataques en un año y en ninguno se desmayó. ¿Qué le dice eso sobre la predicción?"
    ],
    "homework": "registrar la predicción y lo que ocurre en cada ataque.",
    "measures": "grado de creencia en la catástrofe (0–100 %).",
    "extra": []
   },
   {
    "n": "4",
    "name": "Exposición interoceptiva",
    "objective": "provocar deliberadamente las sensaciones temidas para aprender que se toleran.",
    "contents": [
     "Ejercicios en sesión, con autorización médica cuando corresponda: girar en una silla (mareo), respirar por una pajita (falta de aire), subir escaleras rápido (taquicardia), hiperventilar brevemente. Registro de la intensidad, la similitud con el pánico y lo aprendido"
    ],
    "examples": [
     "Vamos a provocar el mareo a propósito. Su tarea es no hacer nada para frenarlo y ver qué pasa."
    ],
    "homework": "repetir diariamente los dos ejercicios más parecidos al pánico.",
    "measures": "PDSS (control intermedio).",
    "extra": []
   },
   {
    "n": "5",
    "name": "Exposición situacional I",
    "objective": "enfrentar las situaciones evitadas de menor dificultad.",
    "contents": [
     "Jerarquía flexible",
     "Primera exposición planificada (por ejemplo, un trayecto corto en ómnibus) con predicción explícita",
     "Retiro progresivo de las conductas de seguridad"
    ],
    "examples": [
     "¿Qué espera que pase si viaja diez minutos sola y sin agua? Escribámoslo para comparar después."
    ],
    "homework": "tres exposiciones situacionales.",
    "measures": "hoja de exposición (predicción, resultado, aprendizaje).",
    "extra": []
   },
   {
    "n": "6",
    "name": "Exposición situacional II y combinada",
    "objective": "aumentar la dificultad y combinar con sensaciones.",
    "contents": [
     "Situaciones de mayor dificultad (lugares concurridos, viajes más largos)",
     "Exposición combinada (por ejemplo, tomar café, que aumenta la activación, antes de entrar a un supermercado)",
     "Variabilidad de contextos"
    ],
    "examples": [],
    "homework": "exposiciones en tres contextos distintos.",
    "measures": "lista de evitación.",
    "extra": []
   },
   {
    "n": "7",
    "name": "Autonomía y conductas de seguridad residuales",
    "objective": "que la persona diseñe y realice sus exposiciones sin el terapeuta.",
    "contents": [
     "Identificación de conductas de seguridad sutiles que persisten",
     "Plan autónomo de exposición",
     "Plan de recaídas (qué hacer si vuelve un ataque: no evitar)"
    ],
    "examples": [
     "Si mañana tuviera un ataque en el súper, ¿qué haría con lo que aprendió?"
    ],
    "homework": "exposición autodiseñada.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "8",
    "name": "Evaluación y decisión",
    "objective": "",
    "contents": [
     "PDSS, lista de evitación y PHQ-9 comparados con la sesión 1",
     "Devolución",
     "Decisión"
    ],
    "examples": [],
    "homework": "",
    "measures": "PDSS, lista de evitación, PHQ-9.",
    "extra": []
   }
  ],
  "tests": [
   {
    "name": "PDSS",
    "when": "Sesiones 1, 4, 8",
    "why": "Frecuencia, malestar, ansiedad anticipatoria, evitación e interferencia (Shear et al., 1997)"
   },
   {
    "name": "Registro de ataques de pánico",
    "when": "Semanal",
    "why": "Frecuencia, desencadenantes e interpretación"
   },
   {
    "name": "Lista de situaciones evitadas (0–100)",
    "when": "Sesiones 1 y 8",
    "why": "Agorafobia"
   },
   {
    "name": "PHQ-9",
    "when": "Sesiones 1 y 8",
    "why": "Depresión comórbida"
   },
   {
    "name": "AUDIT",
    "when": "Sesión 1",
    "why": "Alcohol como automedicación"
   }
  ],
  "refs": "Babor et al. (2001); Craske et al. (2014); Kroenke et al. (2001); NICE (2011, CG113); Shear et al. (1997)."
 },
 {
  "id": 5,
  "title": "Ansiedad social",
  "intro": "Protocolo de TCC basado en el modelo cognitivo de la ansiedad social: atención autofocalizada, conductas de seguridad, predicciones sobre la evaluación negativa y procesamiento posterior a los eventos. Se trabaja con experimentos conductuales y exposición.",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**TCC con exposición y experimentos conductuales:** tratamiento psicológico de primera línea en las guías principales (NICE CG159, ansiedad social). **[Guía no verificada en esta revisión; consultar la versión vigente.]**",
       "**Aprendizaje inhibitorio aplicado a la exposición social:** Craske et al. (2014). **Certeza: moderada.**"
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Un estudiante de 20 años evita exponer en clase y hablar en grupos. Bebe alcohol antes de las reuniones sociales. En la sesión 3 descubre que ensayar frases lo hace parecer más tenso. Entre las sesiones 5 y 6 hace preguntas en clase y una exposición breve. Se aborda también el uso del alcohol como conducta de seguridad. En la sesión 8 la evitación se redujo y se acuerdan cuatro sesiones más para la exposición oral final del semestre."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Evaluación",
    "objective": "identificar las situaciones temidas, las predicciones y las conductas de seguridad.",
    "contents": [
     "Episodio reciente (antes, durante y después)",
     "Conductas de seguridad típicas (no mirar a los ojos, ensayar frases, mirar el celular, hablar poco, sujetar el vaso con fuerza)",
     "Rumiación posterior",
     "LSAS, PHQ-9 y consumo"
    ],
    "examples": [
     "Durante la reunión, ¿en qué estaba concentrada su atención: en los demás o en cómo se veía usted?"
    ],
    "homework": "registro de dos situaciones sociales.",
    "measures": "LSAS, PHQ-9.",
    "extra": []
   },
   {
    "n": "2",
    "name": "Modelo personalizado",
    "objective": "construir el ciclo de la ansiedad social con los datos del paciente.",
    "contents": [
     "Diagrama: situación → predicción («van a notar que tiemblo») → atención autofocalizada → conductas de seguridad → evidencia distorsionada → procesamiento posterior"
    ],
    "examples": [],
    "homework": "observar qué conductas de seguridad usa en la semana.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "3",
    "name": "Experimento de conductas de seguridad",
    "objective": "mostrar el efecto de las conductas de seguridad.",
    "contents": [
     "Juego de roles en sesión, una vez con y otra sin conductas de seguridad",
     "Calificación de la ansiedad y de cómo cree que se vio",
     "Comparación con la percepción del terapeuta o con un video si el paciente acepta"
    ],
    "examples": [
     "En la conversación sin ensayar frases, ¿se sintió peor o mejor? ¿Y cómo cree que la vi yo?"
    ],
    "homework": "una conversación breve sin conductas de seguridad.",
    "measures": "ansiedad y grado de creencia en la predicción.",
    "extra": []
   },
   {
    "n": "4",
    "name": "Atención externa",
    "objective": "reducir la atención autofocalizada.",
    "contents": [
     "Entrenamiento en desplazar la atención hacia la tarea y hacia los demás (escuchar el contenido, observar detalles del entorno)",
     "Práctica en sesión"
    ],
    "examples": [],
    "homework": "practicar la atención externa en tres conversaciones.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "5",
    "name": "Experimentos conductuales I",
    "objective": "poner a prueba predicciones específicas.",
    "contents": [
     "Jerarquía de situaciones",
     "Experimentos como hacer una pregunta en clase, pedir una indicación en la calle o comer en público",
     "Predicción, resultado y aprendizaje"
    ],
    "examples": [
     "Predice que si pregunta algo en clase la gente se va a reír. ¿Cómo podríamos comprobarlo?"
    ],
    "homework": "dos experimentos.",
    "measures": "hoja de exposición.",
    "extra": []
   },
   {
    "n": "6",
    "name": "Experimentos II y «errores a propósito»",
    "objective": "reducir el miedo a la evaluación negativa.",
    "contents": [
     "Experimentos de mayor dificultad",
     "Errores deliberados y leves (equivocarse al pagar, hacer una pausa larga al hablar) para comprobar la reacción real de los demás"
    ],
    "examples": [],
    "homework": "dos experimentos, uno con error deliberado.",
    "measures": "grado de creencia.",
    "extra": []
   },
   {
    "n": "7",
    "name": "Procesamiento posterior y autoimagen",
    "objective": "reducir la rumiación después de los eventos sociales.",
    "contents": [
     "Identificación de la «revisión mental» posterior",
     "Alternativas como la atención al presente, el registro de datos objetivos o la defusión",
     "Plan de recaídas"
    ],
    "examples": [],
    "homework": "plan de exposición autónoma.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "8",
    "name": "Evaluación y decisión",
    "objective": "",
    "contents": [
     "LSAS y PHQ-9",
     "Devolución",
     "Decisión de continuar con exposición si persiste la evitación en áreas importantes"
    ],
    "examples": [],
    "homework": "",
    "measures": "LSAS, PHQ-9.",
    "extra": []
   }
  ],
  "tests": [
   {
    "name": "LSAS (autoinforme o entrevista)",
    "when": "Sesiones 1 y 8",
    "why": "Miedo y evitación en 24 situaciones sociales y de desempeño (Liebowitz, 1987)"
   },
   {
    "name": "PHQ-9",
    "when": "Sesiones 1 y 8",
    "why": "Depresión comórbida"
   },
   {
    "name": "AUDIT o CRAFFT",
    "when": "Sesión 1",
    "why": "Alcohol como «lubricante social»"
   },
   {
    "name": "Registro de situaciones sociales",
    "when": "Semanal",
    "why": "Predicciones, conductas de seguridad y resultados"
   }
  ],
  "refs": "Babor et al. (2001); Craske et al. (2014); Knight et al. (2002); Liebowitz (1987)."
 },
 {
  "id": 6,
  "title": "Trastorno obsesivo-compulsivo",
  "intro": "Protocolo de exposición con prevención de respuesta (EPR), con trabajo cognitivo sobre la responsabilidad excesiva y la importancia atribuida a los pensamientos. En TOC, ocho sesiones suelen ser insuficientes para un tratamiento completo. Este formato cubre el inicio estructurado y la transferencia de habilidades.",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**EPR:** componente central del tratamiento psicológico del TOC en las guías principales (NICE CG31). **[Guía no verificada en esta revisión; consultar la versión vigente.]**",
       "**Aprendizaje inhibitorio:** el foco está en la violación de expectativas y en tolerar la incertidumbre, más que en esperar a que la ansiedad baje (Craske et al., 2014). **Certeza: moderada.**"
      ]
     }
    ]
   },
   {
    "title": "Criterios para usar este protocolo o derivar",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**Coordinar con psiquiatría:** TOC grave (gran parte del día con síntomas), insight pobre, depresión grave o riesgo suicida.",
       "**Diferenciar:** pensamientos intrusivos egodistónicos (TOC) de rumiación depresiva, preocupación generalizada o ideas delirantes."
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Una mujer de 29 años se lava las manos más de 30 veces al día por miedo a contagiar a su bebé y pide a su pareja que confirme que todo está limpio. En la sesión 4 la pareja aprende a no dar reaseguro. Entre las sesiones 3 y 6 avanza desde tocar objetos de la casa hasta preparar la comida sin lavado extra. En la sesión 8 el tiempo dedicado a los rituales se redujo y se acuerdan ocho sesiones más."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Evaluación",
    "objective": "mapear las obsesiones, las compulsiones (incluidas las mentales) y la evitación.",
    "contents": [
     "Y-BOCS",
     "Identificación de neutralizaciones y búsqueda de reaseguro",
     "Acomodación familiar",
     "Nivel de insight",
     "PHQ-9 y riesgo"
    ],
    "examples": [
     "Cuando aparece el pensamiento, ¿qué hace, en la cabeza o con el cuerpo, para quedarse tranquilo?"
    ],
    "homework": "registro de compulsiones durante la semana: situación, obsesión, compulsión y tiempo.",
    "measures": "Y-BOCS, PHQ-9.",
    "extra": []
   },
   {
    "n": "2",
    "name": "Psicoeducación: el ciclo obsesivo",
    "objective": "entender que los pensamientos intrusivos son universales y que la compulsión mantiene el problema.",
    "contents": [
     "Normalización de los pensamientos intrusivos",
     "Ciclo obsesión → ansiedad → compulsión → alivio → refuerzo",
     "Fusión pensamiento-acción («pensarlo es casi hacerlo»)",
     "Explicación de la EPR"
    ],
    "examples": [
     "Casi todas las personas tienen pensamientos raros o desagradables. La diferencia es qué significado les damos y qué hacemos para neutralizarlos."
    ],
    "homework": "leer el material; observar sin modificar las compulsiones.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "3",
    "name": "Jerarquía y primera EPR",
    "objective": "construir la jerarquía y hacer la primera exposición en sesión.",
    "contents": [
     "Lista de situaciones de exposición con ansiedad esperada (0–100)",
     "Acuerdo de prevención de respuesta",
     "Primera exposición de dificultad moderada (por ejemplo, tocar un picaporte y no lavarse durante una hora)",
     "Predicción y aprendizaje"
    ],
    "examples": [
     "La tarea no es que la ansiedad desaparezca, sino comprobar qué pasa si no hace el lavado."
    ],
    "homework": "repetir la exposición diariamente, con prevención de respuesta.",
    "measures": "hoja de exposición.",
    "extra": []
   },
   {
    "n": "4",
    "name": "EPR progresiva y reaseguro",
    "objective": "avanzar en la jerarquía y eliminar la búsqueda de reaseguro.",
    "contents": [
     "Exposiciones de mayor dificultad",
     "Plan para dejar de pedir reaseguro",
     "Sesión con los familiares sobre cómo responder sin acomodarse («entiendo que te preocupa; no voy a responder si cerraste la puerta»)"
    ],
    "examples": [],
    "homework": "dos exposiciones diarias; la familia aplica la nueva respuesta.",
    "measures": "Y-BOCS (control intermedio).",
    "extra": []
   },
   {
    "n": "5",
    "name": "Obsesiones sin compulsiones visibles",
    "objective": "abordar las compulsiones mentales y las obsesiones de contenido agresivo, sexual o religioso.",
    "contents": [
     "Exposición imaginaria o escrita al pensamiento temido, sin neutralización mental",
     "Defusión",
     "Trabajo cognitivo con la sobreestimación de la responsabilidad"
    ],
    "examples": [
     "Escriba el pensamiento tal como aparece y léalo varias veces, sin rezar ni “deshacerlo” mentalmente."
    ],
    "homework": "exposición escrita o en audio diaria.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "6",
    "name": "Exposición en contextos reales y variados",
    "objective": "generalizar a distintos contextos.",
    "contents": [
     "Exposiciones en el hogar, el trabajo o la escuela",
     "Variabilidad",
     "Elementos de la parte alta de la jerarquía"
    ],
    "examples": [],
    "homework": "plan semanal de exposiciones autónomas.",
    "measures": "hoja de exposición.",
    "extra": []
   },
   {
    "n": "7",
    "name": "Autonomía y prevención de recaídas",
    "objective": "que la persona sea su propio terapeuta de EPR.",
    "contents": [
     "Principios para diseñar exposiciones ante nuevas obsesiones",
     "Señales de recaída (reaparición de rituales o de reaseguro)",
     "Plan para «ir hacia» el miedo en lugar de evitarlo"
    ],
    "examples": [],
    "homework": "exposición autodiseñada.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "8",
    "name": "Evaluación y decisión",
    "objective": "",
    "contents": [
     "Y-BOCS y PHQ-9",
     "Devolución",
     "En TOC moderado o grave, lo habitual es continuar con más sesiones de EPR"
    ],
    "examples": [],
    "homework": "",
    "measures": "Y-BOCS, PHQ-9.",
    "extra": []
   }
  ],
  "tests": [
   {
    "name": "Y-BOCS (lista de síntomas y escala de gravedad)",
    "when": "Sesiones 1, 4, 8",
    "why": "Gravedad del TOC (0–40), administrada por el clínico (Goodman et al., 1989). Uso digital sujeto a licencia"
   },
   {
    "name": "PHQ-9",
    "when": "Sesiones 1 y 8",
    "why": "Depresión comórbida"
   },
   {
    "name": "C-SSRS",
    "when": "Sesión 1",
    "why": "Riesgo suicida"
   },
   {
    "name": "Registro de obsesiones y compulsiones",
    "when": "Semanal",
    "why": "Frecuencia, tiempo y desencadenantes"
   }
  ],
  "refs": "Craske et al. (2014); Goodman et al. (1989); Kroenke et al. (2001); Posner et al. (2011)."
 },
 {
  "id": 7,
  "title": "Estrés postraumático",
  "intro": "Este protocolo tiene dos niveles. El **nivel A** (sesiones 1 a 4) es aplicable por cualquier psicólogo clínico: evaluación, seguridad, psicoeducación, estabilización y reducción de la evitación. El **nivel B** (sesiones 5 a 8) incluye el procesamiento del trauma y requiere formación específica en un tratamiento focalizado en el trauma (por ejemplo, terapia de procesamiento cognitivo, exposición prolongada, TCC focalizada en el trauma o EMDR). Sin esa formación, en la sesión 4 se deriva.",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**NICE NG116 (2018):** ofrecer TCC focalizada en el trauma individual a adultos con TEPT más de un mes después del evento. Ofrecer EMDR para trauma no relacionado con combate cuando han pasado más de tres meses. No ofrecer debriefing psicológico. **Certeza: sólida.**",
       "**Debriefing:** no previene el TEPT y puede asociarse a peores resultados (Rose et al., 2002). **Certeza: moderada.**",
       "**Niños y adolescentes:** TF-CBT con cuidadores no agresores (de Arellano et al., 2014). **Certeza: sólida a moderada.**"
      ]
     }
    ]
   },
   {
    "title": "Criterios para usar este protocolo o derivar",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**No procesar el trauma** si la amenaza sigue activa (violencia en curso), hay riesgo suicida agudo, consumo grave no estabilizado o disociación grave. Primero, seguridad y estabilización.",
       "**Menores:** activar la protección si corresponde (Ley N.º 1680, capítulo 21)."
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Una mujer de 26 años sufrió un asalto con arma hace cuatro meses. No hay amenaza actual. Entre las sesiones 1 y 4 recupera el sueño, aprende técnicas de anclaje y vuelve a caminar de día por su barrio. En la sesión 4 se deriva a una colega formada en terapia de procesamiento cognitivo, que trabaja la creencia «fue mi culpa por volver tarde»."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Seguridad y evaluación (nivel A)",
    "objective": "evaluar sin revictimizar y asegurar condiciones mínimas.",
    "contents": [
     "Encuadre de control (el paciente decide cuánto contar)",
     "Preguntas sobre la amenaza actual",
     "PCL-5, PHQ-9, C-SSRS y AUDIT",
     "Plan de seguridad si hay riesgo"
    ],
    "examples": [
     "No necesita contarme los detalles hoy. Me interesa saber cómo está ahora y si está a salvo."
    ],
    "homework": "registrar los momentos de malestar y sus desencadenantes.",
    "measures": "PCL-5, PHQ-9, C-SSRS, AUDIT.",
    "extra": []
   },
   {
    "n": "2",
    "name": "Psicoeducación (nivel A)",
    "objective": "dar sentido a los síntomas.",
    "contents": [
     "El sistema de alarma después del trauma",
     "Reexperimentación, evitación, hiperactivación y cambios en las creencias como respuestas comprensibles",
     "Por qué la evitación mantiene los síntomas",
     "Información sobre los tratamientos eficaces"
    ],
    "examples": [
     "Su cuerpo sigue reaccionando como si el peligro estuviera presente. El tratamiento ayuda a que aprenda que eso ya pasó."
    ],
    "homework": "leer el material; identificar tres desencadenantes.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "3",
    "name": "Estabilización y regulación (nivel A)",
    "objective": "dar herramientas para atravesar los momentos de activación intensa.",
    "contents": [
     "Técnicas de anclaje en el presente (orientación con los sentidos)",
     "Respiración pausada",
     "Habilidades de tolerancia al malestar (capítulo 9)",
     "Sueño (protocolo 12)",
     "Reducción del consumo"
    ],
    "examples": [],
    "homework": "practicar una técnica de anclaje por día.",
    "measures": "registro de uso y utilidad.",
    "extra": []
   },
   {
    "n": "4",
    "name": "Evitación y rutinas; decisión sobre el procesamiento (nivel A)",
    "objective": "reducir la evitación generalizada y decidir el siguiente paso.",
    "contents": [
     "Lista de actividades y lugares evitados que son seguros",
     "Primeros pasos de reactivación",
     "PCL-5 intermedio",
     "Decisión compartida sobre el tratamiento focalizado en el trauma, con el terapeuta formado o por derivación"
    ],
    "examples": [
     "Ahora que tiene más herramientas, podemos hablar de trabajar con el recuerdo. Le explico cómo es y usted decide."
    ],
    "homework": "dos actividades evitadas pero seguras.",
    "measures": "PCL-5.",
    "extra": []
   },
   {
    "n": "5 a 8",
    "name": "Procesamiento del trauma (nivel B, solo con formación específica)",
    "objective": "",
    "contents": [],
    "examples": [],
    "homework": "",
    "measures": "",
    "extra": [
     {
      "k": "p",
      "t": "**Estructura orientativa compatible con TCC focalizada en el trauma o terapia de procesamiento cognitivo:**"
     },
     {
      "k": "note",
      "t": "**Precaución clínica.** No se realiza el procesamiento del recuerdo traumático sin formación ni supervisión en el modelo elegido. Un procesamiento mal conducido puede aumentar el malestar y el abandono."
     }
    ]
   }
  ],
  "tests": [
   {
    "name": "PCL-5",
    "when": "Sesiones 1, 4, 8",
    "why": "Síntomas de TEPT según DSM-5 (0–80). No es diagnóstico por sí solo (Blevins et al., 2015)"
   },
   {
    "name": "PHQ-9",
    "when": "Sesiones 1 y 8",
    "why": "Depresión"
   },
   {
    "name": "C-SSRS",
    "when": "Sesión 1 y en cada sesión si hay riesgo",
    "why": "Riesgo suicida"
   },
   {
    "name": "AUDIT",
    "when": "Sesión 1",
    "why": "Consumo como automedicación"
   },
   {
    "name": "Preguntas sobre disociación",
    "when": "Sesión 1",
    "why": "Ajuste del ritmo del procesamiento"
   }
  ],
  "refs": "Babor et al. (2001); Blevins et al. (2015); de Arellano et al. (2014); NICE (2018, NG116); Posner et al. (2011); Rose et al. (2002)."
 },
 {
  "id": 8,
  "title": "Autolesiones y riesgo suicida (abordaje informado por DBT)",
  "intro": "Protocolo ambulatorio para personas con ideación suicida sin riesgo inminente o con autolesiones no suicidas. Combina plan de seguridad, análisis en cadena y habilidades de la DBT. **No reemplaza** la atención de emergencia cuando el riesgo es inminente, ni un programa DBT completo cuando las autolesiones son graves y repetidas.",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**NICE NG225 (2022):** evaluación psicosocial centrada en necesidades; no usar escalas de riesgo para predecir ni para decidir el alta; considerar planes de seguridad colaborativos. **Certeza: sólida.**",
       "**Plan de seguridad con seguimiento telefónico:** menor conducta suicida a los seis meses y más asistencia ambulatoria (Stanley et al., 2018). **Certeza: moderada.**",
       "**DBT y DBT-A:** las habilidades son un componente activo (Linehan et al., 2015). La DBT-A redujo las autolesiones en adolescentes (Mehlum et al., 2014). **Certeza: moderada.**",
       "**Restricción de medios:** evidencia fortalecida a nivel poblacional (Zalsman et al., 2016). **Certeza: sólida.**"
      ]
     }
    ]
   },
   {
    "title": "Criterios de escalamiento (en cualquier sesión)",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "Intención con plan, acceso a medios o conducta preparatoria → atención de emergencia inmediata (capítulo 17).",
       "Autolesiones que requieren atención médica → evaluación médica.",
       "Menor en riesgo o en desprotección → adulto responsable y sistema de protección."
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Una adolescente de 16 años se corta tras las discusiones con su madre, sin intención suicida actual, aunque tuvo pensamientos de muerte el mes pasado. En la sesión 1 se elabora el plan de seguridad, se informa a la madre con conocimiento de la adolescente y se acuerda guardar los medicamentos del hogar. El análisis en cadena muestra que el eslabón clave es la media hora posterior a la discusión. Practica habilidades de crisis. En la sesión 6 la madre aprende a validar. En la sesión 8 las autolesiones disminuyeron y se mantiene un seguimiento quincenal."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Evaluación y plan de seguridad",
    "objective": "evaluar el riesgo y construir el plan de seguridad.",
    "contents": [
     "Pregunta directa",
     "Ideación, intención, plan, medios, conducta preparatoria, intentos previos y factores protectores",
     "C-SSRS",
     "Plan de seguridad colaborativo en siete pasos",
     "Acuerdo concreto de restricción de medios",
     "Contacto de emergencia y, en menores, comunicación con un adulto responsable"
    ],
    "examples": [
     "Quiero preguntarle directamente: ¿está pensando en quitarse la vida? ¿Lo pensó en las últimas semanas?"
    ],
    "homework": "llevar el plan de seguridad consigo (en papel o en el teléfono).",
    "measures": "C-SSRS, PHQ-9, consumo. Contacto telefónico en 24 a 72 horas.",
    "extra": []
   },
   {
    "n": "2",
    "name": "Orientación y compromiso; tarjeta diaria",
    "objective": "acordar objetivos y la lógica de las habilidades.",
    "contents": [
     "Jerarquía de objetivos (conductas que amenazan la vida → conductas que interfieren con la terapia → calidad de vida)",
     "Validación",
     "Explicación de la tarjeta diaria",
     "Pros y contras de la autolesión frente a alternativas"
    ],
    "examples": [
     "Entiendo que cortarte te da alivio en el momento. Vamos a buscar otras formas de conseguir ese alivio que no te dañen."
    ],
    "homework": "tarjeta diaria.",
    "measures": "C-SSRS.",
    "extra": []
   },
   {
    "n": "3",
    "name": "Análisis en cadena",
    "objective": "entender la secuencia que lleva a la autolesión o a la crisis.",
    "contents": [
     "Análisis en cadena del episodio más reciente: vulnerabilidades, desencadenante, pensamientos, emociones, sensaciones, impulso, conducta y consecuencias. Identificación de dos o tres eslabones donde intervenir. Se analiza la secuencia, no el método"
    ],
    "examples": [],
    "homework": "tarjeta diaria; identificar los primeros eslabones durante la semana.",
    "measures": "C-SSRS.",
    "extra": []
   },
   {
    "n": "4",
    "name": "Tolerancia al malestar",
    "objective": "atravesar la crisis sin empeorarla.",
    "contents": [
     "Habilidades de crisis: distracción activa, cambio fisiológico breve (respiración pausada, actividad física intensa breve, con precaución ante enfermedades médicas), autocalmarse con los sentidos y pros y contras. Ensayo en sesión. No se recomiendan sustitutos que imiten el dolor o la imagen de la herida"
    ],
    "examples": [
     "Cuando el impulso llegue a 7 de 10, ¿cuál de estas habilidades va a probar primero?"
    ],
    "homework": "usar una habilidad cada vez que el impulso supere un umbral acordado.",
    "measures": "C-SSRS, PHQ-9 y tarjeta diaria.",
    "extra": []
   },
   {
    "n": "5",
    "name": "Regulación emocional",
    "objective": "reducir la vulnerabilidad emocional.",
    "contents": [
     "Nombrar las emociones",
     "Reducir las vulnerabilidades (sueño, comida, consumo, enfermedad)",
     "Acción opuesta a la emoción cuando la emoción no se ajusta a los hechos",
     "Actividades placenteras"
    ],
    "examples": [],
    "homework": "registrar una emoción por día y practicar una acción opuesta.",
    "measures": "C-SSRS.",
    "extra": []
   },
   {
    "n": "6",
    "name": "Efectividad interpersonal y familia",
    "objective": "reducir los conflictos que desencadenan las crisis.",
    "contents": [
     "Pedir lo que se necesita y decir que no, manteniendo la relación y el autorrespeto",
     "En adolescentes, sesión con los cuidadores sobre validación y respuesta ante las crisis"
    ],
    "examples": [],
    "homework": "practicar un pedido en una situación real.",
    "measures": "C-SSRS.",
    "extra": []
   },
   {
    "n": "7",
    "name": "Desesperanza, razones para vivir y plan revisado",
    "objective": "fortalecer las razones para vivir y actualizar el plan.",
    "contents": [
     "Valores y metas a corto plazo",
     "Revisión del plan de seguridad con lo aprendido",
     "Revisión de la restricción de medios"
    ],
    "examples": [],
    "homework": "completar la «caja de razones para vivir» (objetos, fotos, mensajes).",
    "measures": "C-SSRS.",
    "extra": []
   },
   {
    "n": "8",
    "name": "Evaluación y decisión",
    "objective": "",
    "contents": [
     "Revisión de la tarjeta diaria desde la sesión 1",
     "PHQ-9",
     "Decisión. Si persisten autolesiones frecuentes o intentos, se deriva a un programa DBT o DBT-A o a un servicio especializado"
    ],
    "examples": [],
    "homework": "",
    "measures": "C-SSRS, PHQ-9.",
    "extra": []
   }
  ],
  "tests": [
   {
    "name": "C-SSRS (versión desde la última visita)",
    "when": "En cada sesión",
    "why": "Ideación y conducta suicida (Posner et al., 2011). Requiere formación gratuita del desarrollador"
   },
   {
    "name": "Tarjeta diaria",
    "when": "Semanal",
    "why": "Impulsos, autolesiones, emociones y habilidades"
   },
   {
    "name": "PHQ-9 o RCADS",
    "when": "Sesiones 1, 4, 8",
    "why": "Depresión asociada"
   },
   {
    "name": "AUDIT o CRAFFT",
    "when": "Sesión 1",
    "why": "Consumo"
   }
  ],
  "refs": "Linehan et al. (2015); Mehlum et al. (2014); NICE (2022, NG225); Posner et al. (2011); Stanley et al. (2018); Witt et al. (2021); Zalsman et al. (2016)."
 },
 {
  "id": 9,
  "title": "Consumo problemático de alcohol y otras sustancias",
  "intro": "Protocolo basado en entrevista motivacional, intervención breve y prevención de recaídas de corte cognitivo-conductual. Es adecuado para el consumo de riesgo y perjudicial, y como fase inicial en la dependencia, siempre con coordinación médica si hay riesgo de abstinencia.",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**Intervenciones breves:** reducen el consumo de alcohol en bebedores de riesgo y perjudiciales en atención primaria (Kaner et al., 2018). **Certeza: moderada.**",
       "**Entrevista motivacional:** efectos pequeños y duraderos frente a comparaciones débiles, y similares a otros tratamientos activos (Lundahl et al., 2010). **Certeza: moderada.**",
       "**AUDIT:** instrumento de la OMS para identificar el consumo de riesgo y perjudicial (Babor et al., 2001). Existe versión oficial en español."
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Un hombre de 30 años bebe todos los días «para relajarse» y los fines de semana en exceso. Sin signos de abstinencia, elige reducir el consumo. Define cuatro días sin alcohol por semana y un máximo los sábados. En la sesión 4 identifica que bebe para dormir y para «desconectar» del trabajo, y se trabajan el sueño y la actividad física. En la sesión 7 analiza una caída sin abandonar el plan. En la sesión 8 el consumo semanal se redujo y se programan controles mensuales."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Evaluación y devolución motivacional",
    "objective": "evaluar sin confrontar y ofrecer una devolución personalizada.",
    "contents": [
     "Pedido de permiso",
     "Preguntas abiertas",
     "AUDIT y calendario retrospectivo de dos semanas",
     "Consecuencias y riesgo médico",
     "Devolución en formato «pedir permiso, informar, preguntar»",
     "Habilidades de preguntas abiertas, afirmaciones, reflejos y resúmenes"
    ],
    "examples": [
     "¿Le parece si le cuento qué muestran sus respuestas, y usted me dice qué piensa?"
    ],
    "homework": "registro diario de consumo.",
    "measures": "AUDIT, PHQ-9, GAD-7, C-SSRS.",
    "extra": []
   },
   {
    "n": "2",
    "name": "Ambivalencia y balance decisional",
    "objective": "explorar las razones propias para cambiar.",
    "contents": [
     "Balance decisional (capítulo 18)",
     "Reflejo de los dos lados de la ambivalencia",
     "Evocación del discurso de cambio",
     "Regla de importancia y confianza (0–10)"
    ],
    "examples": [
     "Puso un 6 en importancia. ¿Por qué no un 3? ¿Qué haría falta para que fuera un 8?"
    ],
    "homework": "seguir el registro; escribir tres razones personales para cambiar.",
    "measures": "importancia y confianza (0–10).",
    "extra": []
   },
   {
    "n": "3",
    "name": "Objetivo y plan de cambio",
    "objective": "acordar una meta (reducción, abstinencia o reducción de daños) y un plan.",
    "contents": [
     "Meta elegida por la persona",
     "Límites concretos (días sin consumo, cantidad máxima)",
     "Estrategias para cumplirlos (no tener alcohol en casa, alternar con bebidas sin alcohol)",
     "Apoyo de una persona de confianza"
    ],
    "examples": [],
    "homework": "aplicar el plan.",
    "measures": "calendario de consumo.",
    "extra": []
   },
   {
    "n": "4",
    "name": "Situaciones de riesgo y análisis funcional",
    "objective": "identificar los desencadenantes y la función del consumo.",
    "contents": [
     "Análisis funcional de episodios de consumo (capítulo 4): personas, lugares, emociones, horarios",
     "Función (dormir, calmarse, socializar)",
     "Alternativas para cada función"
    ],
    "examples": [
     "Si el alcohol lo ayuda a dormir, ¿qué otra cosa podríamos probar para el sueño?"
    ],
    "homework": "aplicar una alternativa en dos situaciones de riesgo.",
    "measures": "calendario.",
    "extra": []
   },
   {
    "n": "5",
    "name": "Afrontamiento del deseo intenso y rechazo de ofrecimientos",
    "objective": "manejar el deseo intenso de consumir (*craving*) y la presión social.",
    "contents": [
     "«surfear la ola» del deseo",
     "Postergación",
     "Distracción",
     "Ensayo conductual para decir que no"
    ],
    "examples": [
     "Practiquemos qué le va a decir a su amigo cuando le ofrezca otra cerveza."
    ],
    "homework": "registrar los episodios de deseo intenso y la estrategia utilizada.",
    "measures": "calendario e intensidad del deseo.",
    "extra": []
   },
   {
    "n": "6",
    "name": "Emociones, sueño y vínculos",
    "objective": "abordar los mantenedores emocionales y relacionales.",
    "contents": [
     "Regulación emocional (capítulo 9)",
     "TCC-I breve si hay insomnio (protocolo 12)",
     "Actividades placenteras sin consumo",
     "Red de apoyo"
    ],
    "examples": [],
    "homework": "una actividad social sin consumo.",
    "measures": "calendario.",
    "extra": []
   },
   {
    "n": "7",
    "name": "Caídas y prevención de recaídas",
    "objective": "prepararse para las caídas sin que se conviertan en recaídas.",
    "contents": [
     "El efecto de violación de la abstinencia («ya arruiné todo»)",
     "Plan ante una caída",
     "Señales de alerta",
     "Plan semáforo"
    ],
    "examples": [
     "Si un sábado toma más de lo planeado, ¿qué va a hacer el domingo?"
    ],
    "homework": "completar el plan de recaídas.",
    "measures": "calendario.",
    "extra": []
   },
   {
    "n": "8",
    "name": "Evaluación y decisión",
    "objective": "",
    "contents": [
     "AUDIT y calendario comparados con la sesión 1",
     "Devolución",
     "Decisión: alta con seguimiento, continuación o derivación a un servicio especializado si hay dependencia"
    ],
    "examples": [],
    "homework": "",
    "measures": "AUDIT, PHQ-9, GAD-7.",
    "extra": []
   }
  ],
  "tests": [
   {
    "name": "AUDIT",
    "when": "Sesiones 1 y 8",
    "why": "Consumo de alcohol de riesgo, perjudicial y posible dependencia"
   },
   {
    "name": "CRAFFT (adolescentes)",
    "when": "Sesión 1",
    "why": "Cribado en adolescentes (Knight et al., 2002)"
   },
   {
    "name": "Calendario de consumo (registro diario)",
    "when": "Semanal",
    "why": "Cantidad, frecuencia y contexto"
   },
   {
    "name": "PHQ-9 y GAD-7",
    "when": "Sesiones 1 y 8",
    "why": "Comorbilidad"
   },
   {
    "name": "C-SSRS",
    "when": "Sesión 1",
    "why": "Riesgo suicida (mayor con el consumo)"
   }
  ],
  "refs": "Babor et al. (2001); Kaner et al. (2018); Knight et al. (2002); Lundahl et al. (2010); Posner et al. (2011)."
 },
 {
  "id": 10,
  "title": "TDAH en adolescentes y adultos (intervención psicosocial)",
  "intro": "Protocolo de intervención psicosocial centrado en habilidades de organización, gestión del tiempo, manejo de la procrastinación y regulación emocional, más psicoeducación y coordinación. El diagnóstico lo establece un especialista con formación (NICE NG87). Las decisiones sobre medicación corresponden al médico.",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**NICE NG87 (2018, actualizada en 2019):** el diagnóstico de TDAH debe hacerlo un especialista con formación y experiencia. Recomienda considerar tratamientos no farmacológicos y un manejo coordinado. **Certeza: sólida** para los principios.",
       "**Inferencia clínica:** la TCC orientada a habilidades de organización es un complemento razonable en adolescentes y adultos. La evidencia es menor que en población infantil y depende del formato."
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Un adulto de 28 años con dificultades desde la escuela primaria pierde plazos en el trabajo y tiene deudas por compras impulsivas. Duerme bien y no consume. El ASRS es positivo y se deriva a un especialista, que confirma el diagnóstico. En las sesiones 3 y 4 instala una agenda única y bloques de tiempo. En la sesión 6 aplica una pausa de 24 horas antes de compras grandes. En la sesión 8 los plazos incumplidos se redujeron."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Evaluación y diagnóstico diferencial",
    "objective": "descartar explicaciones alternativas y derivar para el diagnóstico si corresponde.",
    "contents": [
     "Historia de síntomas desde la infancia",
     "Impacto funcional concreto",
     "Lista de diagnóstico diferencial (capítulo 19)",
     "ASRS",
     "Cuestionarios de ánimo, ansiedad, sueño y consumo",
     "Derivación a evaluación especializada"
    ],
    "examples": [
     "¿Esto le pasaba también en la escuela primaria? ¿Qué decían sus maestros?"
    ],
    "homework": "registro de una semana de tareas planificadas frente a realizadas.",
    "measures": "ASRS, PHQ-9, GAD-7, ISI, consumo.",
    "extra": []
   },
   {
    "n": "2",
    "name": "Psicoeducación sin culpa",
    "objective": "comprender las dificultades ejecutivas como un patrón tratable, no como falta de voluntad.",
    "contents": [
     "Funciones ejecutivas en lenguaje simple",
     "Corrección de neuromitos (capítulo 5)",
     "Principio de apoyos externos («poner el cerebro afuera»)",
     "Objetivos funcionales con la escala de logro"
    ],
    "examples": [
     "No es pereza. Su cerebro necesita más señales externas para organizarse. Vamos a construir esas señales."
    ],
    "homework": "elegir una sola herramienta de organización (agenda en papel o en el celular).",
    "measures": "objetivos (línea de base).",
    "extra": []
   },
   {
    "n": "3",
    "name": "Sistema de organización",
    "objective": "instalar un sistema único de registro de tareas.",
    "contents": [
     "Una sola lista maestra",
     "Revisión diaria a hora fija",
     "Recordatorios y alarmas",
     "Lugar fijo para los objetos esenciales (llaves, documentos)"
    ],
    "examples": [],
    "homework": "usar el sistema diariamente.",
    "measures": "días de uso del sistema.",
    "extra": []
   },
   {
    "n": "4",
    "name": "Planificación y gestión del tiempo",
    "objective": "estimar el tiempo y planificar.",
    "contents": [
     "Dividir las tareas grandes en pasos de 15 a 30 minutos",
     "Estimar y comparar con el tiempo real",
     "Bloques de tiempo en la agenda",
     "Priorización (urgente/importante)"
    ],
    "examples": [
     "¿Cuánto cree que le lleva? Midámoslo y comparemos."
    ],
    "homework": "planificar la semana en bloques.",
    "measures": "tareas completadas frente a planificadas.",
    "extra": []
   },
   {
    "n": "5",
    "name": "Procrastinación",
    "objective": "reducir la evitación de tareas aburridas o difíciles.",
    "contents": [
     "Análisis funcional de la procrastinación",
     "Regla de «solo cinco minutos»",
     "Reducción de distractores (celular fuera de alcance)",
     "Recompensas inmediatas",
     "Pensamientos que justifican postergar"
    ],
    "examples": [],
    "homework": "aplicar la regla de cinco minutos en dos tareas evitadas.",
    "measures": "objetivos (revisión intermedia).",
    "extra": []
   },
   {
    "n": "6",
    "name": "Regulación emocional e impulsividad",
    "objective": "manejar la frustración y la impulsividad en vínculos y decisiones.",
    "contents": [
     "Pausa antes de actuar (contar o salir unos minutos)",
     "Habilidades de regulación (capítulo 9)",
     "Impulsividad financiera y en la conducción",
     "Comunicación con la pareja o la familia"
    ],
    "examples": [],
    "homework": "aplicar la pausa en una situación de frustración.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "7",
    "name": "Entorno: escuela, trabajo y familia",
    "objective": "acordar apoyos en el entorno.",
    "contents": [
     "Con consentimiento, adaptaciones razonables en la escuela o el trabajo (instrucciones por escrito, plazos fragmentados)",
     "Psicoeducación a la familia o la pareja sin culpabilizar",
     "Plan de mantenimiento"
    ],
    "examples": [],
    "homework": "proponer una adaptación concreta.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "8",
    "name": "Evaluación y decisión",
    "objective": "",
    "contents": [
     "Objetivos funcionales, PHQ-9 y GAD-7",
     "Revisión del estado de la evaluación especializada y de la coordinación médica",
     "Decisión de seguimiento"
    ],
    "examples": [],
    "homework": "",
    "measures": "",
    "extra": []
   }
  ],
  "tests": [
   {
    "name": "ASRS v1.1 (adultos)",
    "when": "Sesión 1",
    "why": "Cribado: cuatro o más respuestas positivas en la parte A sugieren una evaluación completa (Kessler et al., 2005). No diagnóstico"
   },
   {
    "name": "Información de varios informantes (familia, escuela, pareja)",
    "when": "Sesión 1",
    "why": "Síntomas en más de un contexto e inicio en la infancia"
   },
   {
    "name": "PHQ-9 y GAD-7",
    "when": "Sesiones 1 y 8",
    "why": "Diagnóstico diferencial y comorbilidad"
   },
   {
    "name": "ISI o diario de sueño",
    "when": "Sesión 1",
    "why": "La privación de sueño imita síntomas atencionales"
   },
   {
    "name": "AUDIT o CRAFFT",
    "when": "Sesión 1",
    "why": "Consumo"
   },
   {
    "name": "Escala de logro de objetivos funcionales",
    "when": "Sesiones 2, 5, 8",
    "why": "Cambios en la vida diaria (entregas, puntualidad, finanzas)"
   }
  ],
  "refs": "Kessler et al. (2005); NICE (2018, NG87); Bastien et al. (2001)."
 },
 {
  "id": 11,
  "title": "Duelo prolongado",
  "intro": "Protocolo para personas con dificultades marcadas de adaptación a una pérdida. **No está indicado para el duelo esperable**, que suele resolverse con apoyo y tiempo. Integra psicoeducación, exposición a recordatorios evitados, trabajo con la relación continua con el fallecido y reconstrucción de metas.",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**Intervenciones de duelo:** el efecto es pequeño cuando se ofrecen a todos los dolientes, pero comparable a otras psicoterapias cuando se dirigen a personas con dificultades marcadas (Currier et al., 2008). **Certeza: moderada.**",
       "**Criterios diagnósticos:** el trastorno de duelo prolongado figura en la CIE-11 y el DSM-5-TR, con criterios temporales distintos. El PG-13-R se diseñó para corresponder con los criterios del DSM-5-TR (Prigerson et al., 2021)."
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Una mujer de 60 años perdió a su esposo hace dos años y mantiene su habitación intacta. Evita el cementerio y dejó de visitar a sus nietos «porque se parecen a él». Entre las sesiones 3 y 4 relata la muerte y visita el cementerio con su hija. En la sesión 5 trabaja la culpa por no haber insistido en una consulta médica. En la sesión 7 retoma las visitas a sus nietos. En la sesión 8 los síntomas se redujeron y se planifica el aniversario."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Evaluación",
    "objective": "diferenciar el duelo esperable del prolongado y evaluar el riesgo.",
    "contents": [
     "Relato de la pérdida al ritmo del paciente",
     "Tiempo transcurrido, circunstancias y relación",
     "Deterioro funcional",
     "Evitación de recordatorios",
     "PG-13-R, PHQ-9 y riesgo",
     "Recursos culturales y religiosos"
    ],
    "examples": [
     "Cuénteme sobre su esposo: cómo era, qué compartían."
    ],
    "homework": "registrar los momentos de mayor dolor y qué estaba haciendo.",
    "measures": "PG-13-R, PHQ-9, C-SSRS.",
    "extra": []
   },
   {
    "n": "2",
    "name": "Psicoeducación: duelo y oscilación",
    "objective": "comprender el duelo como un proceso y la evitación como mantenedora.",
    "contents": [
     "Modelo de proceso dual (orientación a la pérdida y a la reconstrucción)",
     "Por qué evitar todo recordatorio impide integrar la pérdida",
     "Validar el vínculo continuo"
    ],
    "examples": [
     "No se trata de olvidarlo, sino de encontrar una forma de llevarlo con usted mientras sigue viviendo."
    ],
    "homework": "dedicar un momento diario breve a recordar y otro a una actividad de su vida actual.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "3",
    "name": "Relato de la muerte",
    "objective": "procesar las circunstancias de la muerte.",
    "contents": [
     "Relato detallado y guiado de la muerte y los días posteriores, al ritmo del paciente",
     "Identificación de los puntos de mayor dolor, culpa o rabia"
    ],
    "examples": [],
    "homework": "escribir lo que no pudo decir.",
    "measures": "malestar durante el relato.",
    "extra": []
   },
   {
    "n": "4",
    "name": "Exposición a recordatorios evitados",
    "objective": "reducir la evitación de lugares, objetos y personas.",
    "contents": [
     "Jerarquía (fotos, objetos, la habitación, el cementerio, visitas familiares)",
     "Exposición gradual con un sentido elegido por el paciente"
    ],
    "examples": [],
    "homework": "dos exposiciones de la jerarquía.",
    "measures": "PHQ-9 y evitación.",
    "extra": []
   },
   {
    "n": "5",
    "name": "Culpa y pensamientos sobre la pérdida",
    "objective": "trabajar la culpa y las creencias que bloquean el proceso.",
    "contents": [
     "Examen de la culpa («debí darme cuenta») con lo que se sabía en ese momento",
     "Diálogo imaginario con el fallecido (silla vacía o carta), con cuidado y consentimiento"
    ],
    "examples": [
     "Con lo que usted sabía ese día, ¿qué hubiera podido hacer distinto?"
    ],
    "homework": "carta al fallecido.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "6",
    "name": "Vínculo continuo y recuerdos",
    "objective": "construir una relación de recuerdo que acompañe sin paralizar.",
    "contents": [
     "Rituales personales o religiosos",
     "Memoria de lo que esa persona aportó",
     "Qué parte de ella quiere el paciente llevar a su vida"
    ],
    "examples": [],
    "homework": "diseñar un ritual de recuerdo.",
    "measures": "registro.",
    "extra": []
   },
   {
    "n": "7",
    "name": "Reconstrucción de metas y vínculos",
    "objective": "retomar la vida y los vínculos.",
    "contents": [
     "Metas a corto plazo",
     "Activación conductual (capítulo 8)",
     "Contacto con la red",
     "Fechas difíciles (aniversarios) y plan para ellas"
    ],
    "examples": [],
    "homework": "una actividad nueva o retomada.",
    "measures": "objetivos.",
    "extra": []
   },
   {
    "n": "8",
    "name": "Evaluación y decisión",
    "objective": "",
    "contents": [
     "PG-13-R y PHQ-9",
     "Plan para fechas significativas",
     "Decisión de alta o continuación"
    ],
    "examples": [],
    "homework": "",
    "measures": "PG-13-R, PHQ-9.",
    "extra": []
   }
  ],
  "tests": [
   {
    "name": "PG-13-R",
    "when": "Sesiones 1 y 8",
    "why": "Síntomas de duelo prolongado. Un puntaje de 30 o más mostró buena concordancia con los criterios del DSM en la validación original (Prigerson et al., 2021)"
   },
   {
    "name": "PHQ-9",
    "when": "Sesiones 1, 4, 8",
    "why": "Depresión comórbida"
   },
   {
    "name": "PCL-5",
    "when": "Sesión 1 si la muerte fue violenta o traumática",
    "why": "TEPT comórbido"
   },
   {
    "name": "C-SSRS",
    "when": "Sesión 1 y si aparece deseo de reunirse con el fallecido",
    "why": "Riesgo suicida"
   }
  ],
  "refs": "Blevins et al. (2015); Currier et al. (2008); Posner et al. (2011); Prigerson et al. (2021)."
 },
 {
  "id": 12,
  "title": "Insomnio (TCC-I)",
  "intro": "Protocolo de TCC para el insomnio con control de estímulos, restricción del sueño, trabajo cognitivo e higiene del sueño como complemento. Es útil como tratamiento principal o como componente en la depresión, la ansiedad, el TEPT y el consumo.",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**TCC-I:** efectos significativos en la gravedad del insomnio (g = 0,98), la eficiencia del sueño y la latencia, robustos con y sin comorbilidad (van Straten et al., 2018). Los efectos se mantienen clínicamente relevantes hasta un año (van der Zweerde et al., 2019). **Certeza: sólida.**"
      ]
     }
    ]
   },
   {
    "title": "Criterios para usar este protocolo o derivar",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**Derivar a medicina del sueño:** sospecha de apnea, piernas inquietas o narcolepsia.",
       "**Restricción del sueño contraindicada o con coordinación médica:** trastorno bipolar, epilepsia, riesgo por somnolencia (conductores, maquinaria) y embarazo."
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Una enfermera de 38 años con turnos rotativos pasa nueve horas en la cama y duerme cinco. Antes de la restricción del sueño se evalúa su somnolencia al conducir y se acuerda no manejar después de los turnos nocturnos. Entre las sesiones 2 y 4 aplica el control de estímulos y una ventana de sueño ajustada a sus turnos. En la sesión 5 traslada la preocupación por las tareas a la tarde. En la sesión 8 duerme más tiempo de forma continua y su ISI bajó."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Evaluación",
    "objective": "caracterizar el insomnio y descartar otros trastornos del sueño.",
    "contents": [
     "Historia del sueño",
     "Horarios",
     "Siestas",
     "Cafeína, alcohol y pantallas",
     "Medicación",
     "Preguntas de cribado",
     "ISI, PHQ-9 y GAD-7"
    ],
    "examples": [],
    "homework": "diario de sueño durante una semana.",
    "measures": "ISI, PHQ-9, GAD-7.",
    "extra": []
   },
   {
    "n": "2",
    "name": "Psicoeducación y control de estímulos",
    "objective": "explicar la regulación del sueño e iniciar el control de estímulos.",
    "contents": [
     "Presión de sueño y ritmo circadiano",
     "Cálculo de la eficiencia del sueño con el diario",
     "Reglas del control de estímulos: acostarse solo con sueño, usar la cama solo para dormir, levantarse si no se duerme en unos 20 minutos, horario fijo para levantarse"
    ],
    "examples": [
     "La cama tiene que volver a ser un lugar para dormir, no para preocuparse."
    ],
    "homework": "aplicar el control de estímulos y continuar el diario.",
    "measures": "diario.",
    "extra": []
   },
   {
    "n": "3",
    "name": "Restricción del sueño",
    "objective": "consolidar el sueño ajustando el tiempo en cama.",
    "contents": [
     "Ventana de sueño inicial igual al tiempo promedio dormido (con un mínimo prudente acordado)",
     "Horario de levantarse fijo",
     "Advertencia sobre la somnolencia inicial",
     "Evaluación de seguridad"
    ],
    "examples": [
     "Al principio va a tener más sueño de día. Eso es parte del proceso. Por eso no debe manejar si siente somnolencia."
    ],
    "homework": "respetar la ventana de sueño.",
    "measures": "diario y eficiencia del sueño.",
    "extra": []
   },
   {
    "n": "4",
    "name": "Ajuste de la ventana y pensamientos sobre el sueño",
    "objective": "ajustar la ventana y abordar las creencias disfuncionales.",
    "contents": [
     "Si la eficiencia supera el umbral acordado, ampliar la ventana unos 15 minutos",
     "Examen de creencias («si no duermo 8 horas no voy a funcionar», «tengo que hacer algo para dormirme»)"
    ],
    "examples": [],
    "homework": "continuar la ventana ajustada.",
    "measures": "ISI (control intermedio).",
    "extra": []
   },
   {
    "n": "5",
    "name": "Preocupación nocturna",
    "objective": "reducir la activación cognitiva al acostarse.",
    "contents": [
     "«tiempo de preocupación» por la tarde",
     "Lista de pendientes antes de la rutina nocturna",
     "Rutina de desaceleración de 30 a 60 minutos",
     "Defusión de los pensamientos en la cama"
    ],
    "examples": [],
    "homework": "aplicar el tiempo de preocupación y la rutina.",
    "measures": "diario.",
    "extra": []
   },
   {
    "n": "6",
    "name": "Hábitos y entorno",
    "objective": "ajustar los factores que interfieren.",
    "contents": [
     "Cafeína, alcohol, horarios de comida y actividad física",
     "Luz, ruido y temperatura",
     "Adaptaciones realistas a hogares compartidos o trabajos por turnos"
    ],
    "examples": [],
    "homework": "un cambio de hábito concreto.",
    "measures": "diario.",
    "extra": []
   },
   {
    "n": "7",
    "name": "Consolidación y recaídas",
    "objective": "preparar el mantenimiento.",
    "contents": [
     "Qué hacer ante una mala noche (no compensar con siestas largas ni acostarse temprano; volver al control de estímulos)",
     "Plan de recaídas"
    ],
    "examples": [],
    "homework": "completar el plan.",
    "measures": "diario.",
    "extra": []
   },
   {
    "n": "8",
    "name": "Evaluación y decisión",
    "objective": "",
    "contents": [
     "ISI, PHQ-9 y GAD-7",
     "Eficiencia del sueño comparada con la sesión 1",
     "Decisión"
    ],
    "examples": [],
    "homework": "",
    "measures": "ISI, PHQ-9, GAD-7.",
    "extra": []
   }
  ],
  "tests": [
   {
    "name": "ISI",
    "when": "Sesiones 1, 4, 8",
    "why": "Gravedad del insomnio (0–28). 0–7: sin insomnio clínico; 8–14: subumbral; 15–21: moderado; 22–28: grave (Bastien et al., 2001)"
   },
   {
    "name": "Diario de sueño",
    "when": "Diario, todo el protocolo",
    "why": "Latencia, despertares, tiempo en cama, eficiencia del sueño"
   },
   {
    "name": "PHQ-9 y GAD-7",
    "when": "Sesiones 1 y 8",
    "why": "Comorbilidad"
   },
   {
    "name": "Preguntas de cribado de otros trastornos del sueño",
    "when": "Sesión 1",
    "why": "Ronquidos con pausas, piernas inquietas, somnolencia extrema"
   }
  ],
  "refs": "Bastien et al. (2001); van der Zweerde et al. (2019); van Straten et al. (2018)."
 },
 {
  "id": 13,
  "title": "EMDR estándar de ocho fases (trauma)",
  "intro": "Protocolo de desensibilización y reprocesamiento por movimientos oculares (EMDR) para el estrés postraumático y para recuerdos que mantienen síntomas. Sigue las ocho fases del modelo de Shapiro y el abordaje de tres tiempos: pasado, presente y futuro. **Requiere formación en EMDR y supervisión (nivel B).** El esquema de ocho sesiones es orientativo para un trauma único; la cantidad real depende de cuántos recuerdos se trabajen (NICE menciona alrededor de 8 a 12 sesiones, y más si hace falta).",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**NICE NG116 (2018):** ofrecer EMDR a adultos con TEPT o síntomas importantes que consultan más de 3 meses después de un trauma no relacionado con combate; considerarlo entre 1 y 3 meses si la persona lo prefiere. No ofrecer debriefing psicológico. **Certeza: moderada a sólida.**",
       "**OMS (2013; mhGAP 2023):** TCC focalizada en el trauma o EMDR como tratamientos psicológicos del TEPT. **Certeza: moderada a sólida.**",
       "**VA/DoD (2023):** incluye el EMDR entre las psicoterapias recomendadas para el TEPT, junto con la terapia de procesamiento cognitivo y la exposición prolongada.",
       "**ISTSS (2019):** incluye el EMDR entre los tratamientos efectivos para el TEPT en adultos.",
       "**Lo que sigue en discusión:** el aporte específico de los movimientos oculares frente al resto del procedimiento. Los estudios muestran una eficacia comparable a otras terapias focalizadas en el trauma, sin superioridad demostrada. **Certeza: moderada.**"
      ]
     }
    ]
   },
   {
    "title": "Criterios para usar este protocolo o derivar",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**Usar:** TEPT o síntomas postraumáticos con uno o más recuerdos identificables que mantienen el malestar; amenaza actual controlada; el paciente usa al menos dos recursos de regulación de forma autónoma; hay alianza suficiente; el terapeuta tiene formación y supervisión.",
       "**Estabilizar primero (no pasar a la fase 3):** riesgo suicida alto o autolesiones activas; consumo activo y descontrolado; violencia o amenaza vigente; disociación marcada (derivar a evaluación especializada); una crisis vital que desborda.",
       "**Coordinar con el médico:** psicosis; epilepsia; enfermedad cardíaca o respiratoria grave; embarazo con complicaciones; cualquier condición en la que la activación pueda ser un riesgo."
      ]
     },
     {
      "k": "note",
      "t": "**Precaución clínica.** No se procesa material traumático sin formación ni supervisión en EMDR. Un procesamiento mal conducido puede aumentar el malestar, la disociación y el abandono del tratamiento."
     }
    ]
   },
   {
    "title": "Las ocho fases de un vistazo",
    "blocks": [
     {
      "k": "table",
      "h": [
       "Fase",
       "Qué se hace",
       "Qué se registra"
      ],
      "r": [
       [
        "**1. Historia y planificación**",
        "Historia del trauma y de los síntomas, riesgo, consumo y disociación; lista de recuerdos del pasado, disparadores del presente y situaciones temidas del futuro.",
        "PCL-5, PHQ-9, riesgo suicida, cribado de disociación"
       ],
       [
        "**2. Preparación**",
        "Psicoeducación, lugar seguro o contenedor, señal de pare, ventana de tolerancia.",
        "Recursos que funcionan"
       ],
       [
        "**3. Evaluación**",
        "Imagen que representa lo peor, creencia negativa, creencia positiva, emoción y sensación corporal.",
        "SUD (0 a 10) y VOC (1 a 7) iniciales"
       ],
       [
        "**4. Desensibilización**",
        "Series de estimulación bilateral y observación de lo que surge, sin dirigir el contenido.",
        "SUD después de cada serie, hasta 0 o un nivel ecológicamente válido"
       ],
       [
        "**5. Instalación**",
        "Fortalecer la creencia positiva con estimulación.",
        "VOC (meta: 6 o 7)"
       ],
       [
        "**6. Escaneo corporal**",
        "Recuerdo y creencia positiva juntos, buscando tensión residual.",
        "Sensación corporal residual"
       ],
       [
        "**7. Cierre**",
        "Al final de cada sesión: contención y aviso de lo que puede aparecer entre sesiones.",
        "Estado al salir; SUD si quedó abierto"
       ],
       [
        "**8. Reevaluación**",
        "Al inicio de la sesión siguiente: ¿se sostiene el cambio?",
        "SUD del recuerdo anterior; PCL-5 periódico"
       ]
      ]
     }
    ]
   },
   {
    "title": "Reglas de decisión durante el procesamiento",
    "blocks": [
     {
      "k": "table",
      "h": [
       "Situación",
       "Decisión"
      ],
      "r": [
       [
        "El SUD no baja después de varias series o el procesamiento se detiene",
        "Considerar un entrelazado cognitivo con un dato o una creencia nueva. Si persiste, revisar si hay un recuerdo anterior, una creencia de fondo o falta de preparación."
       ],
       [
        "Activación muy intensa que sale de la ventana de tolerancia",
        "Bajar el ritmo, volver al presente con anclaje y recursos de la fase 2, y valorar si hace falta más estabilización."
       ],
       [
        "Disociación durante la sesión",
        "Detener el procesamiento, reorientar al presente y cerrar. Evaluar antes de retomar; derivar si es marcada."
       ],
       [
        "Se acaba el tiempo con el recuerdo abierto",
        "Cierre con contención, registrar el SUD y avisar qué puede aparecer entre sesiones. Retomar en la siguiente."
       ],
       [
        "Aparecen ideas de hacerse daño durante o después",
        "Evaluar el riesgo antes de que la persona se retire y activar el plan de seguridad (protocolo 8)."
       ],
       [
        "Sin cambio tras varias sesiones y sin descenso de la PCL-5",
        "Reevaluar el diagnóstico, la preparación y la adecuación del tratamiento. Considerar TCC focalizada en el trauma (protocolo 7)."
       ]
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Un hombre de 35 años presenta síntomas postraumáticos desde un accidente de tránsito ocurrido hace ocho meses: imágenes repetidas, evitación de manejar y sueño interrumpido. En las sesiones 1 y 2 se evalúa el riesgo, se aplica la PCL-5 (48 puntos) y se practica el lugar seguro. En la sesión 3 se elige la imagen del impacto, con la creencia negativa «estoy en peligro», la positiva «ahora estoy a salvo», VOC 2 y SUD 8. Entre las sesiones 3 y 5 el SUD baja a 1 y el VOC sube a 6. En la sesión 7 trabaja la plantilla futura de volver a manejar, y en la sesión 8 la PCL-5 es de 24."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Fase 1: historia clínica, riesgo y planificación",
    "objective": "conocer la historia, evaluar la seguridad y elegir los recuerdos con los que se va a trabajar.",
    "contents": [
     "Encuadre de control: el paciente decide cuánto cuenta",
     "Historia breve del evento y de los síntomas, sin relato detallado",
     "Cribado de riesgo suicida, consumo y amenaza actual",
     "PCL-5, PHQ-9 y cribado de disociación",
     "Lista de recuerdos objetivo: pasado, presente (disparadores) y futuro (situaciones temidas)",
     "Decisión compartida sobre el tratamiento, con información sobre la evidencia"
    ],
    "examples": [
     "No necesito que me cuente el recuerdo completo. Con una idea general de lo que pasó y de cómo le afecta hoy, alcanza para empezar."
    ],
    "homework": "registrar los momentos de malestar y sus disparadores durante la semana.",
    "measures": "PCL-5, PHQ-9, C-SSRS de cribado, escala de experiencias disociativas (DES-II).",
    "extra": []
   },
   {
    "n": "2",
    "name": "Fase 2: preparación y estabilización",
    "objective": "dar recursos para tolerar la activación y acordar cómo se trabaja.",
    "contents": [
     "Psicoeducación sobre el trauma y sobre el procedimiento: qué se hace y qué puede aparecer",
     "Lugar seguro o contenedor, practicado con estimulación bilateral lenta",
     "Señal de pare: el paciente puede interrumpir cuando quiera",
     "Ventana de tolerancia: reconocer activación alta y baja",
     "Sueño y consumo (protocolos 12 y 9)"
    ],
    "examples": [
     "Usted conduce el ritmo. Si en algún momento quiere parar, levante la mano y paramos."
    ],
    "homework": "practicar el recurso elegido una vez por día.",
    "measures": "uso y utilidad del recurso; PHQ-9 si cambia el ánimo.",
    "extra": [
     {
      "k": "note",
      "t": "**Criterio para avanzar:** usa al menos dos recursos de forma autónoma, hay alianza suficiente y no hay riesgo agudo. Si no se cumple, se extiende la fase 2."
     }
    ]
   },
   {
    "n": "3",
    "name": "Fase 3 y comienzo de la fase 4: evaluación del recuerdo",
    "objective": "definir el recuerdo objetivo y sus componentes de base.",
    "contents": [
     "Elegir el primer recuerdo (el más temprano o el peor, según el caso)",
     "Imagen que representa lo peor, creencia negativa, creencia positiva deseada y VOC (1 a 7)",
     "Emoción, SUD (0 a 10) y localización en el cuerpo",
     "Inicio de la desensibilización si hay tiempo y el paciente está estable",
     "Cierre de la sesión con contención"
    ],
    "examples": [
     "Cuando piensa en ese recuerdo, ¿qué imagen representa lo peor? ¿Qué frase negativa sobre usted aparece ahora?"
    ],
    "homework": "anotar sueños, recuerdos o emociones que aparezcan.",
    "measures": "SUD, VOC, PCL-5 cada dos semanas.",
    "extra": []
   },
   {
    "n": "4",
    "name": "Fase 4: desensibilización",
    "objective": "reducir la carga del recuerdo con series de estimulación bilateral.",
    "contents": [
     "Series de estimulación bilateral con observación de lo que surge, sin dirigir el contenido",
     "Control del SUD entre series; volver al recuerdo original cuando las asociaciones se alejan",
     "Entrelazado cognitivo si el procesamiento se detiene",
     "Seguimiento de la ventana de tolerancia",
     "Cierre con contención si no se completó"
    ],
    "examples": [
     "Simplemente note lo que viene. Deje que pase lo que tenga que pasar y avíseme si algo cambia."
    ],
    "homework": "anotar lo que aparezca y usar los recursos de la fase 2.",
    "measures": "SUD al final de cada serie y al cierre.",
    "extra": []
   },
   {
    "n": "5",
    "name": "Fases 5 y 6: instalación y escaneo corporal",
    "objective": "fortalecer la creencia positiva y comprobar que no queda tensión corporal.",
    "contents": [
     "Con el SUD en 0 o ecológicamente válido, volver al recuerdo y a la creencia positiva",
     "Instalación con estimulación hasta que el VOC sea 6 o 7",
     "Escaneo corporal: recuerdo y creencia positiva, buscando tensión residual",
     "Procesar la sensación residual si aparece",
     "Cierre"
    ],
    "examples": [
     "Piense en el recuerdo y en la frase «ahora estoy a salvo». ¿Cuánto la siente verdadera, de 1 a 7?"
    ],
    "homework": "notar situaciones en las que la nueva creencia se sostiene.",
    "measures": "VOC, SUD y sensación corporal residual.",
    "extra": []
   },
   {
    "n": "6",
    "name": "Fase 8: reevaluación y siguiente recuerdo",
    "objective": "comprobar que el cambio se sostiene y pasar al siguiente objetivo.",
    "contents": [
     "Revisión del recuerdo anterior: SUD y VOC",
     "PCL-5 de seguimiento",
     "Evaluación y procesamiento del siguiente recuerdo del pasado o del presente",
     "Revisión de lo ocurrido entre sesiones",
     "Cierre"
    ],
    "examples": [
     "La semana pasada ese recuerdo estaba en 8. Hoy, cuando lo piensa, ¿cuánto le molesta?"
    ],
    "homework": "seguir con el registro y con los recursos.",
    "measures": "SUD y VOC del recuerdo anterior, PCL-5.",
    "extra": []
   },
   {
    "n": "7",
    "name": "Presente y futuro: disparadores y plantilla futura",
    "objective": "procesar los disparadores actuales y ensayar el afrontamiento de las situaciones temidas.",
    "contents": [
     "Disparadores presentes que todavía generan malestar",
     "Plantilla futura: imaginar la situación temida afrontada con un recurso o una conducta nueva",
     "Exposición gradual en la vida real a lo evitado, con registro",
     "Cierre"
    ],
    "examples": [
     "Imagine que vuelve a esa situación dentro de una semana. ¿Cómo le gustaría estar ahí?"
    ],
    "homework": "una situación evitada por semana, con registro de SUD antes y después.",
    "measures": "SUD de los disparadores y de la situación futura.",
    "extra": []
   },
   {
    "n": "8",
    "name": "Fase 8: reevaluación final y prevención de recaídas",
    "objective": "medir el cambio y planificar el seguimiento.",
    "contents": [
     "PCL-5 y PHQ-9, comparados con la sesión 1",
     "Revisión de lo aprendido y de lo que cambió",
     "Plan de recaídas: señales de alerta y qué hacer",
     "Seguimiento al mes y a los tres meses",
     "Si los síntomas persisten, decidir otro tratamiento focalizado en el trauma (protocolo 7)"
    ],
    "examples": [
     "En la primera sesión su puntaje era alto. Hoy bajó bastante. ¿Qué nota distinto en su vida?"
    ],
    "homework": "mantener la exposición gradual a lo evitado y usar el plan de recaídas.",
    "measures": "PCL-5, PHQ-9.",
    "extra": []
   }
  ],
  "tests": [
   {
    "name": "PCL-5",
    "when": "Sesión 1, cada 2 a 4 sesiones y sesión 8",
    "why": "Gravedad del TEPT y cambio"
   },
   {
    "name": "PHQ-9",
    "when": "Sesiones 1 y 8",
    "why": "Depresión comórbida; revisar siempre el ítem 9"
   },
   {
    "name": "C-SSRS (versión de cribado)",
    "when": "Sesión 1 y siempre que haya riesgo",
    "why": "Ideación y conducta suicida"
   },
   {
    "name": "Escala de experiencias disociativas (DES-II)",
    "when": "Sesión 1",
    "why": "Cribado de disociación antes de procesar"
   },
   {
    "name": "SUD y VOC",
    "when": "En cada recuerdo trabajado",
    "why": "Malestar subjetivo (0 a 10) y validez de la creencia positiva (1 a 7)"
   }
  ],
  "refs": "Shapiro (2018); Organización Mundial de la Salud (2013); NICE (2018, NG116); VA/DoD (2023); ISTSS (2019); Lewis et al. (2020). Verificar los datos de cada referencia antes de citarla en un documento formal."
 },
 {
  "id": 14,
  "title": "EMDR para eventos traumáticos recientes (R-TEP)",
  "intro": "Intervención temprana con EMDR para quien vive un episodio traumático reciente, desde los primeros días hasta unas semanas después. Sigue el esquema del protocolo de episodio traumático reciente (R-TEP, Shapiro y Laub): narración del episodio con estimulación bilateral lenta, búsqueda de puntos de perturbación y procesamiento escalonado. **Requiere formación específica en EMDR y en R-TEP (nivel B). La evidencia es preliminar:** en los primeros días la prioridad es la seguridad y el apoyo, y las guías priorizan otras opciones durante el primer mes.",
  "sections": [
   {
    "title": "Guías de referencia y certeza",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**NICE NG116 (2018):** durante el primer mes, para estrés agudo o síntomas postraumáticos importantes, considerar TCC focalizada en el trauma. EMDR entre 1 y 3 meses solo si la persona lo prefiere. No ofrecer debriefing psicológico. **Certeza: moderada.**",
       "**EMDR temprano:** una revisión sistemática con metaanálisis de 11 ensayos aleatorizados en personas expuestas a un evento en los 3 meses previos encontró beneficio en los síntomas postraumáticos al terminar y a los 3 meses, sin diferencias en los demás momentos ni frente a otras intervenciones. Calidad baja, pocos estudios y muestras pequeñas. **Certeza: baja.**",
       "**R-TEP:** la base de evidencia son sobre todo descripciones de casos y estudios pequeños. **Certeza: baja.** Por eso se informa al paciente y se acuerda la elección.",
       "**Evolución natural:** una parte importante de las reacciones agudas disminuye sin tratamiento específico. En las primeras horas y días corresponden los primeros auxilios psicológicos: seguridad, necesidades básicas, apoyo social e información."
      ]
     }
    ]
   },
   {
    "title": "Criterios para usar este protocolo o derivar",
    "blocks": [
     {
      "k": "ul",
      "i": [
       "**Usar:** episodio traumático reciente (de días a pocas semanas, según el criterio del terapeuta); amenaza actual controlada; necesidades básicas cubiertas; síntomas que persisten o interfieren (insomnio, reexperimentación, evitación); el paciente fue informado y prefiere esta opción.",
       "**Acompañar y estabilizar primero:** crisis aguda sin seguridad, primeras horas o días tras el evento, lesión médica pendiente de atender.",
       "**Derivar o coordinar:** riesgo suicida alto (protocolo 8), psicosis, disociación marcada, consumo descontrolado, violencia vigente (priorizar la protección)."
      ]
     },
     {
      "k": "note",
      "t": "**Precaución clínica.** Esta intervención no es un debriefing: no se pide un relato detallado en la primera sesión ni se procesa antes de la preparación. Sin formación específica en EMDR y R-TEP, se ofrece apoyo y estabilización, o se deriva."
     }
    ]
   },
   {
    "title": "Pasos del protocolo",
    "blocks": [
     {
      "k": "table",
      "h": [
       "Paso",
       "Qué se hace",
       "Qué se registra"
      ],
      "r": [
       [
        "**Fase 1: historia**",
        "Historia breve: gravedad, motivación y recursos.",
        "PCL-5 si pasó más de un mes; riesgo"
       ],
       [
        "**Fase 2: preparación**",
        "Contención, lugar calmo, cuatro elementos y señal de pare.",
        "Recursos que funcionan"
       ],
       [
        "**Narración del episodio**",
        "El paciente cuenta el episodio en voz alta con estimulación bilateral lenta y continua. Nunca durante las fases 1 y 2.",
        "Dónde sube la perturbación"
       ],
       [
        "**Búsqueda de puntos de perturbación**",
        "Recorrer el episodio sin orden cronológico, con estimulación lenta, hasta encontrar el primer punto de perturbación.",
        "Punto identificado"
       ],
       [
        "**Procesamiento escalonado**",
        "Por cada punto: evaluación, desensibilización, instalación y cierre. Se empieza por la forma más contenida (EMD) y se avanza (EMDr, EMDR) solo si el paciente se mantiene en su ventana de tolerancia.",
        "SUD de cada punto"
       ],
       [
        "**Nivel episodio**",
        "SUD del episodio completo, qué aprendió, creencia positiva, instalación y escaneo corporal.",
        "SUD y VOC del episodio"
       ],
       [
        "**Cierre y reevaluación**",
        "Cierre ampliado y seguimiento.",
        "Síntomas, sueño, PCL-5 si corresponde"
       ]
      ]
     }
    ]
   },
   {
    "title": "Reglas de decisión",
    "blocks": [
     {
      "k": "table",
      "h": [
       "Situación",
       "Decisión"
      ],
      "r": [
       [
        "Mucha activación al narrar el episodio",
        "Volver al presente y a los recursos; narrar de forma más breve y con estimulación más lenta. No avanzar."
       ],
       [
        "No se identifica un punto de perturbación claro",
        "Repetir la búsqueda con estimulación lenta, preguntando por la parte más difícil. No forzar."
       ],
       [
        "Aparecen ideas suicidas o riesgo",
        "Evaluar y activar el plan de seguridad (protocolo 8) antes de seguir."
       ],
       [
        "Los síntomas no ceden tras varias sesiones o ya pasaron 3 meses",
        "Reevaluar y pasar a un tratamiento con más evidencia: EMDR estándar (protocolo 13) o TCC focalizada en el trauma (protocolo 7)."
       ]
      ]
     }
    ]
   },
   {
    "title": "Ejemplo clínico (caso didáctico compuesto)",
    "blocks": [
     {
      "k": "p",
      "t": "Una mujer de 28 años sufrió un asalto con arma hace tres semanas. Tiene insomnio, sobresaltos y evita la calle donde ocurrió. En la sesión 1 se confirma que está a salvo y se acuerda esta intervención tras explicar el nivel de evidencia. En la sesión 3 cuenta el episodio con estimulación lenta y el punto de mayor perturbación es el momento en que el agresor se acerca. En la sesión 4 el SUD de ese punto baja de 9 a 1 con procesamiento escalonado. En la sesión 6 el SUD del episodio es 1 y la creencia positiva es «sobreviví y me protegí». En la sesión 7 duerme mejor y retoma el camino habitual."
     }
    ]
   }
  ],
  "sessions": [
   {
    "n": "1",
    "name": "Seguridad y evaluación inicial",
    "objective": "confirmar que no hay amenaza actual, evaluar necesidades y decidir con el paciente si esta intervención es adecuada.",
    "contents": [
     "Encuadre de control e información sobre el nivel de evidencia",
     "Seguridad actual, necesidades básicas y apoyo social",
     "Historia breve del episodio y de los síntomas, sin relato detallado",
     "Riesgo suicida, consumo y sueño",
     "PCL-5 si pasó más de un mes",
     "Decisión compartida: esta intervención u otra opción (por ejemplo, TCC focalizada en el trauma)"
    ],
    "examples": [
     "Lo que vivió fue muy fuerte y sus reacciones son comprensibles. Hoy no necesita contarme todo: primero me interesa saber cómo está y qué necesita."
    ],
    "homework": "dormir y comer con regularidad, mantener contacto con una persona de confianza y anotar los momentos de mayor malestar.",
    "measures": "PCL-5 (si corresponde), C-SSRS de cribado, sueño.",
    "extra": []
   },
   {
    "n": "2",
    "name": "Preparación y contención",
    "objective": "dar recursos para tolerar el relato y los recuerdos.",
    "contents": [
     "Psicoeducación: las reacciones agudas son comunes y muchas ceden con el tiempo",
     "Contenedor, lugar calmo y cuatro elementos",
     "Señal de pare y ventana de tolerancia",
     "Sueño y rutinas (protocolo 12)"
    ],
    "examples": [
     "Usted decide el ritmo. Si algo es demasiado, paramos y volvemos a lo que lo calma."
    ],
    "homework": "practicar el recurso elegido una vez por día.",
    "measures": "uso y utilidad del recurso.",
    "extra": []
   },
   {
    "n": "3",
    "name": "Narración del episodio y puntos de perturbación",
    "objective": "contar el episodio con estimulación lenta e identificar dónde está la mayor perturbación.",
    "contents": [
     "Narración del episodio completo en voz alta, con estimulación bilateral lenta y continua",
     "Recorrido no secuencial hasta identificar el primer punto de perturbación",
     "Evaluación del punto: imagen, creencia, emoción, SUD y sensación corporal",
     "Cierre ampliado"
    ],
    "examples": [
     "Cuénteme lo que pasó desde el principio, a su ritmo. Si algo es muy difícil, lo marcamos y seguimos."
    ],
    "homework": "usar los recursos y anotar lo que aparezca.",
    "measures": "SUD del primer punto de perturbación.",
    "extra": []
   },
   {
    "n": "4",
    "name": "Procesamiento escalonado",
    "objective": "reducir la perturbación de cada punto con el nivel de procesamiento que tolere el paciente.",
    "contents": [
     "Empezar por la forma más contenida y avanzar solo si el paciente permanece en su ventana de tolerancia",
     "Desensibilización hasta SUD 0 o ecológicamente válido",
     "Instalación de la creencia positiva del punto",
     "Cierre ampliado"
    ],
    "examples": [
     "Note lo que viene, sin forzar nada. Si se hace muy intenso, me avisa."
    ],
    "homework": "anotar lo que aparezca y usar los recursos.",
    "measures": "SUD de cada punto.",
    "extra": []
   },
   {
    "n": "5",
    "name": "Siguientes puntos de perturbación",
    "objective": "repetir la búsqueda y el procesamiento hasta cubrir los puntos relevantes.",
    "contents": [
     "Nueva búsqueda de puntos de perturbación",
     "Procesamiento escalonado de cada punto",
     "Revisión de lo ocurrido entre sesiones",
     "Cierre ampliado"
    ],
    "examples": [],
    "homework": "registrar sueño y reacciones.",
    "measures": "SUD de cada punto; síntomas.",
    "extra": []
   },
   {
    "n": "6",
    "name": "Nivel episodio",
    "objective": "cerrar el episodio como un todo.",
    "contents": [
     "SUD del episodio completo",
     "Qué aprendió el paciente del episodio y creencia positiva",
     "Instalación de la creencia positiva y escaneo corporal",
     "Cierre"
    ],
    "examples": [
     "Cuando piensa en todo lo que pasó, ¿qué siente ahora?, ¿qué aprendió de usted?"
    ],
    "homework": "retomar actividades evitadas que sean seguras.",
    "measures": "SUD y VOC del episodio.",
    "extra": []
   },
   {
    "n": "7",
    "name": "Reevaluación y seguimiento",
    "objective": "comprobar el cambio y decidir si hace falta otro tratamiento.",
    "contents": [
     "Síntomas, sueño y funcionamiento",
     "PCL-5 si pasó más de un mes del evento",
     "Plan de seguimiento al mes y a los tres meses",
     "Si los síntomas persisten, pasar al protocolo 13 o a TCC focalizada en el trauma (protocolo 7)"
    ],
    "examples": [
     "Si más adelante vuelven las pesadillas o el miedo, avíseme: es parte de cómo se cuida uno después de algo así."
    ],
    "homework": "mantener rutinas de sueño, actividad y contacto social.",
    "measures": "PCL-5 (si corresponde), sueño.",
    "extra": []
   }
  ],
  "tests": [
   {
    "name": "PCL-5",
    "when": "Sesión 1 si pasó más de un mes, y sesión 7",
    "why": "Gravedad y cambio"
   },
   {
    "name": "C-SSRS (versión de cribado)",
    "when": "Sesión 1 y siempre que haya riesgo",
    "why": "Ideación y conducta suicida"
   },
   {
    "name": "PHQ-9",
    "when": "Sesiones 1 y 7",
    "why": "Ánimo; revisar el ítem 9"
   },
   {
    "name": "SUD y VOC",
    "when": "En cada punto de perturbación y en el episodio",
    "why": "Malestar subjetivo (0 a 10) y validez de la creencia positiva (1 a 7)"
   }
  ],
  "refs": "Shapiro y Laub (2008); NICE (2018, NG116); Organización Mundial de la Salud (2013); revisión sistemática con metaanálisis de EMDR temprano (11 ensayos; verificar autores y año antes de citar). Verificar los datos de cada referencia antes de citarla en un documento formal."
 }
];
