/* @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { ConfirmationModal } from "./ConfirmationModal";

const baseQuoteProps = {
  kind: "quote" as const,
  initialChannel: "email" as const,
  quote: {
    planLabel: "Pool + Spa Combo",
    cycleLabel: "Weekly",
    visitsPerMonth: 4,
    perVisit: 60,
    monthly: 240,
    addressLine: "123 Marsh View Lane, Richmond Hill",
  },
  channelsSent: { email: false, sms: false },
  sendingChannel: null,
  onGetStartedNow: vi.fn(),
  onAlsoSend: vi.fn(),
  onNeedSomethingElse: vi.fn(),
  onClose: vi.fn(),
};

describe("ConfirmationModal — quote variant", () => {
  it("renders the maintenance headline + check-your-email pill when sent via email", () => {
    render(<ConfirmationModal {...baseQuoteProps} initialChannel="email" />);
    expect(screen.getByText("Almost There! Your Worry Free Pool Awaits")).toBeInTheDocument();
    expect(screen.getByText("Check your email")).toBeInTheDocument();
  });

  it("flips the pill to check-your-texts when initial channel is text", () => {
    render(<ConfirmationModal {...baseQuoteProps} initialChannel="text" />);
    expect(screen.getByText("Check your texts")).toBeInTheDocument();
  });

  it("renders the quote card with plan, cycle, monthly amount, and per-visit math", () => {
    render(<ConfirmationModal {...baseQuoteProps} />);
    expect(screen.getByText("Pool + Spa Combo")).toBeInTheDocument();
    expect(screen.getByText("Weekly · 4 visit month")).toBeInTheDocument();
    expect(screen.getByText("$240")).toBeInTheDocument();
    expect(screen.getByText("Plus chemicals")).toBeInTheDocument();
    expect(screen.getByText("(4 × $60/visit)")).toBeInTheDocument();
    expect(screen.getByText("123 Marsh View Lane, Richmond Hill")).toBeInTheDocument();
  });

  it("shows the secondary button in idle state when other channel not sent", () => {
    render(<ConfirmationModal {...baseQuoteProps} initialChannel="email" />);
    // user picked email first → secondary fires sms
    const btn = screen.getByRole("button", { name: /also text me the quote/i });
    expect(btn).toBeEnabled();
    expect(btn.className).not.toContain("is-sent");
  });

  it("shows the secondary button in sending state when sendingChannel matches", () => {
    render(
      <ConfirmationModal
        {...baseQuoteProps}
        initialChannel="email"
        sendingChannel="sms"
      />,
    );
    const btn = screen.getByRole("button", { name: /sending/i });
    expect(btn).toBeDisabled();
    expect(btn.className).toContain("is-sending");
  });

  it("shows the secondary button in green sent state when other channel sent", () => {
    render(
      <ConfirmationModal
        {...baseQuoteProps}
        initialChannel="email"
        channelsSent={{ email: true, sms: true }}
      />,
    );
    const btn = screen.getByRole("button", { name: /sent — check your texts/i });
    expect(btn).toBeDisabled();
    expect(btn.className).toContain("is-sent");
  });

  it("clicking Get Started Now calls onGetStartedNow", () => {
    const onGetStartedNow = vi.fn();
    render(<ConfirmationModal {...baseQuoteProps} onGetStartedNow={onGetStartedNow} />);
    fireEvent.click(screen.getByRole("button", { name: /get started now/i }));
    expect(onGetStartedNow).toHaveBeenCalledTimes(1);
  });

  it("clicking secondary fires onAlsoSend with the OTHER channel", () => {
    const onAlsoSend = vi.fn();
    render(
      <ConfirmationModal
        {...baseQuoteProps}
        initialChannel="email"
        onAlsoSend={onAlsoSend}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /also text me the quote/i }));
    expect(onAlsoSend).toHaveBeenCalledWith("sms");
  });

  it("clicking tertiary fires onNeedSomethingElse", () => {
    const onNeedSomethingElse = vi.fn();
    render(<ConfirmationModal {...baseQuoteProps} onNeedSomethingElse={onNeedSomethingElse} />);
    fireEvent.click(screen.getByRole("button", { name: /need something else/i }));
    expect(onNeedSomethingElse).toHaveBeenCalledTimes(1);
  });

  it("clicking close fires onClose", () => {
    const onClose = vi.fn();
    render(<ConfirmationModal {...baseQuoteProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows inline error when provided", () => {
    render(<ConfirmationModal {...baseQuoteProps} error="Send failed, try again" />);
    expect(screen.getByText("Send failed, try again")).toBeInTheDocument();
  });

  it("disables primary + changes copy when getStartedLoading", () => {
    render(<ConfirmationModal {...baseQuoteProps} getStartedLoading={true} />);
    const btn = screen.getByRole("button", { name: /getting started/i });
    expect(btn).toBeDisabled();
  });
});

describe("ConfirmationModal — service-request variants", () => {
  const baseTicketProps = {
    onNeedSomethingElse: vi.fn(),
    onClose: vi.fn(),
  };

  it("green_pool: renders service-specific headline + we'll-call-you pill", () => {
    render(<ConfirmationModal {...baseTicketProps} kind="green_pool" />);
    expect(screen.getByText(/help is on the way/i)).toBeInTheDocument();
    expect(screen.getByText("We'll call you back")).toBeInTheDocument();
  });

  it("green_pool: renders what-to-expect bullets", () => {
    render(<ConfirmationModal {...baseTicketProps} kind="green_pool" />);
    expect(screen.getByText("What happens next")).toBeInTheDocument();
    expect(
      screen.getByText(/a team member calls within 1 business day to schedule recovery/i),
    ).toBeInTheDocument();
  });

  it("equipment: renders diagnostic fee note", () => {
    render(<ConfirmationModal {...baseTicketProps} kind="equipment" />);
    expect(
      screen.getByText(/\$150 residential \/ \$185 commercial diagnostic fee applies/i),
    ).toBeInTheDocument();
  });

  it("renovation: renders psp partner copy", () => {
    render(<ConfirmationModal {...baseTicketProps} kind="renovation" />);
    expect(screen.getByText(/your dream pool is one call away/i)).toBeInTheDocument();
    expect(screen.getByText(/PSP/i)).toBeInTheDocument();
  });

  it("commercial: renders account-manager copy + we'll-be-in-touch pill", () => {
    render(<ConfirmationModal {...baseTicketProps} kind="commercial" />);
    expect(screen.getByText(/your property is in good hands/i)).toBeInTheDocument();
    expect(screen.getByText("We'll be in touch")).toBeInTheDocument();
  });

  it("non-quote variants do NOT show Get Started Now or secondary send buttons", () => {
    render(<ConfirmationModal {...baseTicketProps} kind="green_pool" />);
    expect(screen.queryByRole("button", { name: /get started now/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /also (email|text) me/i })).toBeNull();
  });

  it("non-quote variants STILL show Need something else? tertiary", () => {
    render(<ConfirmationModal {...baseTicketProps} kind="green_pool" />);
    expect(screen.getByRole("button", { name: /need something else/i })).toBeInTheDocument();
  });
});
