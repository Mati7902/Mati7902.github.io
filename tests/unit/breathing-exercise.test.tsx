import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BreathingExercise } from "@/components/calm/breathing-exercise";

const config = { pattern: { inhale: 4, hold: 4, exhale: 4, hold_after: 4 }, durations: [1, 3, 5] };

function phaseLabel() {
  return screen.getByText(/^(INHALÁ|SOSTENÉ|EXHALÁ|PREPARATE|LISTO)$/).textContent;
}

function tick(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("respiración guiada", () => {
  it("recorre inhalar, sostener, exhalar y sostener con la duración de cada fase", () => {
    render(<BreathingExercise config={config} title="Respiración cuadrada" />);
    fireEvent.click(screen.getByRole("button", { name: /Empezar/ }));
    expect(phaseLabel()).toBe("INHALÁ");
    expect(screen.getByText("4 segundos")).toBeInTheDocument();
    tick(4);
    expect(phaseLabel()).toBe("SOSTENÉ");
    tick(4);
    expect(phaseLabel()).toBe("EXHALÁ");
    tick(4);
    expect(phaseLabel()).toBe("SOSTENÉ");
    tick(4);
    expect(phaseLabel()).toBe("INHALÁ");
  });

  it("con todos los campos del ritmo en 0, inhalar y exhalar duran 1 segundo y el ciclo avanza", () => {
    render(<BreathingExercise config={config} title="Respiración cuadrada" />);
    for (const field of screen.getAllByRole("spinbutton")) {
      fireEvent.change(field, { target: { value: "0" } });
      fireEvent.blur(field);
    }
    const values = screen.getAllByRole("spinbutton").map((f) => (f as HTMLInputElement).value);
    expect(values).toEqual(["1", "0", "1", "0"]);
    fireEvent.click(screen.getByRole("button", { name: /Empezar/ }));
    expect(phaseLabel()).toBe("INHALÁ");
    expect(screen.getByText("1 segundo")).toBeInTheDocument();
    tick(1);
    expect(phaseLabel()).toBe("EXHALÁ");
    tick(1);
    expect(phaseLabel()).toBe("INHALÁ");
  });

  it("mientras se escribe un 0 en inhalar, el ejercicio usa 1 segundo", () => {
    render(<BreathingExercise config={config} title="Respiración cuadrada" />);
    fireEvent.change(screen.getByLabelText("Inhalar, segundos"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Empezar/ }));
    expect(screen.getByText("1 segundo")).toBeInTheDocument();
    tick(1);
    expect(phaseLabel()).toBe("SOSTENÉ");
  });

  it("al terminar la duración elegida avisa y muestra LISTO", () => {
    const onComplete = vi.fn();
    render(<BreathingExercise config={config} title="Respiración cuadrada" onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: /^1 minuto/ }));
    fireEvent.click(screen.getByRole("button", { name: /Empezar/ }));
    tick(61);
    expect(phaseLabel()).toBe("LISTO");
    expect(onComplete).toHaveBeenCalledWith({ durationMinutes: 1 });
  });
});
