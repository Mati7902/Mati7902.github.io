import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExerciseRunner } from "@/components/exercises/exercise-runner";
import type { ExerciseStep } from "@/lib/exercises/steps";

vi.mock("@/server/actions/exercises", () => ({ saveExerciseResponseAction: vi.fn(async () => ({ ok: true, data: { id: "r1" } })) }));

const steps: ExerciseStep[] = [
  { id: "situation", type: "text", prompt: "¿Qué ocurrió?" },
  { id: "thought", type: "text", prompt: "¿Qué pensamiento apareció?", optional: true },
  { id: "choice", type: "choice", prompt: "¿Te acerca o te aleja?", options: ["Me acerca", "Me aleja"] },
  { id: "reframe", type: "reflect", template: "Estoy teniendo el pensamiento de que {{situation}}." },
];

describe("ExerciseRunner (wizard)", () => {
  it("muestra una pregunta por pantalla y bloquea Continuar hasta responder lo obligatorio", () => {
    render(<ExerciseRunner templateId="t1" title="Test" steps={steps} />);
    expect(screen.getByRole("heading", { name: "¿Qué ocurrió?" })).toBeInTheDocument();
    const next = screen.getByRole("button", { name: /continuar/i });
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Discutí con mi hermano" } });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(screen.getByRole("heading", { name: "¿Qué pensamiento apareció?" })).toBeInTheDocument();
  });

  it("permite saltar pasos opcionales e interpola respuestas previas", () => {
    render(<ExerciseRunner templateId="t1" title="Test" steps={steps} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "soy un fracaso" } });
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fireEvent.click(screen.getByRole("button", { name: /saltar/i }));
    fireEvent.click(screen.getByRole("button", { name: "Me aleja" }));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    expect(screen.getByText("Estoy teniendo el pensamiento de que soy un fracaso.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /terminar/i })).toBeEnabled();
  });

  it("muestra el progreso accesible", () => {
    render(<ExerciseRunner templateId="t1" title="Test" steps={steps} />);
    expect(screen.getByRole("progressbar", { name: "Paso 1 de 4" })).toBeInTheDocument();
  });

  it("selección múltiple con tope y devolución en quizzes", () => {
    const quizSteps: ExerciseStep[] = [
      { id: "values", type: "checklist", prompt: "¿Qué te importa?", options: ["Amigos", "Familia", "Salud"], max: 2 },
      { id: "quiz", type: "choice", prompt: "«Soy un burro»", options: ["Hecho", "Pensamiento"], feedback: { Pensamiento: "Bien: es una **etiqueta**, no un hecho." } },
    ];
    render(<ExerciseRunner templateId="t1" title="Test" steps={quizSteps} />);
    const next = screen.getByRole("button", { name: /continuar/i });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Amigos" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Salud" }));
    expect(screen.getByRole("checkbox", { name: "Familia" })).toBeDisabled();
    expect(screen.getByText("2 de 2 elegidas")).toBeInTheDocument();
    fireEvent.click(next);
    fireEvent.click(screen.getByRole("button", { name: "Pensamiento" }));
    expect(screen.getByRole("status")).toHaveTextContent("Bien: es una etiqueta, no un hecho.");
    expect(screen.getByText("etiqueta").tagName).toBe("STRONG");
  });

  it("muestra párrafos y viñetas en los textos informativos", () => {
    render(
      <ExerciseRunner
        templateId="t1"
        title="Test"
        steps={[{ id: "intro", type: "info", title: "Trampas", content: "Primer párrafo.\n\n- Todo o nada\n- Leer la mente" }]}
      />,
    );
    expect(screen.getByText("Primer párrafo.").tagName).toBe("P");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Todo o nada", "Leer la mente"]);
  });

  it("una lista con mínimo deja seguir con menos renglones completos", () => {
    render(<ExerciseRunner templateId="t1" title="Test" steps={[{ id: "people", type: "list", prompt: "Personas de confianza", count: 4, min: 2 }, { id: "end", type: "info", content: "Fin" }]} />);
    const next = screen.getByRole("button", { name: /continuar/i });
    expect(screen.getByText("Completá al menos 2.")).toBeInTheDocument();
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0]!, { target: { value: "Abuela" } });
    expect(next).toBeDisabled();
    fireEvent.change(inputs[1]!, { target: { value: "Profe de música" } });
    expect(next).toBeEnabled();
  });
});
