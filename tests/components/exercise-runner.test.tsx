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
});
