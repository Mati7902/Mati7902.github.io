import { test } from "vitest";
import { testimonialSchema, cleanQuote } from "@/lib/testimonials";
test("probe", () => {
  const cases = [
    "Me cambió la vida 🙏",
    "🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏",
    "Gracias por todo 👩‍👩‍👧",
    "    Hola mundo, esto me ayudó   ",
    "​Muy buena terapia gracias​",
    "Sentí alivio desde la 3ra sesión, gracias.",
    "Hoy duermo mejor. Llamame al 0981 123 456",
    "Mi número 0981-123-456 me ayudó",
    "Mi cédula es 4.123.456 y me ayudó mucho",
  ];
  for (const q of cases) {
    const r = testimonialSchema.safeParse({ gender: "mujer", quote: q });
    console.log(JSON.stringify(q), q.length, [...q].length, r.success ? JSON.stringify(r.data.quote) + " len=" + r.data.quote.length + " cp=" + [...r.data.quote].length : JSON.stringify(r.error.issues.map(i=>i.message)));
  }
  const ctx = "a".repeat(79) + "🙏";
  console.log(testimonialSchema.safeParse({ gender: "mujer", quote: "Una frase suficientemente larga.", context: ctx }).success);
  console.log(testimonialSchema.safeParse({ gender: "mujer", quote: "Una frase suficientemente larga.", context: "   " }));
});
