/** Tipos del contenido de la Guía clínica (solo lectura, para el panel profesional). */

export type Level = "ok" | "neu" | "warn" | "crit";

/** Texto en línea: admite **negrita** (igual que RichText). */
export type ListItem = string | { t: string; sub: string[] };

export type Block =
  | { k: "h"; t: string }
  | { k: "p"; t: string }
  /** Recuadro: precauciones clínicas y ejemplos de lo que se le dice al paciente. */
  | { k: "note"; t: string }
  | { k: "ul"; i: ListItem[] }
  | { k: "ol"; i: ListItem[] }
  | { k: "table"; h: string[]; r: string[][] };

export type Section = { title: string; blocks: Block[] };

export type Ficha = {
  id: string;
  title: string;
  /** Códigos CIE-10 (OMS) con los que se relaciona; el HIS usa CIE-10, no DSM. */
  codes: string[];
  /** Ids de los protocolos de sesión relacionados. */
  protocols: number[];
  blocks: Block[];
};

export type ProtocolSession = {
  n: string;
  name: string;
  objective: string;
  contents: string[];
  examples: string[];
  homework: string;
  measures: string;
  /** Notas adicionales de la sesión (puede incluir listas y recuadros). */
  extra: Block[];
};

export type Protocol = {
  id: number;
  title: string;
  intro: string;
  sections: Section[];
  sessions: ProtocolSession[];
  tests: { name: string; when: string; why: string }[];
  refs: string;
};

/** Capítulos de situaciones especiales de la guía (suicidio, sustancias, duelo, adolescentes…). */
export type Tema = { id: string; chapter: number; title: string; sections: Section[] };

export type TestKind = "sum" | "yn" | "ak" | "tipi" | "asq";

export type TestItem = {
  text: string;
  /** Ítem de puntuación invertida (kind sum / tipi). */
  reverse?: boolean;
  /** Respuesta que puntúa 1: "si" | "no" (kind yn) o "a" (de acuerdo) | "d" (en desacuerdo) (kind ak). */
  key?: "si" | "no" | "a" | "d";
};

export type TestBand = { upTo: number; label: string; level: Level };

export type TestFlag = {
  /** Índice del ítem (desde 0). */
  item: number;
  when: { gt: number } | { is: string };
  level: Level;
  text: string;
};

export type TestDef = {
  id: string;
  domain: string;
  name: string;
  full: string;
  who: string;
  license: string;
  intro: string;
  note?: string;
  kind: TestKind;
  options: { value: string; label: string }[];
  items: TestItem[];
  min?: number;
  max: number;
  /** Suma con la que se invierten los ítems (reverse): valor invertido = reverseSum − respuesta. */
  reverseSum?: number;
  bands?: TestBand[];
  flags?: TestFlag[];
  /** Ítem cuya respuesta se anota aparte en el resumen (PHQ-9: ítem 9, desde 0). */
  reportItem?: number;
  /** Subescalas o grupos de ítems (OCI-R, PCL-5). */
  groups?: { label: string; items: number[] }[];
  groupsLabel?: string;
  /** Criterios provisionales por grupo: mínimo de ítems con puntaje ≥ threshold. */
  criteria?: { threshold: number; min: Record<string, number>; label: string };
};
