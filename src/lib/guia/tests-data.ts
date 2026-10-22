// Generado a partir de la Guía clínica avanzada. Editar a mano para ajustar el contenido.
/** Tamizajes y escalas de uso libre (sin licencia). */
import type { TestDef } from "./types";

export const TESTS: TestDef[] = [
 {
  "id": "asq",
  "domain": "Suicidio",
  "name": "ASQ",
  "full": "Ask Suicide-Screening Questions (NIMH)",
  "who": "adolescentes (también adultos)",
  "license": "Dominio público (NIMH)",
  "intro": "Cinco preguntas. Si hay algún «sí» (o no responde) en los ítems 1 a 4, se pregunta el ítem 5. Resultado: negativo, positivo no agudo o positivo agudo.",
  "kind": "asq",
  "options": [
   {
    "value": "si",
    "label": "Sí"
   },
   {
    "value": "no",
    "label": "No"
   },
   {
    "value": "nr",
    "label": "No responde"
   }
  ],
  "items": [
   {
    "text": "En las últimas semanas, ¿has deseado estar muerto/a?"
   },
   {
    "text": "En las últimas semanas, ¿has sentido que tú o tu familia estarían mejor si tú estuvieras muerto/a?"
   },
   {
    "text": "En la última semana, ¿has estado pensando en suicidarte?"
   },
   {
    "text": "¿Alguna vez has intentado suicidarte? (si responde sí: ¿cómo?, ¿cuándo?)"
   },
   {
    "text": "Solo si hubo algún sí antes: ¿estás pensando en suicidarte en este momento?"
   }
  ],
  "max": 5,
  "note": "El ítem 5 solo se pregunta si hubo algún sí en los anteriores. Un positivo exige la evaluación breve de seguridad antes de que la persona se retire; un negativo no descarta el riesgo."
 },
 {
  "id": "plut",
  "domain": "Suicidio",
  "name": "Plutchik",
  "full": "Escala de riesgo suicida de Plutchik",
  "who": "adultos",
  "license": "Publicada; versión española validada (Rubio et al., 1998)",
  "intro": "Responda Sí o No.",
  "kind": "yn",
  "options": [
   {
    "value": "si",
    "label": "Sí"
   },
   {
    "value": "no",
    "label": "No"
   }
  ],
  "items": [
   {
    "text": "¿Toma de forma habitual algún medicamento como aspirinas o pastillas para dormir?",
    "key": "si"
   },
   {
    "text": "¿Tiene dificultades para conciliar el sueño?",
    "key": "si"
   },
   {
    "text": "¿A veces nota que podría perder el control sobre sí mismo/a?",
    "key": "si"
   },
   {
    "text": "¿Tiene poco interés en relacionarse con la gente?",
    "key": "si"
   },
   {
    "text": "¿Ve su futuro con más pesimismo que optimismo?",
    "key": "si"
   },
   {
    "text": "¿Se ha sentido alguna vez inútil o sin valor?",
    "key": "si"
   },
   {
    "text": "¿Ve su futuro sin ninguna esperanza?",
    "key": "si"
   },
   {
    "text": "¿Se ha sentido alguna vez tan fracasado/a que solo quería meterse en la cama y abandonarlo todo?",
    "key": "si"
   },
   {
    "text": "¿Está deprimido/a ahora?",
    "key": "si"
   },
   {
    "text": "¿Está separado/a, divorciado/a o viudo/a?",
    "key": "si"
   },
   {
    "text": "¿Sabe si alguien de su familia ha intentado suicidarse alguna vez?",
    "key": "si"
   },
   {
    "text": "¿Alguna vez se ha sentido tan enfadado/a que habría sido capaz de matar a alguien?",
    "key": "si"
   },
   {
    "text": "¿Ha pensado alguna vez en suicidarse?",
    "key": "si"
   },
   {
    "text": "¿Le ha comentado a alguien, en alguna ocasión, que quería suicidarse?",
    "key": "si"
   },
   {
    "text": "¿Ha intentado alguna vez quitarse la vida?",
    "key": "si"
   }
  ],
  "max": 15,
  "note": "Corte 6. Validada en adultos; en menores de 18 años use el ASQ. Un positivo pide explorar ideación, intención y plan.",
  "bands": [
   {
    "upTo": 5,
    "label": "por debajo del corte (6)",
    "level": "ok"
   },
   {
    "upTo": 15,
    "label": "positiva (corte ≥ 6): explorar ideación, intención y plan",
    "level": "warn"
   }
  ],
  "flags": [
   {
    "item": 12,
    "when": {
     "is": "si"
    },
    "level": "crit",
    "text": "Ítem 13 afirmativo (ha pensado en suicidarse): explorar ideación, intención y plan en esta consulta y registrar el plan de seguridad."
   },
   {
    "item": 14,
    "when": {
     "is": "si"
    },
    "level": "crit",
    "text": "Ítem 15 afirmativo (intento previo): evaluar la seguridad actual y los antecedentes del intento en esta consulta."
   }
  ]
 },
 {
  "id": "phq9",
  "domain": "Depresión",
  "name": "PHQ-9",
  "full": "Cuestionario sobre la salud del paciente",
  "who": "adolescentes y adultos (el PHQ-A tiene redacción adaptada)",
  "license": "Libre, sin permiso",
  "intro": "Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?",
  "note": "Orienta la gravedad y el cambio; no diagnostica. Un puntaje alto exige entrevista clínica.",
  "kind": "sum",
  "options": [
   {
    "value": "0",
    "label": "Ningún día"
   },
   {
    "value": "1",
    "label": "Varios días"
   },
   {
    "value": "2",
    "label": "Más de la mitad de los días"
   },
   {
    "value": "3",
    "label": "Casi todos los días"
   }
  ],
  "items": [
   {
    "text": "Poco interés o placer en hacer cosas"
   },
   {
    "text": "Se ha sentido decaído/a, deprimido/a o sin esperanzas"
   },
   {
    "text": "Dificultad para quedarse o permanecer dormido/a, o ha dormido demasiado"
   },
   {
    "text": "Se ha sentido cansado/a o con poca energía"
   },
   {
    "text": "Sin apetito o ha comido en exceso"
   },
   {
    "text": "Se ha sentido mal consigo mismo/a, o que es un fracaso, o que ha quedado mal con usted mismo/a o con su familia"
   },
   {
    "text": "Dificultad para concentrarse en actividades como leer o ver televisión"
   },
   {
    "text": "Se ha movido o hablado tan lento que otras personas podrían notarlo; o lo contrario: ha estado tan inquieto/a o agitado/a que se ha movido mucho más de lo normal"
   },
   {
    "text": "Pensamientos de que estaría mejor muerto/a o de lastimarse de alguna manera"
   }
  ],
  "max": 27,
  "bands": [
   {
    "upTo": 4,
    "label": "mínima",
    "level": "ok"
   },
   {
    "upTo": 9,
    "label": "leve",
    "level": "ok"
   },
   {
    "upTo": 14,
    "label": "moderada",
    "level": "warn"
   },
   {
    "upTo": 19,
    "label": "moderadamente grave",
    "level": "crit"
   },
   {
    "upTo": 27,
    "label": "grave",
    "level": "crit"
   }
  ],
  "flags": [
   {
    "item": 8,
    "when": {
     "gt": 0
    },
    "level": "crit",
    "text": "Ítem 9 mayor que 0: evaluar el riesgo suicida en esta consulta (ASQ, Plutchik o C-SSRS) y registrar el plan de seguridad."
   }
  ],
  "reportItem": 8
 },
 {
  "id": "gds15",
  "domain": "Depresión",
  "name": "GDS-15",
  "full": "Escala de depresión geriátrica, versión breve",
  "who": "adultos mayores",
  "license": "Dominio público",
  "intro": "Responda Sí o No según cómo se ha sentido durante la última semana.",
  "note": "Puntúa 1 cada respuesta en el sentido de depresión (ítems 1, 5, 7, 11 y 13 puntúan con «No»). En personas con deterioro cognitivo importante, interpretar con cautela.",
  "kind": "yn",
  "options": [
   {
    "value": "si",
    "label": "Sí"
   },
   {
    "value": "no",
    "label": "No"
   }
  ],
  "items": [
   {
    "text": "¿Está básicamente satisfecho/a con su vida?",
    "key": "no"
   },
   {
    "text": "¿Ha abandonado muchas de sus actividades e intereses?",
    "key": "si"
   },
   {
    "text": "¿Siente que su vida está vacía?",
    "key": "si"
   },
   {
    "text": "¿Se aburre con frecuencia?",
    "key": "si"
   },
   {
    "text": "¿Está de buen ánimo la mayor parte del tiempo?",
    "key": "no"
   },
   {
    "text": "¿Teme que algo malo le va a pasar?",
    "key": "si"
   },
   {
    "text": "¿Se siente feliz la mayor parte del tiempo?",
    "key": "no"
   },
   {
    "text": "¿Se siente a menudo desamparado/a?",
    "key": "si"
   },
   {
    "text": "¿Prefiere quedarse en casa en vez de salir y hacer cosas nuevas?",
    "key": "si"
   },
   {
    "text": "¿Siente que tiene más problemas de memoria que la mayoría?",
    "key": "si"
   },
   {
    "text": "¿Piensa que es maravilloso estar vivo/a ahora?",
    "key": "no"
   },
   {
    "text": "¿Se siente bastante inútil tal como está ahora?",
    "key": "si"
   },
   {
    "text": "¿Se siente lleno/a de energía?",
    "key": "no"
   },
   {
    "text": "¿Siente que su situación es desesperada?",
    "key": "si"
   },
   {
    "text": "¿Piensa que la mayoría de la gente está mejor que usted?",
    "key": "si"
   }
  ],
  "max": 15,
  "bands": [
   {
    "upTo": 4,
    "label": "sin indicios de depresión",
    "level": "ok"
   },
   {
    "upTo": 8,
    "label": "depresión leve probable",
    "level": "warn"
   },
   {
    "upTo": 11,
    "label": "depresión moderada probable",
    "level": "crit"
   },
   {
    "upTo": 15,
    "label": "depresión grave probable",
    "level": "crit"
   }
  ]
 },
 {
  "id": "gad7",
  "domain": "Ansiedad",
  "name": "GAD-7",
  "full": "Trastorno de ansiedad generalizada, 7 ítems",
  "who": "adolescentes y adultos",
  "license": "Libre, sin permiso",
  "intro": "Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?",
  "note": "Corte 10 en la validación original. No diferencia por sí solo entre trastornos de ansiedad.",
  "kind": "sum",
  "options": [
   {
    "value": "0",
    "label": "Ningún día"
   },
   {
    "value": "1",
    "label": "Varios días"
   },
   {
    "value": "2",
    "label": "Más de la mitad de los días"
   },
   {
    "value": "3",
    "label": "Casi todos los días"
   }
  ],
  "items": [
   {
    "text": "Se ha sentido nervioso/a, ansioso/a o muy alterado/a"
   },
   {
    "text": "No ha podido dejar de preocuparse ni controlar la preocupación"
   },
   {
    "text": "Se ha preocupado demasiado por motivos diferentes"
   },
   {
    "text": "Ha tenido dificultad para relajarse"
   },
   {
    "text": "Se ha sentido tan inquieto/a que no ha podido quedarse quieto/a"
   },
   {
    "text": "Se ha molestado o irritado fácilmente"
   },
   {
    "text": "Ha sentido miedo, como si algo terrible pudiera pasar"
   }
  ],
  "max": 21,
  "bands": [
   {
    "upTo": 4,
    "label": "mínima",
    "level": "ok"
   },
   {
    "upTo": 9,
    "label": "leve",
    "level": "ok"
   },
   {
    "upTo": 14,
    "label": "moderada",
    "level": "warn"
   },
   {
    "upTo": 21,
    "label": "grave",
    "level": "crit"
   }
  ]
 },
 {
  "id": "spin",
  "domain": "Ansiedad",
  "name": "SPIN",
  "full": "Inventario de fobia social",
  "who": "adolescentes y adultos",
  "license": "De acceso libre (Connor et al., 2000); verificar condiciones",
  "intro": "Indique cuánto le han molestado los siguientes problemas durante la última semana.",
  "note": "Corte 19; 21–30 leve, 31–40 moderada, 41–50 grave, 51 o más muy grave.",
  "kind": "sum",
  "options": [
   {
    "value": "0",
    "label": "Nada"
   },
   {
    "value": "1",
    "label": "Un poco"
   },
   {
    "value": "2",
    "label": "Algo"
   },
   {
    "value": "3",
    "label": "Mucho"
   },
   {
    "value": "4",
    "label": "Muchísimo"
   }
  ],
  "items": [
   {
    "text": "Me da miedo la gente importante o con autoridad"
   },
   {
    "text": "Me molesta ruborizarme delante de la gente"
   },
   {
    "text": "Las fiestas y los eventos sociales me dan miedo"
   },
   {
    "text": "Evito hablar con personas que no conozco"
   },
   {
    "text": "Me asusta ser criticado/a"
   },
   {
    "text": "Me da miedo hacer el ridículo"
   },
   {
    "text": "Sudar delante de la gente me causa malestar"
   },
   {
    "text": "Evito ir a fiestas"
   },
   {
    "text": "Evito las actividades en las que soy el centro de atención"
   },
   {
    "text": "Hablar con extraños me da miedo"
   },
   {
    "text": "Evito dar discursos"
   },
   {
    "text": "Haría cualquier cosa por evitar ser criticado/a"
   },
   {
    "text": "Las palpitaciones me molestan cuando estoy entre la gente"
   },
   {
    "text": "Me asusta hacer cosas cuando la gente puede estar observándome"
   },
   {
    "text": "Ser avergonzado/a o parecer tonto/a son mis peores miedos"
   },
   {
    "text": "Evito hablar con cualquier persona con autoridad"
   },
   {
    "text": "Temblar o estremecerme delante de otros me produce malestar"
   }
  ],
  "max": 68,
  "bands": [
   {
    "upTo": 18,
    "label": "por debajo del corte (19)",
    "level": "ok"
   },
   {
    "upTo": 20,
    "label": "zona de corte (19–20)",
    "level": "warn"
   },
   {
    "upTo": 30,
    "label": "ansiedad social leve",
    "level": "warn"
   },
   {
    "upTo": 40,
    "label": "ansiedad social moderada",
    "level": "warn"
   },
   {
    "upTo": 50,
    "label": "ansiedad social grave",
    "level": "crit"
   },
   {
    "upTo": 68,
    "label": "ansiedad social muy grave",
    "level": "crit"
   }
  ]
 },
 {
  "id": "ocir",
  "domain": "Ansiedad",
  "name": "OCI-R",
  "full": "Inventario obsesivo-compulsivo revisado",
  "who": "adolescentes y adultos",
  "license": "De acceso libre (Foa et al., 2002); verificar condiciones",
  "intro": "Las siguientes frases se refieren a experiencias que muchas personas tienen. Indique cuánto le ha molestado cada una durante el último mes.",
  "note": "Autoinforme: el corte orientativo es 21. No reemplaza la entrevista de gravedad (Y-BOCS / CY-BOCS).",
  "kind": "sum",
  "options": [
   {
    "value": "0",
    "label": "Nada"
   },
   {
    "value": "1",
    "label": "Un poco"
   },
   {
    "value": "2",
    "label": "Moderadamente"
   },
   {
    "value": "3",
    "label": "Mucho"
   },
   {
    "value": "4",
    "label": "Muchísimo"
   }
  ],
  "items": [
   {
    "text": "He guardado tantas cosas que me estorban"
   },
   {
    "text": "Reviso las cosas más a menudo de lo necesario"
   },
   {
    "text": "Me altero si los objetos no están bien ordenados"
   },
   {
    "text": "Siento que tengo que contar mientras hago las cosas"
   },
   {
    "text": "Me resulta difícil tocar un objeto cuando sé que lo han tocado extraños o ciertas personas"
   },
   {
    "text": "Me resulta difícil controlar mis propios pensamientos"
   },
   {
    "text": "Colecciono cosas que no necesito"
   },
   {
    "text": "Compruebo repetidamente puertas, ventanas, cajones, etc."
   },
   {
    "text": "Me altero si otros cambian el modo en que tengo ordenadas las cosas"
   },
   {
    "text": "Siento que debo repetir ciertos números"
   },
   {
    "text": "A veces tengo que lavarme o limpiarme simplemente porque me siento contaminado/a"
   },
   {
    "text": "Me molestan los pensamientos desagradables que me vienen a la mente en contra de mi voluntad"
   },
   {
    "text": "Evito tirar cosas porque temo necesitarlas más adelante"
   },
   {
    "text": "Compruebo repetidamente los grifos de agua y gas y los interruptores de la luz después de cerrarlos o apagarlos"
   },
   {
    "text": "Necesito que las cosas estén ordenadas de una manera determinada"
   },
   {
    "text": "Siento que hay números buenos y números malos"
   },
   {
    "text": "Me lavo las manos más a menudo o durante más tiempo de lo necesario"
   },
   {
    "text": "Con frecuencia tengo pensamientos desagradables y me resulta difícil librarme de ellos"
   }
  ],
  "max": 72,
  "bands": [
   {
    "upTo": 20,
    "label": "por debajo del corte orientativo",
    "level": "ok"
   },
   {
    "upTo": 72,
    "label": "sugiere TOC (corte orientativo ≥ 21)",
    "level": "warn"
   }
  ],
  "groupsLabel": "Subescalas (0–12)",
  "groups": [
   {
    "label": "Acumulación",
    "items": [
     0,
     6,
     12
    ]
   },
   {
    "label": "Comprobación",
    "items": [
     1,
     7,
     13
    ]
   },
   {
    "label": "Orden",
    "items": [
     2,
     8,
     14
    ]
   },
   {
    "label": "Neutralización",
    "items": [
     3,
     9,
     15
    ]
   },
   {
    "label": "Lavado",
    "items": [
     4,
     10,
     16
    ]
   },
   {
    "label": "Obsesión",
    "items": [
     5,
     11,
     17
    ]
   }
  ]
 },
 {
  "id": "pcl5",
  "domain": "Trauma",
  "name": "PCL-5",
  "full": "Lista de verificación de TEPT para el DSM-5",
  "who": "adolescentes y adultos",
  "license": "Dominio público (Centro Nacional para el TEPT, EE. UU.)",
  "intro": "Piense en la experiencia muy estresante que identificó. En el último mes, ¿cuánto le molestó cada problema?",
  "note": "Corte orientativo 31–33. La distribución por grupos es provisional; el diagnóstico exige entrevista (por ejemplo, CAPS-5) y evaluar el criterio A, la duración y el deterioro.",
  "kind": "sum",
  "options": [
   {
    "value": "0",
    "label": "Nada en absoluto"
   },
   {
    "value": "1",
    "label": "Un poco"
   },
   {
    "value": "2",
    "label": "Moderadamente"
   },
   {
    "value": "3",
    "label": "Bastante"
   },
   {
    "value": "4",
    "label": "Extremadamente"
   }
  ],
  "items": [
   {
    "text": "Recuerdos repetidos, perturbadores y no deseados de la experiencia"
   },
   {
    "text": "Sueños repetidos y perturbadores sobre la experiencia"
   },
   {
    "text": "Sentir o actuar de repente como si la experiencia estuviera ocurriendo otra vez"
   },
   {
    "text": "Sentirse muy mal cuando algo le recordó la experiencia"
   },
   {
    "text": "Tener reacciones físicas fuertes cuando algo le recordó la experiencia (palpitaciones, dificultad para respirar, sudor)"
   },
   {
    "text": "Evitar recuerdos, pensamientos o sentimientos relacionados con la experiencia"
   },
   {
    "text": "Evitar recordatorios externos de la experiencia (personas, lugares, conversaciones, actividades, objetos o situaciones)"
   },
   {
    "text": "Dificultad para recordar partes importantes de la experiencia"
   },
   {
    "text": "Tener creencias negativas fuertes sobre usted, otras personas o el mundo"
   },
   {
    "text": "Culparse a usted mismo/a o a otra persona por la experiencia o por lo que pasó después"
   },
   {
    "text": "Tener sentimientos negativos fuertes como miedo, horror, enojo, culpa o vergüenza"
   },
   {
    "text": "Pérdida de interés en actividades que antes disfrutaba"
   },
   {
    "text": "Sentirse distante o aislado/a de otras personas"
   },
   {
    "text": "Dificultad para sentir emociones positivas (felicidad o afecto hacia personas cercanas)"
   },
   {
    "text": "Conducta irritable, arrebatos de enojo o actuar con agresividad"
   },
   {
    "text": "Correr demasiados riesgos o hacer cosas que podrían causarle daño"
   },
   {
    "text": "Estar «superalerta», vigilante o en guardia"
   },
   {
    "text": "Sentirse sobresaltado/a con facilidad"
   },
   {
    "text": "Dificultad para concentrarse"
   },
   {
    "text": "Dificultad para conciliar o mantener el sueño"
   }
  ],
  "max": 80,
  "bands": [
   {
    "upTo": 30,
    "label": "por debajo del punto de corte orientativo",
    "level": "ok"
   },
   {
    "upTo": 80,
    "label": "sugiere probable TEPT (corte orientativo 31–33)",
    "level": "crit"
   }
  ],
  "groupsLabel": "Grupos de síntomas",
  "groups": [
   {
    "label": "B",
    "items": [
     0,
     1,
     2,
     3,
     4
    ]
   },
   {
    "label": "C",
    "items": [
     5,
     6
    ]
   },
   {
    "label": "D",
    "items": [
     7,
     8,
     9,
     10,
     11,
     12,
     13
    ]
   },
   {
    "label": "E",
    "items": [
     14,
     15,
     16,
     17,
     18,
     19
    ]
   }
  ],
  "criteria": {
   "threshold": 2,
   "min": {
    "B": 1,
    "C": 1,
    "D": 2,
    "E": 2
   },
   "label": "criterios provisionales DSM-5 (ítems con puntaje ≥ 2)"
  }
 },
 {
  "id": "sapas",
  "domain": "Personalidad",
  "name": "SAPAS",
  "full": "Escala breve estandarizada de evaluación de la personalidad",
  "who": "adultos",
  "license": "De acceso libre (Moran et al., 2003); verificar condiciones",
  "intro": "Pregunte de manera general (normalmente, en general). Respuesta Sí o No.",
  "note": "El ítem 3 puntúa con «No». Corte 3: cribado de un posible trastorno de la personalidad; no lo diagnostica ni indica el tipo.",
  "kind": "yn",
  "options": [
   {
    "value": "si",
    "label": "Sí"
   },
   {
    "value": "no",
    "label": "No"
   }
  ],
  "items": [
   {
    "text": "En general, ¿le cuesta hacer y mantener amistades?",
    "key": "si"
   },
   {
    "text": "¿Normalmente se describiría como una persona solitaria?",
    "key": "si"
   },
   {
    "text": "En general, ¿confía usted en los demás?",
    "key": "no"
   },
   {
    "text": "¿Normalmente pierde los estribos con facilidad?",
    "key": "si"
   },
   {
    "text": "¿Es usted una persona impulsiva?",
    "key": "si"
   },
   {
    "text": "¿Normalmente es una persona que se preocupa mucho?",
    "key": "si"
   },
   {
    "text": "En general, ¿depende mucho de los demás?",
    "key": "si"
   },
   {
    "text": "En general, ¿es usted perfeccionista?",
    "key": "si"
   }
  ],
  "max": 8,
  "bands": [
   {
    "upTo": 2,
    "label": "cribado negativo",
    "level": "ok"
   },
   {
    "upTo": 8,
    "label": "cribado positivo (corte 3): evaluar un posible trastorno de la personalidad",
    "level": "warn"
   }
  ]
 },
 {
  "id": "msibpd",
  "domain": "Personalidad",
  "name": "MSI-BPD",
  "full": "Cribado de trastorno límite de la personalidad de McLean",
  "who": "adultos (en adolescentes, con cautela)",
  "license": "De acceso libre (Zanarini et al., 2003); verificar condiciones",
  "intro": "Responda Sí o No.",
  "note": "Corte 7. Es un cribado; no diagnostica. Un positivo pide entrevista clínica estructurada.",
  "kind": "yn",
  "options": [
   {
    "value": "si",
    "label": "Sí"
   },
   {
    "value": "no",
    "label": "No"
   }
  ],
  "items": [
   {
    "text": "¿Alguna de sus relaciones más cercanas se ha visto afectada por muchas discusiones o rupturas repetidas?",
    "key": "si"
   },
   {
    "text": "¿Se ha hecho daño a propósito (por ejemplo, golpeándose, cortándose o quemándose)? ¿Ha intentado suicidarse?",
    "key": "si"
   },
   {
    "text": "¿Ha tenido al menos otros dos problemas de impulsividad (por ejemplo, atracones, gastos descontrolados, beber en exceso, estallidos verbales)?",
    "key": "si"
   },
   {
    "text": "¿Ha tenido cambios de ánimo extremos?",
    "key": "si"
   },
   {
    "text": "¿Se ha sentido muy enojado/a gran parte del tiempo? ¿Ha actuado a menudo de manera irritable o sarcástica?",
    "key": "si"
   },
   {
    "text": "¿Ha desconfiado a menudo de los demás?",
    "key": "si"
   },
   {
    "text": "¿Ha sentido con frecuencia que usted o lo que le rodea es irreal?",
    "key": "si"
   },
   {
    "text": "¿Se ha sentido crónicamente vacío/a?",
    "key": "si"
   },
   {
    "text": "¿Ha sentido a menudo que no sabe quién es o que no tiene identidad?",
    "key": "si"
   },
   {
    "text": "¿Ha hecho esfuerzos desesperados por evitar sentirse abandonado/a o ser abandonado/a (por ejemplo, llamar repetidamente para asegurarse de que le importa, rogarle que no se vaya, aferrarse físicamente)?",
    "key": "si"
   }
  ],
  "max": 10,
  "bands": [
   {
    "upTo": 6,
    "label": "por debajo del corte",
    "level": "ok"
   },
   {
    "upTo": 10,
    "label": "cribado positivo (corte 7): evaluar rasgos límite",
    "level": "warn"
   }
  ],
  "flags": [
   {
    "item": 1,
    "when": {
     "is": "si"
    },
    "level": "crit",
    "text": "Ítem 2 afirmativo: explorar autolesiones e intentos de suicidio y completar un tamizaje de suicidio (ASQ o Plutchik)."
   }
  ]
 },
 {
  "id": "tipi",
  "domain": "Personalidad",
  "name": "TIPI",
  "full": "Inventario breve de personalidad de diez ítems (Big Five)",
  "who": "adultos y adolescentes mayores",
  "license": "Libre para uso no comercial (Gosling et al., 2003); verificar condiciones",
  "intro": "Me veo a mí mismo/a como alguien que es… (marque cuánto está de acuerdo, aunque una característica describa mejor que la otra).",
  "note": "Describe rasgos (1 a 7, punto medio 4). No es una prueba clínica ni diagnostica trastornos de la personalidad.",
  "kind": "tipi",
  "options": [
   {
    "value": "1",
    "label": "Totalmente en desacuerdo"
   },
   {
    "value": "2",
    "label": "En desacuerdo"
   },
   {
    "value": "3",
    "label": "Algo en desacuerdo"
   },
   {
    "value": "4",
    "label": "Ni de acuerdo ni en desacuerdo"
   },
   {
    "value": "5",
    "label": "Algo de acuerdo"
   },
   {
    "value": "6",
    "label": "De acuerdo"
   },
   {
    "value": "7",
    "label": "Totalmente de acuerdo"
   }
  ],
  "items": [
   {
    "text": "Extrovertido/a, entusiasta"
   },
   {
    "text": "Criticón/a, pendenciero/a",
    "reverse": true
   },
   {
    "text": "Confiable, autodisciplinado/a"
   },
   {
    "text": "Ansioso/a, fácilmente molesto/a",
    "reverse": true
   },
   {
    "text": "Abierto/a a nuevas experiencias, complejo/a"
   },
   {
    "text": "Reservado/a, callado/a",
    "reverse": true
   },
   {
    "text": "Comprensivo/a, afectuoso/a"
   },
   {
    "text": "Desorganizado/a, descuidado/a",
    "reverse": true
   },
   {
    "text": "Calmado/a, emocionalmente estable"
   },
   {
    "text": "Convencional, poco creativo/a",
    "reverse": true
   }
  ],
  "max": 7,
  "reverseSum": 8
 },
 {
  "id": "rses",
  "domain": "Personalidad",
  "name": "Rosenberg",
  "full": "Escala de autoestima de Rosenberg",
  "who": "adolescentes y adultos",
  "license": "Uso libre con cita del autor",
  "intro": "Indique su grado de acuerdo con cada frase.",
  "note": "Ítems 6 a 10 se puntúan al revés. 30–40 elevada, 26–29 media, 25 o menos baja. Es un rasgo, no un diagnóstico.",
  "kind": "sum",
  "options": [
   {
    "value": "1",
    "label": "Muy en desacuerdo"
   },
   {
    "value": "2",
    "label": "En desacuerdo"
   },
   {
    "value": "3",
    "label": "De acuerdo"
   },
   {
    "value": "4",
    "label": "Muy de acuerdo"
   }
  ],
  "items": [
   {
    "text": "Siento que soy una persona digna de aprecio, al menos en igual medida que los demás"
   },
   {
    "text": "Estoy convencido/a de que tengo cualidades buenas"
   },
   {
    "text": "Soy capaz de hacer las cosas tan bien como la mayoría de la gente"
   },
   {
    "text": "Tengo una actitud positiva hacia mí mismo/a"
   },
   {
    "text": "En general estoy satisfecho/a de mí mismo/a"
   },
   {
    "text": "Siento que no tengo mucho de lo que estar orgulloso/a",
    "reverse": true
   },
   {
    "text": "En general, me inclino a pensar que soy un fracasado/a",
    "reverse": true
   },
   {
    "text": "Me gustaría poder sentir más respeto por mí mismo/a",
    "reverse": true
   },
   {
    "text": "Hay veces que realmente pienso que soy un inútil",
    "reverse": true
   },
   {
    "text": "A veces creo que no soy buena persona",
    "reverse": true
   }
  ],
  "max": 40,
  "reverseSum": 5,
  "bands": [
   {
    "upTo": 25,
    "label": "autoestima baja",
    "level": "warn"
   },
   {
    "upTo": 29,
    "label": "autoestima media",
    "level": "ok"
   },
   {
    "upTo": 40,
    "label": "autoestima elevada",
    "level": "ok"
   }
  ],
  "min": 10
 },
 {
  "id": "aq10",
  "domain": "Otros",
  "name": "AQ-10",
  "full": "Cociente del espectro autista, versión breve",
  "who": "adultos (hay versiones para adolescentes y niños)",
  "license": "De acceso libre (Autism Research Centre; Allison et al., 2012)",
  "intro": "Indique cuánto está de acuerdo con cada frase.",
  "note": "Puntúa 1 si coincide el sentido del TEA (de acuerdo en 1, 7, 8, 10; en desacuerdo en el resto). Corte 6: derivar a evaluación diagnóstica. No diagnostica.",
  "kind": "ak",
  "options": [
   {
    "value": "1",
    "label": "Muy de acuerdo"
   },
   {
    "value": "2",
    "label": "Algo de acuerdo"
   },
   {
    "value": "3",
    "label": "Algo en desacuerdo"
   },
   {
    "value": "4",
    "label": "Muy en desacuerdo"
   }
  ],
  "items": [
   {
    "text": "A menudo noto pequeños sonidos que otros no notan",
    "key": "a"
   },
   {
    "text": "Normalmente me concentro más en el conjunto que en los pequeños detalles",
    "key": "d"
   },
   {
    "text": "Me resulta fácil hacer más de una cosa a la vez",
    "key": "d"
   },
   {
    "text": "Si hay una interrupción, puedo volver a lo que estaba haciendo muy rápidamente",
    "key": "d"
   },
   {
    "text": "Me resulta fácil «leer entre líneas» cuando alguien me habla",
    "key": "d"
   },
   {
    "text": "Sé cómo darme cuenta de si la persona que me escucha se está aburriendo",
    "key": "d"
   },
   {
    "text": "Cuando leo una historia, me resulta difícil entender las intenciones de los personajes",
    "key": "a"
   },
   {
    "text": "Me gusta coleccionar información sobre categorías de cosas (tipos de coches, aves, trenes, plantas)",
    "key": "a"
   },
   {
    "text": "Me resulta fácil imaginar lo que alguien piensa o siente con solo mirar su cara",
    "key": "d"
   },
   {
    "text": "Me resulta difícil entender las intenciones de las personas",
    "key": "a"
   }
  ],
  "max": 10,
  "bands": [
   {
    "upTo": 5,
    "label": "por debajo del corte",
    "level": "ok"
   },
   {
    "upTo": 10,
    "label": "≥ 6: sugiere derivar a evaluación diagnóstica de TEA",
    "level": "warn"
   }
  ]
 },
 {
  "id": "ais",
  "domain": "Otros",
  "name": "AIS",
  "full": "Escala de insomnio de Atenas",
  "who": "adolescentes y adultos",
  "license": "De acceso libre (Soldatos et al., 2000)",
  "intro": "Valore cada aspecto si ocurrió al menos 3 veces por semana durante el último mes.",
  "note": "Los textos de respuesta son genéricos: la escala original redacta opciones propias para cada ítem. Corte 6: sugiere insomnio.",
  "kind": "sum",
  "options": [
   {
    "value": "0",
    "label": "Sin problema"
   },
   {
    "value": "1",
    "label": "Problema leve"
   },
   {
    "value": "2",
    "label": "Problema considerable"
   },
   {
    "value": "3",
    "label": "Problema grave o no durmió"
   }
  ],
  "items": [
   {
    "text": "Tiempo que tarda en dormirse tras apagar la luz"
   },
   {
    "text": "Despertares durante la noche"
   },
   {
    "text": "Despertar final más temprano de lo deseado"
   },
   {
    "text": "Duración total del sueño"
   },
   {
    "text": "Calidad general del sueño (sin importar cuánto durmió)"
   },
   {
    "text": "Bienestar durante el día"
   },
   {
    "text": "Funcionamiento (físico y mental) durante el día"
   },
   {
    "text": "Somnolencia durante el día"
   }
  ],
  "max": 24,
  "bands": [
   {
    "upTo": 5,
    "label": "sin insomnio",
    "level": "ok"
   },
   {
    "upTo": 24,
    "label": "sugiere insomnio (corte ≥ 6)",
    "level": "warn"
   }
  ]
 },
 {
  "id": "scoff",
  "domain": "Otros",
  "name": "SCOFF",
  "full": "Cribado de conductas alimentarias",
  "who": "adolescentes y adultos",
  "license": "De acceso libre (Morgan et al., 1999)",
  "intro": "Responda Sí o No.",
  "note": "Corte 2. Es un cribado: un positivo pide evaluación clínica y médica.",
  "kind": "yn",
  "options": [
   {
    "value": "si",
    "label": "Sí"
   },
   {
    "value": "no",
    "label": "No"
   }
  ],
  "items": [
   {
    "text": "¿Se provoca el vómito porque se siente incómodamente lleno/a?",
    "key": "si"
   },
   {
    "text": "¿Le preocupa haber perdido el control sobre cuánto come?",
    "key": "si"
   },
   {
    "text": "¿Ha perdido recientemente más de 6 kg en un período de 3 meses?",
    "key": "si"
   },
   {
    "text": "¿Cree que está gordo/a aunque otros digan que está demasiado delgado/a?",
    "key": "si"
   },
   {
    "text": "¿Diría que la comida domina su vida?",
    "key": "si"
   }
  ],
  "max": 5,
  "bands": [
   {
    "upTo": 1,
    "label": "cribado negativo",
    "level": "ok"
   },
   {
    "upTo": 5,
    "label": "cribado positivo (corte 2)",
    "level": "warn"
   }
  ]
 }
];
