// Confirmation takeover that renders after the customer completes the
// intake flow (maintenance quote sent, ticket filed, or commercial
// inquiry submitted). Replaces the entire intake modal — no hero, no
// progress bar, no summary rail — so the customer sees an unambiguous
// "you're done, here's what happens next" screen.
//
// Five variants driven by a single CONFIRM_COPY dictionary plus the
// `kind` prop. The quote variant additionally shows a pricing card
// pulled from the parent's calculated price.
//
// Extracted from GetStartedQuoteV2.tsx in PR C so the modal can be
// rendered + tested in isolation, and so the per-service copy lives
// in one obvious place when product wants to tweak the wording.

import { assetPath } from "../../utils/base-url";

export type ConfirmKind =
  | "quote"
  | "green_pool"
  | "equipment"
  | "renovation"
  | "commercial";

/**
 * The data shown on the quote-variant pricing card. Mirrors the layout
 * of QuotePricingSection's cps__monthly block (plan + cycle on the
 * left, monthly amount + "Plus chemicals" eyebrow on the right).
 */
export interface ConfirmationQuoteCard {
  planLabel: string;        // "Pool + Spa Combo"
  cycleLabel: string;       // "Weekly" | "Bi-Weekly"
  visitsPerMonth: number;   // 4 | 2
  perVisit: number;
  monthly: number;
  addressLine?: string;     // "123 Marsh View Lane, Richmond Hill" — shown in the row
}

export interface ConfirmationModalProps {
  /** Which variant to render. */
  kind: ConfirmKind;

  /**
   * Required for kind='quote'. Holds the recap data shown in the
   * pricing card.
   */
  quote?: ConfirmationQuoteCard;

  /**
   * Required for kind='quote'. The channel the customer fired FIRST
   * (drives the "Check your email/text" pill text). The pill is
   * locked to this value; subsequent secondary-button sends don't
   * flip it.
   */
  initialChannel?: "email" | "text";

  /**
   * Required for kind='quote'. Which channels have been successfully
   * sent so far. Drives the secondary button state (sent shows green
   * check + disabled; not-sent shows the outline button).
   */
  channelsSent?: { email: boolean; sms: boolean };

  /**
   * Required for kind='quote'. The channel currently in flight (if
   * any). Drives the secondary button's spinner state.
   */
  sendingChannel?: "email" | "sms" | null;

  /**
   * Required for kind='quote'. Called when the customer clicks
   * "Get Started Now". Parent owns the API call (typically
   * /api/leads/accept then redirect).
   */
  onGetStartedNow?: () => void;

  /**
   * Required for kind='quote'. True while the get-started API call
   * is in flight. Disables the button + changes copy to "Getting
   * started…".
   */
  getStartedLoading?: boolean;

  /**
   * Required for kind='quote'. Called when the customer clicks the
   * secondary "Also email/text me the quote" button. Parent fires
   * the apiSendQuote call and updates channelsSent on success.
   */
  onAlsoSend?: (channel: "email" | "sms") => void;

  /**
   * Called when the customer clicks the tertiary "Need something
   * else?" link. Parent should reset the lead-side state (leadId,
   * leadToken, channelsSent, etc.) and bounce the user back to the
   * qualifier page (preserving address + contact + accountId so the
   * next submit links under the same customer without re-dedup).
   */
  onNeedSomethingElse: () => void;

  /** Called when the customer clicks the close (X) button. */
  onClose: () => void;

  /**
   * Optional inline error to show below the quote card / above the
   * actions. Used to surface send-quote / accept-lead failures
   * without leaving the modal.
   */
  error?: string;
}

/* Per-service copy. Keep the headline consistent across all flows
   ("Almost There!") so the modal reads like the same UX regardless of
   which service was requested — only the subhead and what-to-expect
   content vary. */
const CONFIRM_COPY: Record<
  Exclude<ConfirmKind, "quote">,
  { title: string; pillText: string; expect: string[]; note?: string }
> = {
  green_pool: {
    title: "Help Is On The Way — Crystal Water Awaits",
    pillText: "We'll call you back",
    expect: [
      "A team member calls within 1 business day to schedule recovery",
      "Most green pools clear up in 5–7 days",
      "Flat-rate recovery quote — no surprises",
    ],
  },
  equipment: {
    title: "Got It — Repair Help Is Coming",
    pillText: "We'll call you back",
    expect: [
      "A technician calls within 1 business day to schedule the diagnostic",
      "Most repairs completed same day; parts ordered if needed",
    ],
    note: "$150 residential / $185 commercial diagnostic fee applies.",
  },
  renovation: {
    title: "Your Dream Pool Is One Call Away",
    pillText: "We'll call you back",
    expect: [
      "Our renovation partner (PSP) reaches out within 1–2 business days",
      "Site visit scheduled to scope the project",
      "Custom quote for replaster, retile, or full remodel",
    ],
  },
  commercial: {
    title: "Your Property Is In Good Hands",
    pillText: "We'll be in touch",
    expect: [
      "A commercial account manager reaches out within 24 hours",
      "Free on-site visit to walk the property and scope service",
      "Custom service agreement built around your hours and budget",
    ],
  },
};

export function ConfirmationModal(props: ConfirmationModalProps) {
  const {
    kind,
    quote,
    initialChannel,
    channelsSent = { email: false, sms: false },
    sendingChannel = null,
    onGetStartedNow,
    getStartedLoading = false,
    onAlsoSend,
    onNeedSomethingElse,
    onClose,
    error,
  } = props;

  const isQuote = kind === "quote";
  const copy = isQuote ? null : CONFIRM_COPY[kind];

  // For the quote variant: which channel the customer DIDN'T pick first
  // (drives the secondary button's channel target).
  const otherChannel: "email" | "sms" =
    initialChannel === "email" ? "sms" : "email";

  const title = isQuote
    ? "Almost There! Your Worry Free Pool Awaits"
    : copy?.title ?? "";

  const pillText = isQuote
    ? initialChannel === "email"
      ? "Check your email"
      : "Check your texts"
    : copy?.pillText ?? "";

  return (
    <div
      class="intake-overlay is-open intake-overlay--confirm"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div class="intake-modal intake-modal--confirm">
        <button class="intake-close-btn" onClick={onClose} aria-label="Close">
          <svg
            width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div class="intake-confirm">
          <div class="intake-confirm__media">
            <img
              src={assetPath("images/hero-residential-pool.webp")}
              alt="Crystal-clear backyard pool"
              loading="eager"
            />
          </div>
          <div class="intake-confirm__body">
            <div class="intake-confirm__status-row">
              <div class="intake-confirm__badge" aria-hidden="true">
                <svg
                  width="22" height="22" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2.5"
                  stroke-linecap="round" stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p class="intake-confirm__subtitle">
                <span class="intake-confirm__subtitle-icon" aria-hidden="true">
                  {isQuote ? (
                    initialChannel === "email" ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="m3 7 9 6 9-6" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    )
                  ) : (
                    /* Phone icon for the call-back flows */
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  )}
                </span>
                {pillText}
              </p>
            </div>

            <h2 class="intake-confirm__title">{title}</h2>

            {isQuote && quote ? (
              /* Quote summary card — mirrors QuotePricingSection's
                 cps__monthly block: plan + cycle on the left, big
                 primary-blue monthly amount + "Plus chemicals"
                 eyebrow on the right. */
              <div class="intake-confirm__card">
                <div class="intake-confirm__card-head">
                  <div class="intake-confirm__card-plan">
                    <span class="intake-confirm__plan">{quote.planLabel}</span>
                    <span class="intake-confirm__cycle">
                      {quote.cycleLabel} · {quote.visitsPerMonth} visit month
                    </span>
                  </div>
                  <div class="intake-confirm__card-price">
                    <span class="intake-confirm__price-amount">${quote.monthly}</span>
                    <span class="intake-confirm__price-unit">Plus chemicals</span>
                  </div>
                </div>
                <div class="intake-confirm__card-math">
                  ({quote.visitsPerMonth} × ${quote.perVisit}/visit)
                </div>
                {quote.addressLine && (
                  <div class="intake-confirm__card-rows">
                    <div class="intake-confirm__card-row intake-confirm__card-row--address">
                      <span>Service address</span>
                      <span class="intake-confirm__card-row-value">{quote.addressLine}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : !isQuote && copy ? (
              /* What-to-expect card for the non-quote flows. Same
                 chrome as the quote card for visual consistency. */
              <div class="intake-confirm__card intake-confirm__card--expect">
                <h3 class="intake-confirm__expect-title">What happens next</h3>
                <ul class="intake-confirm__expect-list">
                  {copy.expect.map((item, idx) => (
                    <li key={idx} class="intake-confirm__expect-item">
                      <span class="intake-confirm__expect-bullet" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {copy.note && (
                  <p class="intake-confirm__expect-note">{copy.note}</p>
                )}
              </div>
            ) : null}

            {error && <p class="intake-confirm__error">{error}</p>}

            <div class="intake-confirm__actions">
              {isQuote && (
                <>
                  <button
                    type="button"
                    class="intake-confirm__primary"
                    onClick={onGetStartedNow}
                    disabled={getStartedLoading}
                  >
                    {getStartedLoading ? "Getting started…" : "Get Started Now"}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  {(() => {
                    /* Three states for the secondary channel button:
                       - sent: green check, disabled, "Sent — check your X"
                       - sending: spinner, disabled, "Sending…"
                       - idle: outline button, "Also email/text me the quote" */
                    const sent = channelsSent[otherChannel];
                    const sending = sendingChannel === otherChannel;
                    const otherLabel = otherChannel === "email" ? "email" : "text";
                    return (
                      <button
                        type="button"
                        class={`intake-confirm__secondary${sent ? " is-sent" : ""}${sending ? " is-sending" : ""}`}
                        onClick={() => onAlsoSend?.(otherChannel)}
                        disabled={sent || !!sendingChannel}
                        aria-pressed={sent}
                      >
                        {sent ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {`Sent — check your ${otherChannel === "email" ? "email" : "texts"}`}
                          </>
                        ) : sending ? (
                          <>
                            <span class="intake-confirm__spinner" aria-hidden="true" />
                            Sending…
                          </>
                        ) : (
                          `Also ${otherLabel} me the quote`
                        )}
                      </button>
                    );
                  })()}
                </>
              )}
              <button
                type="button"
                class="intake-confirm__tertiary"
                onClick={onNeedSomethingElse}
              >
                Need something else?
              </button>
            </div>

            <p class="intake-confirm__contact">
              Questions? Call <a href="tel:9124590160">(912) 459-0160</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
