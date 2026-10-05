import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { EmotionSelector } from "@/components/emotions/emotion-selector";
import { EmotionSlider } from "@/components/emotions/emotion-slider";

function Harness({ max = 3, single = false }: { max?: number; single?: boolean }) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <>
      <EmotionSelector value={value} onChange={setValue} max={max} single={single} />
      <output data-testid="value">{value.join(",")}</output>
    </>
  );
}

describe("EmotionSelector", () => {
  it("permite elegir hasta el máximo y deseleccionar", () => {
    render(<Harness max={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Tranquilo/a" }));
    fireEvent.click(screen.getByRole("button", { name: "Ansioso/a" }));
    fireEvent.click(screen.getByRole("button", { name: "Triste" }));
    expect(screen.getByTestId("value")).toHaveTextContent("tranquilo,ansioso");
    expect(screen.getByRole("button", { name: "Tranquilo/a" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Tranquilo/a" }));
    expect(screen.getByTestId("value")).toHaveTextContent("ansioso");
  });

  it("en modo único reemplaza la selección", () => {
    render(<Harness single />);
    fireEvent.click(screen.getByRole("button", { name: "Triste" }));
    fireEvent.click(screen.getByRole("button", { name: "Motivado/a" }));
    expect(screen.getByTestId("value")).toHaveTextContent("motivado");
  });
});

describe("EmotionSlider", () => {
  it("expone el valor actual de forma accesible", () => {
    render(<EmotionSlider value={7} onChange={() => undefined} />);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "7");
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
