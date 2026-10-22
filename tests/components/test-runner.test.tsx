import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TestRunner } from "@/components/admin/guia/test-runner";
import { getTest } from "@/lib/guia/guia";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const def = (id: string) => {
  const t = getTest(id);
  if (!t) throw new Error(id);
  return t;
};

/** Marca la opción `label` del ítem `i` (los radios están dentro de un fieldset por ítem). */
function pick(i: number, label: string) {
  const groups = screen.getAllByRole("group");
  const group = groups[i];
  if (!group) throw new Error(`sin ítem ${i}`);
  const radios = Array.from(group.querySelectorAll("label")).filter((l) => l.textContent === label);
  fireEvent.click(radios[0]!.querySelector("input")!);
}

describe("TestRunner", () => {
  it("PHQ-9: suma, interpreta y alerta por el ítem 9", () => {
    render(<TestRunner def={def("phq9")} />);
    expect(screen.getByText(/Completá todos los ítems/)).toBeInTheDocument();
    for (let i = 0; i < 9; i++) pick(i, "Más de la mitad de los días");
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("moderadamente grave")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Ítem 9 mayor que 0");
    expect(screen.getByText("9/9 respondidos")).toBeInTheDocument();
  });

  it("copia el resultado y borra las respuestas", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<TestRunner def={def("scoff")} />);
    expect(screen.getByRole("button", { name: /copiar resultado/i })).toBeDisabled();
    for (let i = 0; i < 5; i++) pick(i, "Sí");
    fireEvent.click(screen.getByRole("button", { name: /copiar resultado/i }));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("SCOFF: 5/5 (cribado positivo (corte 2))"));
    fireEvent.click(screen.getByRole("button", { name: /borrar respuestas/i }));
    expect(screen.getByText("0/5 respondidos")).toBeInTheDocument();
  });

  it("ASQ: el ítem 5 aparece solo con un «sí» y marca el positivo agudo", () => {
    render(<TestRunner def={def("asq")} />);
    expect(screen.getAllByRole("group")).toHaveLength(4);
    pick(0, "Sí");
    expect(screen.getAllByRole("group")).toHaveLength(5);
    pick(4, "Sí");
    expect(screen.getByText("ASQ positivo agudo")).toBeInTheDocument();
    expect(screen.getByText(/no dejar sola a la persona/)).toBeInTheDocument();
  });

  it("TIPI: muestra las cinco dimensiones", () => {
    render(<TestRunner def={def("tipi")} />);
    for (let i = 0; i < 10; i++) pick(i, "Ni de acuerdo ni en desacuerdo");
    expect(screen.getAllByText("4,0")).toHaveLength(5);
  });
});
