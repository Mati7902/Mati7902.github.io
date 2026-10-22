import { FICHAS } from "./fichas-data";
import { PROTOCOLS } from "./protocolos-data";
import { TEMAS } from "./temas-data";
import { TESTS } from "./tests-data";
import type { Ficha, Protocol, Tema, TestDef } from "./types";

export { FICHAS, PROTOCOLS, TEMAS, TESTS };

export const getFicha = (id: string): Ficha | undefined => FICHAS.find((f) => f.id === id);
export const getProtocol = (id: string | number): Protocol | undefined => PROTOCOLS.find((p) => String(p.id) === String(id));
export const getTema = (id: string): Tema | undefined => TEMAS.find((t) => t.id === id);
export const getTest = (id: string): TestDef | undefined => TESTS.find((t) => t.id === id);

/** Dominios de los tests, en el orden en que aparecen. */
export function testDomains(): { domain: string; tests: TestDef[] }[] {
  const out: { domain: string; tests: TestDef[] }[] = [];
  for (const t of TESTS) {
    const g = out.find((x) => x.domain === t.domain);
    if (g) g.tests.push(t);
    else out.push({ domain: t.domain, tests: [t] });
  }
  return out;
}

/** Test aplicable que corresponde a un nombre de la lista de medición de un protocolo («PHQ-9», «GAD-7»…). */
export function testForName(name: string): TestDef | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const n = norm(name);
  return TESTS.find((t) => n.startsWith(norm(t.name)) || (t.id === "asq" && n.startsWith("asq")));
}

/** Fichas que remiten a un protocolo. */
export const fichasForProtocol = (id: number): Ficha[] => FICHAS.filter((f) => f.protocols.includes(id));
