/* @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { DupCheckStep } from "./DupCheckStep";

const baseMatch = {
  customerId: 42,
  displayName: "Carter G.",
  redactedPhone: "***-***-0160",
  redactedEmail: "c***@jeffspoolspa.com",
};

describe("DupCheckStep", () => {
  it("renders the header + matched contact info", () => {
    render(<DupCheckStep match={baseMatch} onUseExisting={vi.fn()} onCreateNew={vi.fn()} />);
    expect(screen.getByText(/we may already know you/i)).toBeInTheDocument();
    expect(screen.getByText("Carter G.")).toBeInTheDocument();
    expect(screen.getByText(/\*\*\*-\*\*\*-0160/)).toBeInTheDocument();
    expect(screen.getByText(/c\*\*\*@jeffspoolspa\.com/)).toBeInTheDocument();
  });

  it("hides phone/email rows when not provided", () => {
    render(
      <DupCheckStep
        match={{ customerId: 42, displayName: "Anon" }}
        onUseExisting={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );
    expect(screen.queryByText(/phone:/i)).toBeNull();
    expect(screen.queryByText(/email:/i)).toBeNull();
  });

  it("clicking 'Yes, that's me' fires onUseExisting", () => {
    const onUseExisting = vi.fn();
    render(
      <DupCheckStep match={baseMatch} onUseExisting={onUseExisting} onCreateNew={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /yes, that's me/i }));
    expect(onUseExisting).toHaveBeenCalledTimes(1);
  });

  it("clicking 'No, I'm a new customer' fires onCreateNew", () => {
    const onCreateNew = vi.fn();
    render(
      <DupCheckStep match={baseMatch} onUseExisting={vi.fn()} onCreateNew={onCreateNew} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /no, i'm a new customer/i }));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it("loading=true disables both buttons and swaps copy to 'Saving...'", () => {
    render(
      <DupCheckStep match={baseMatch} onUseExisting={vi.fn()} onCreateNew={vi.fn()} loading />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeDisabled();
    expect(screen.getAllByText("Saving...")).toHaveLength(2);
  });
});
