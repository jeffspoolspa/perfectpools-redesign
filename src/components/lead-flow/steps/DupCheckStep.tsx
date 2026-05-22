// DupCheckStep — the "Is this you?" confirmation that fires after
// /api/customers/check-or-create (or the legacy /api/leads/submit)
// returns dedup_required=true. Shows the matched customer's redacted
// info and offers two buttons: "Yes, that's me" → use_existing, or
// "No, I'm a new customer" → create_new.
//
// Controlled component — owns no state. Parent passes the match data
// and the two action handlers; this component is purely presentational.

export interface DupMatch {
  /** Used when the parent calls onUseExisting (passed back as existing_customer_id). */
  customerId: number | null;
  /** Best-available display name — defaults to "FirstName L." from form data. */
  displayName: string;
  /** "***-***-1234" or similar; rendered if present. */
  redactedPhone?: string;
  /** "c***@example.com" or similar; rendered if present. */
  redactedEmail?: string;
}

export interface DupCheckStepProps {
  match: DupMatch;
  /**
   * "Yes, that's me." Parent resubmits the customer creation call with
   * customer_action='use_existing' + the customerId from `match`.
   */
  onUseExisting: () => void;
  /**
   * "No, I'm a new customer." Parent resubmits with
   * customer_action='create_new', forcing a brand-new customer row.
   */
  onCreateNew: () => void;
  /** Both buttons render in their loading state and disable. */
  loading?: boolean;
}

export function DupCheckStep({ match, onUseExisting, onCreateNew, loading = false }: DupCheckStepProps) {
  return (
    <>
      <div class="intake-step-header">
        <div class="intake-step-icon" style="background: #fef3c7;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 class="intake-step-title">We may already know you!</h2>
        <p class="intake-step-subtitle">It looks like we've done work at this property before.</p>
      </div>
      <div class="gs-existing-card">
        <div
          class="gs-existing-match"
          style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: var(--primary-light, #f0f7ff); border-radius: 0.75rem;"
        >
          <div
            style="width: 44px; height: 44px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #2563eb)" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <strong style="display: block; font-size: 1rem;">{match.displayName}</strong>
            {match.redactedPhone && (
              <span style="display: block; font-size: 0.85rem; color: var(--text-light);">
                Phone: {match.redactedPhone}
              </span>
            )}
            {match.redactedEmail && (
              <span style="display: block; font-size: 0.85rem; color: var(--text-light);">
                Email: {match.redactedEmail}
              </span>
            )}
          </div>
        </div>
        <p style="text-align: center; font-weight: 500; margin: 1rem 0 0.75rem;">Is this you?</p>
        <div class="gs-existing-choices">
          <button type="button" class="intake-cta-btn" disabled={loading} onClick={onUseExisting}>
            {loading ? "Saving..." : "Yes, that's me"}
          </button>
          <button type="button" class="intake-outline-btn" disabled={loading} onClick={onCreateNew}>
            {loading ? "Saving..." : "No, I'm a new customer"}
          </button>
        </div>
      </div>
    </>
  );
}
