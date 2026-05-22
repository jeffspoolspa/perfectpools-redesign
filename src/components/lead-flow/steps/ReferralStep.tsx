// ReferralStep — the "How did you hear about us?" picker. Single-select
// over a short list of preset sources. Selecting a value auto-advances
// after a brief delay (so the user sees their selection register before
// the form moves on).
//
// Controlled component — owns no state. Parent passes the current
// value + onChange + onAdvance.

const SOURCES = [
  { id: "google", label: "Google", icon: "search" },
  { id: "social_media", label: "Social Media", icon: "share" },
  { id: "saw_truck", label: "Saw Our Truck", icon: "truck" },
  { id: "word_of_mouth", label: "Word of Mouth", icon: "users" },
  { id: "print_ad", label: "Print Advertisement", icon: "newspaper" },
  { id: "other", label: "Other", icon: "more" },
] as const;

export type ReferralSourceId = (typeof SOURCES)[number]["id"];

const ICONS: Record<string, preact.JSX.Element> = {
  search: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  share: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  truck: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  users: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  newspaper: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <line x1="10" y1="6" x2="18" y2="6" />
      <line x1="10" y1="10" x2="18" y2="10" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  ),
  more: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  ),
};

export interface ReferralStepProps {
  /** Currently selected source id, or '' if none picked yet. */
  value: string;
  /** Called when the user picks a source. */
  onChange: (source: ReferralSourceId) => void;
  /**
   * Called shortly after onChange so the orchestrator can auto-advance
   * to the next step. Optional — if omitted, parent handles advancement.
   */
  onAdvance?: () => void;
  /** ms delay between onChange and onAdvance — gives the user time to see the selection. */
  autoAdvanceDelayMs?: number;
}

export function ReferralStep({
  value,
  onChange,
  onAdvance,
  autoAdvanceDelayMs = 300,
}: ReferralStepProps) {
  return (
    <>
      <div class="intake-step-header">
        <div class="intake-step-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <h2 class="intake-step-title">How did you hear about us?</h2>
        <p class="intake-step-subtitle">This helps us serve the community better</p>
      </div>
      <div class="intake-surface-list">
        {SOURCES.map((rs) => (
          <button
            key={rs.id}
            type="button"
            class={`intake-surface-item${value === rs.id ? " selected" : ""}`}
            onClick={() => {
              onChange(rs.id);
              if (onAdvance) {
                window.setTimeout(onAdvance, autoAdvanceDelayMs);
              }
            }}
          >
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="color: var(--color-primary); flex-shrink: 0;">{ICONS[rs.icon]}</div>
              <h3>{rs.label}</h3>
            </div>
            <div class="intake-surface-radio" />
          </button>
        ))}
      </div>
    </>
  );
}
