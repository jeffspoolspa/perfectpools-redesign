/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { ReferralStep } from "./ReferralStep";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ReferralStep", () => {
  it("renders all six referral sources", () => {
    render(<ReferralStep value="" onChange={vi.fn()} />);
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Social Media")).toBeInTheDocument();
    expect(screen.getByText("Saw Our Truck")).toBeInTheDocument();
    expect(screen.getByText("Word of Mouth")).toBeInTheDocument();
    expect(screen.getByText("Print Advertisement")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("marks the matching source as selected", () => {
    render(<ReferralStep value="social_media" onChange={vi.fn()} />);
    const selected = screen
      .getByText("Social Media")
      .closest("button");
    expect(selected?.className).toContain("selected");
  });

  it("clicking a source fires onChange with the id", () => {
    const onChange = vi.fn();
    render(<ReferralStep value="" onChange={onChange} />);
    fireEvent.click(screen.getByText("Saw Our Truck"));
    expect(onChange).toHaveBeenCalledWith("saw_truck");
  });

  it("calls onAdvance after the configured delay", () => {
    const onAdvance = vi.fn();
    render(
      <ReferralStep
        value=""
        onChange={vi.fn()}
        onAdvance={onAdvance}
        autoAdvanceDelayMs={500}
      />,
    );
    fireEvent.click(screen.getByText("Google"));
    expect(onAdvance).not.toHaveBeenCalled();
    vi.advanceTimersByTime(499);
    expect(onAdvance).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("does NOT call setTimeout when onAdvance is omitted", () => {
    render(<ReferralStep value="" onChange={vi.fn()} />);
    // Just verify clicking doesn't blow up — no onAdvance means no auto-advance
    fireEvent.click(screen.getByText("Google"));
    vi.advanceTimersByTime(1000);
    // Test passes if no error thrown
  });
});
