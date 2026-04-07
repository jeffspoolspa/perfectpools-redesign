import { useState, useEffect } from 'preact/hooks';

const SUPABASE_URL = 'https://vvprodiuwraceabviyes.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2cHJvZGl1d3JhY2VhYnZpeWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MDU4MTYsImV4cCI6MjA3MjQ4MTgxNn0.HOFTUrInpmzhxTJDSp1xKp81noC7jMuTcdxr9JqC3z0';
// Card-vault collect app URL
const CARD_VAULT_COLLECT_URL = 'https://secure.jeffspoolspa.com';

/* ── Types ── */
interface QuoteData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  serviceType: string;       // derived from bodies[]
  hasExtraBody: boolean;     // bodies.length > 1
  isBiweekly: boolean;       // visits_per_week === 0.5
  quotedPerVisit: number;
  quotedMonthly: number;     // = first_months_deposit
  visitsPerMonth: number;
  leadId?: string;           // uuid
}

/** Body row as returned inside the lead by public.get_lead_by_accept_token */
interface LeadBody {
  id: number;
  body_type: 'pool' | 'spa' | 'fountain';
  is_primary: boolean;
  is_short_term_rental: boolean;
  is_inground: boolean | null;
  is_screened_in: boolean | null;
  filter_type: string | null;
  chlorination_system: string | null;
  vegetation_level: string | null;
  has_auto_cleaner: boolean | null;
  has_dogs: boolean | null;
  pool_volume: number | null;
  access_instructions: string | null;
  special_instructions: string | null;
  service_street: string;
  service_city: string;
  service_state: string;
  service_zip: string;
}

/** Actual shape returned by public.get_lead_by_accept_token */
interface LeadByTokenResponse {
  token_expires_at: string;
  payment_on_file: boolean;
  lead: {
    id: string;                   // uuid
    account_id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    office: string;
    account_type: string;
    billing_street: string;
    billing_city: string;
    billing_state: string;
    billing_zip: string;
    bodies: LeadBody[];
    quoted_per_visit: number;
    visits_per_week: number;      // 0.5 | 1 | 2
    first_months_deposit: number;
    pool_condition: string;
    status: string;
    onboarding: any | null;
  };
}

/** Map a list of bodies to a legacy serviceType string for display */
function deriveServiceType(bodies: LeadBody[]): string {
  if (!bodies || bodies.length === 0) return 'pool';
  const types = bodies.map(b => b.body_type);
  const hasPool = types.includes('pool');
  const hasSpa = types.includes('spa');
  if (hasPool && hasSpa) return 'pool_spa_combo';
  // Prefer the primary body's type, falling back to the first
  const primary = bodies.find(b => b.is_primary) || bodies[0];
  return primary.body_type;
}

interface OnboardingData {
  isScreenedIn: string;
  poolVolume: string;
  chlorinationSystem: string;
  filterType: string;
  vegetationLevel: string;
  hasAutoCleaner: string;
  accessInstructions: string;
  hasDogs: string;
  specialInstructions: string;
  preferredStartDate: string;
  serviceDayPreference: string;
}

const SERVICE_LABELS: Record<string, string> = {
  pool: 'Pool Only',
  spa: 'Spa Only',
  pool_spa_combo: 'Pool + Spa Combo',
};

const DEFAULT_ONBOARDING: OnboardingData = {
  isScreenedIn: '', poolVolume: '', chlorinationSystem: '', filterType: '', vegetationLevel: '',
  hasAutoCleaner: '', accessInstructions: '', hasDogs: '', specialInstructions: '',
  preferredStartDate: '', serviceDayPreference: '',
};

const POOL_QUESTIONS = [
  { key: 'isScreenedIn', label: 'Screened In', summaryLabel: 'Screened' },
  { key: 'poolVolume', label: 'Pool Volume', summaryLabel: 'Gallons' },
  { key: 'chlorinationSystem', label: 'Chlorination', summaryLabel: 'Chlorination' },
  { key: 'filterType', label: 'Filter Type', summaryLabel: 'Filter' },
  { key: 'vegetationLevel', label: 'Vegetation', summaryLabel: 'Vegetation' },
  { key: 'hasAutoCleaner', label: 'Auto Cleaner', summaryLabel: 'Auto Cleaner' },
  { key: 'hasDogs', label: 'Dogs on Property', summaryLabel: 'Dogs', required: true },
  { key: 'accessInstructions', label: 'Access Info', summaryLabel: 'Access' },
  { key: 'specialInstructions', label: 'Special Instructions', summaryLabel: 'Instructions' },
  { key: 'serviceDayPreference', label: 'Service Day', summaryLabel: 'Service Day' },
] as const;

const DISPLAY_VALUES: Record<string, Record<string, string>> = {
  isScreenedIn: { yes: 'Yes', no: 'No' },
  poolVolume: {}, // freeform — display raw value + " gal"
  chlorinationSystem: { salt_cell: 'Salt Cell', tablet_feeder: 'Tablet Feeder' },
  filterType: { sand: 'Sand', cartridge: 'Cartridge' },
  vegetationLevel: { high: 'High', medium: 'Medium', low: 'Low' },
  hasAutoCleaner: { yes: 'Yes', no: 'No' },
  hasDogs: { yes: 'Yes', no: 'No' },
  serviceDayPreference: { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', no_preference: 'No Pref' },
};

/* ── Top-level step labels ── */
const TOP_STEPS = [
  { label: 'Secure Payment', step: 1 },
  { label: 'Pool Details & Start Date', step: 2 },
  { label: 'Worry Free Pool', step: 3 },
];

/* ── Main Component ── */
export default function GetStartedOnboarding() {
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [formData, setFormData] = useState<OnboardingData>(DEFAULT_ONBOARDING);
  const [currentStep, setCurrentStep] = useState(1); // 1=payment, 2=pool info, 3=confirmation
  const [poolStep, setPoolStep] = useState(0); // sub-step within pool info (0-8)

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Card collection state
  const [cardToken, setCardToken] = useState<string | null>(null);
  const [cardTokenLoading, setCardTokenLoading] = useState(false);
  const [cardTokenError, setCardTokenError] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const updateForm = (updates: Partial<OnboardingData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  /* Helper: advance to next sub-step */
  const nextPoolStep = () => setPoolStep(prev => Math.min(prev + 1, POOL_QUESTIONS.length - 1));
  const isLastPoolStep = poolStep === POOL_QUESTIONS.length - 1;

  /* ── Load quote data from session OR token ── */
  useEffect(() => {
    // 1. Try sessionStorage first (same-session flow)
    try {
      const raw = sessionStorage.getItem('getStartedOnboarding');
      if (raw) {
        setQuoteData(JSON.parse(raw));
        return;
      }
    } catch {}

    // 2. Check URL for resume token (returning customer via emailed/texted link)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      fetchLeadByToken(token);
    }
  }, []);

  async function fetchLeadByToken(token: string) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/get_lead_by_accept_token`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON,
            'Authorization': `Bearer ${SUPABASE_ANON}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_token: token }),
        }
      );
      if (!res.ok) return;
      const response: LeadByTokenResponse = await res.json();
      const lead = response?.lead;
      if (!lead || !lead.id) return;

      // Service address lives on the primary body, not the lead root
      const bodies = lead.bodies || [];
      const primaryBody = bodies.find(b => b.is_primary) || bodies[0];

      // Map new schema → internal QuoteData shape
      const isBiweekly = lead.visits_per_week === 0.5;
      const visitsPerMonth = lead.visits_per_week * 4; // 0.5→2, 1→4, 2→8
      const data: QuoteData = {
        firstName: lead.first_name || '',
        lastName: lead.last_name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        addressStreet: primaryBody?.service_street || lead.billing_street || '',
        addressCity: primaryBody?.service_city || lead.billing_city || '',
        addressState: primaryBody?.service_state || lead.billing_state || 'GA',
        addressZip: primaryBody?.service_zip || lead.billing_zip || '',
        serviceType: deriveServiceType(bodies),
        hasExtraBody: bodies.length > 1,
        isBiweekly,
        quotedPerVisit: lead.quoted_per_visit || 0,
        quotedMonthly: lead.first_months_deposit || 0,
        visitsPerMonth,
        leadId: lead.id,
      };
      setQuoteData(data);

      // If payment is already on file from a previous session, skip the
      // payment step and jump straight to pool details.
      if (response.payment_on_file) {
        setCardComplete(true);
        setCurrentStep(2);
      }

      // Save to sessionStorage so refreshes work. The URL token IS the access
      // credential — no separate "resume token" to persist.
      try { sessionStorage.setItem('getStartedOnboarding', JSON.stringify(data)); } catch {}
      try { sessionStorage.setItem('leadId', lead.id); } catch {}
    } catch (e) {
      console.error('Token fetch failed:', e);
      // Fail silently — user can start fresh
    }
  }

  /* ── Submit onboarding to Supabase ── */
  async function submitOnboarding() {
    // Get leadId from quoteData or sessionStorage
    const leadId = quoteData?.leadId || sessionStorage.getItem('leadId');
    if (!leadId) {
      setSubmitError('Missing lead reference. Please start over from the quote form.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    // Map UI string values → backend enum values per spec
    // chlorination_system: 'tablet' | 'salt' | 'liquid' | 'other'
    const chlorinationMap: Record<string, string> = {
      salt_cell: 'salt',
      tablet_feeder: 'tablet',
    };
    // filter_type: 'cartridge' | 'sand' | 'DE'
    const filterMap: Record<string, string> = {
      sand: 'sand',
      cartridge: 'cartridge',
    };

    const yesNoToBool = (v: string): boolean | null => {
      if (v === 'yes') return true;
      if (v === 'no') return false;
      return null;
    };

    const payload = {
      preferred_start_date: formData.preferredStartDate || null,
      service_day_preference: formData.serviceDayPreference || null,
      pool_details: {
        is_screened_in: yesNoToBool(formData.isScreenedIn),
        chlorination_system: chlorinationMap[formData.chlorinationSystem] || null,
        filter_type: filterMap[formData.filterType] || null,
        vegetation_level: formData.vegetationLevel || null,
        has_auto_cleaner: yesNoToBool(formData.hasAutoCleaner),
        has_dogs: yesNoToBool(formData.hasDogs),
        pool_volume: formData.poolVolume ? parseInt(formData.poolVolume, 10) : null,
        access_instructions: formData.accessInstructions || null,
        special_instructions: formData.specialInstructions || null,
      },
      agreed_to_terms: true,
    };

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_maintenance_onboarding`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_lead_id: leadId,
          p_payload: payload,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Submission failed');
      }

      const result = await res.json();
      if (result && result.error) {
        throw new Error(result.error);
      }

      // Success — move to confirmation step
      setCurrentStep(3);

      // Clean up session data
      try {
        sessionStorage.removeItem('getStartedQuote');
        sessionStorage.removeItem('getStartedOnboarding');
      } catch {}
    } catch (e: any) {
      console.error('Onboarding submission error:', e);
      setSubmitError(e.message || 'Something went wrong. Please try again or call us at (912) 459-0160.');
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Create card collection token when reaching payment step ── */
  async function initCardCollection() {
    const leadId = quoteData?.leadId || sessionStorage.getItem('leadId');
    if (!leadId) {
      setCardTokenError('Missing lead reference.');
      return;
    }
    setCardTokenLoading(true);
    setCardTokenError('');
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_card_collection_request`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_lead_id: leadId }),
      });
      if (!res.ok) throw new Error('Failed to initialize payment');
      const result = await res.json();
      if (result.error) {
        setCardTokenError(result.error);
        return;
      }
      setCardToken(result.token);
    } catch (e: any) {
      setCardTokenError(e.message || 'Failed to set up payment. Please try again or call us.');
    } finally {
      setCardTokenLoading(false);
    }
  }

  /* ── Tell the backend the card is on file. Idempotent on the server. ── */
  async function notifyPaymentOnFile() {
    const leadId = quoteData?.leadId || sessionStorage.getItem('leadId');
    if (!leadId) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/mark_payment_on_file`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_lead_id: leadId }),
      });
    } catch (e) {
      // Non-fatal — submit_maintenance_onboarding will still work; the lead
      // just won't auto-flip to "accepted" on the form-completion side.
      console.error('mark_payment_on_file failed:', e);
    }
  }

  /* ── Listen for card-vault postMessage (success + resize) ── */
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'card-vault-success') {
        setCardComplete(true);
        // Fire-and-forget: tell the backend the card is on file
        notifyPaymentOnFile();
      }
      // Auto-resize iframe to match content height
      if (event.data?.type === 'card-vault-resize' && event.data.height) {
        const iframe = document.getElementById('card-vault-iframe') as HTMLIFrameElement;
        if (iframe) iframe.style.height = `${event.data.height}px`;
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [quoteData]);

  /* ── When card is complete, advance to pool details ── */
  useEffect(() => {
    if (cardComplete && currentStep === 1) {
      // Short delay so user sees the success state before advancing
      const t = setTimeout(() => setCurrentStep(2), 1200);
      return () => clearTimeout(t);
    }
  }, [cardComplete]);

  /* Responsive: detect mobile for accordion layout */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /* ══════════════════════════════════
     Summary sidebar
     ══════════════════════════════════ */
  function renderSummary() {
    return (
      <div class="onboard-summary-inner">
        <h3 class="onboard-summary-title">Your Selections</h3>
        <ul class="onboard-summary-list">
          {POOL_QUESTIONS.map((q, i) => {
            const val = formData[q.key as keyof OnboardingData];
            const display = q.key === 'poolVolume' && val ? `${Number(val).toLocaleString()} gal` : (DISPLAY_VALUES[q.key]?.[val] || (val ? val : null));
            const answered = !!val;
            const isCurrent = poolStep === i;
            return (
              <li key={q.key} class={`onboard-summary-item${isCurrent ? ' current' : ''}${answered ? ' answered' : ''}`}>
                <button type="button" class="onboard-summary-link" onClick={() => setPoolStep(i)}>
                  <span class="onboard-summary-check">{answered ? '✓' : (i + 1)}</span>
                  <span class="onboard-summary-key">{q.summaryLabel}</span>
                  {answered && <span class="onboard-summary-val">{display}</span>}
                  {!answered && i < poolStep && <span class="onboard-summary-val onboard-summary-skipped">Skipped</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  /* ══════════════════════════════════
     Step 1 — Pool Info (mobile accordion)
     ══════════════════════════════════ */
  function renderPoolInfoMobile() {
    const dogsValid = formData.hasDogs !== '';
    const advance = (next: number) => setPoolStep(Math.min(next, POOL_QUESTIONS.length));

    const OptionCard = ({ value, selected, icon, label, onClick, isDay }: {
      value: string; selected: boolean; icon?: string; label: string; onClick: () => void; isDay?: boolean;
    }) => (
      <button type="button" class={`onboard-option${isDay ? ' onboard-option--day' : ''}${selected ? ' selected' : ''}`} onClick={onClick}>
        {icon && <span class="onboard-option-icon">{icon}</span>}
        <span class="onboard-option-label">{label}</span>
      </button>
    );

    const items: Array<{ key: string; title: string; render: () => any }> = [
      {
        key: 'isScreenedIn', title: 'Screened in?',
        render: () => (
          <div class="gs-radio-group">
            <button type="button" class={`gs-radio-btn${formData.isScreenedIn === 'yes' ? ' active' : ''}`} onClick={() => { updateForm({ isScreenedIn: 'yes' }); advance(1); }}>Yes</button>
            <button type="button" class={`gs-radio-btn${formData.isScreenedIn === 'no' ? ' active' : ''}`} onClick={() => { updateForm({ isScreenedIn: 'no' }); advance(1); }}>No</button>
          </div>
        ),
      },
      {
        key: 'chlorinationSystem', title: 'Chlorination System',
        render: () => (
          <div class="onboard-option-grid onboard-option-grid--2">
            <OptionCard value="salt_cell" selected={formData.chlorinationSystem === 'salt_cell'} icon="🧂" label="Salt Cell" onClick={() => { updateForm({ chlorinationSystem: 'salt_cell' }); advance(2); }} />
            <OptionCard value="tablet_feeder" selected={formData.chlorinationSystem === 'tablet_feeder'} icon="💊" label="Tablet Feeder" onClick={() => { updateForm({ chlorinationSystem: 'tablet_feeder' }); advance(2); }} />
          </div>
        ),
      },
      {
        key: 'filterType', title: 'Filter Type',
        render: () => (
          <div class="onboard-option-grid onboard-option-grid--2">
            <OptionCard value="sand" selected={formData.filterType === 'sand'} icon="🏖️" label="Sand Filter" onClick={() => { updateForm({ filterType: 'sand' }); advance(3); }} />
            <OptionCard value="cartridge" selected={formData.filterType === 'cartridge'} icon="🔲" label="Cartridge" onClick={() => { updateForm({ filterType: 'cartridge' }); advance(3); }} />
          </div>
        ),
      },
      {
        key: 'vegetationLevel', title: 'Vegetation Level',
        render: () => (
          <div class="onboard-option-grid">
            <OptionCard value="high" selected={formData.vegetationLevel === 'high'} icon="🌳" label="High" onClick={() => { updateForm({ vegetationLevel: 'high' }); advance(4); }} />
            <OptionCard value="medium" selected={formData.vegetationLevel === 'medium'} icon="🌿" label="Medium" onClick={() => { updateForm({ vegetationLevel: 'medium' }); advance(4); }} />
            <OptionCard value="low" selected={formData.vegetationLevel === 'low'} icon="☀️" label="Low" onClick={() => { updateForm({ vegetationLevel: 'low' }); advance(4); }} />
          </div>
        ),
      },
      {
        key: 'hasAutoCleaner', title: 'Automatic pool cleaner?',
        render: () => (
          <div class="gs-radio-group">
            <button type="button" class={`gs-radio-btn${formData.hasAutoCleaner === 'yes' ? ' active' : ''}`} onClick={() => { updateForm({ hasAutoCleaner: 'yes' }); advance(5); }}>Yes</button>
            <button type="button" class={`gs-radio-btn${formData.hasAutoCleaner === 'no' ? ' active' : ''}`} onClick={() => { updateForm({ hasAutoCleaner: 'no' }); advance(5); }}>No</button>
          </div>
        ),
      },
      {
        key: 'hasDogs', title: 'Dogs on property? *',
        render: () => (
          <>
            <p class="onboard-acc-hint">Required for technician safety</p>
            <div class="gs-radio-group">
              <button type="button" class={`gs-radio-btn${formData.hasDogs === 'yes' ? ' active' : ''}`} onClick={() => { updateForm({ hasDogs: 'yes' }); advance(6); }}>Yes</button>
              <button type="button" class={`gs-radio-btn${formData.hasDogs === 'no' ? ' active' : ''}`} onClick={() => { updateForm({ hasDogs: 'no' }); advance(6); }}>No</button>
            </div>
          </>
        ),
      },
      {
        key: 'accessInstructions', title: 'Gate Code / Access',
        render: () => (
          <>
            <input type="text" class="intake-input" value={formData.accessInstructions} onInput={(e: any) => updateForm({ accessInstructions: e.target.value })} placeholder="e.g., Gate code #1234" />
            <button type="button" class="onboard-acc-next" onClick={() => advance(7)}>
              {formData.accessInstructions ? 'Next' : 'Skip'} →
            </button>
          </>
        ),
      },
      {
        key: 'specialInstructions', title: 'Special Instructions',
        render: () => (
          <>
            <textarea class="intake-input" rows={3} value={formData.specialInstructions} onInput={(e: any) => updateForm({ specialInstructions: e.target.value })} placeholder="e.g., Pool cover, pets in yard" style="resize: vertical;" />
            <button type="button" class="onboard-acc-next" onClick={() => advance(8)}>
              {formData.specialInstructions ? 'Next' : 'Skip'} →
            </button>
          </>
        ),
      },
      {
        key: 'serviceDayPreference', title: 'Preferred Service Day',
        render: () => (
          <div class="onboard-option-grid" style="flex-wrap: wrap;">
            {[
              { val: 'monday', label: 'Mon' },
              { val: 'tuesday', label: 'Tue' },
              { val: 'wednesday', label: 'Wed' },
              { val: 'thursday', label: 'Thu' },
              { val: 'friday', label: 'Fri' },
              { val: 'no_preference', label: 'No Pref' },
            ].map(d => (
              <OptionCard key={d.val} value={d.val} selected={formData.serviceDayPreference === d.val} label={d.label} isDay onClick={() => { updateForm({ serviceDayPreference: d.val }); advance(9); }} />
            ))}
          </div>
        ),
      },
    ];

    return (
      <div class="onboard-accordion">
        {items.map((q, i) => {
          const isOpen = poolStep === i;
          const val = formData[q.key as keyof OnboardingData];
          const answered = !!val;
          const display = DISPLAY_VALUES[q.key]?.[val] || val;

          return (
            <div key={q.key} class={`onboard-acc-item${isOpen ? ' open' : ''}${answered && !isOpen ? ' answered' : ''}`}>
              <button type="button" class="onboard-acc-header" onClick={() => setPoolStep(isOpen ? -1 : i)}>
                <span class={`onboard-acc-check${answered ? ' done' : ''}`}>
                  {answered ? '✓' : i + 1}
                </span>
                <span class="onboard-acc-label">{q.title}</span>
                {!isOpen && answered && <span class="onboard-acc-value">{display}</span>}
                <svg class={`onboard-acc-chevron${isOpen ? ' rotated' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {isOpen && (
                <div class="onboard-acc-body">
                  {q.render()}
                </div>
              )}
            </div>
          );
        })}

        <div class="onboard-stacked-cta">
          <button type="button" class="intake-cta-btn" disabled={!dogsValid || submitting} onClick={() => submitOnboarding()}>
            {submitting ? 'Submitting...' : 'Complete Signup'} {!submitting && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>}
          </button>
          {submitError && (
            <p style="font-size: 0.8rem; color: #ef4444; text-align: center; margin-top: 0.5rem;">{submitError}</p>
          )}
          {!dogsValid && (
            <p style="font-size: 0.8rem; color: #ef4444; text-align: center; margin-top: 0.5rem;">
              * Please answer "Dogs on Property" before continuing
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════
     Step 1 — Pool Information (wizard)
     ══════════════════════════════════ */
  function renderPoolInfo() {
    if (isMobile) return renderPoolInfoMobile();
    const dogsValid = formData.hasDogs !== '';

    /* ── Helper: Card option ── */
    const OptionCard = ({ value, selected, icon, label, onClick, isDay }: {
      value: string; selected: boolean; icon?: string; label: string; onClick: () => void; isDay?: boolean;
    }) => (
      <button type="button" class={`onboard-option${isDay ? ' onboard-option--day' : ''}${selected ? ' selected' : ''}`} onClick={onClick}>
        {icon && <span class="onboard-option-icon">{icon}</span>}
        <span class="onboard-option-label">{label}</span>
      </button>
    );

    /* ── Render current sub-step ── */
    const renderSubStep = () => {
      switch (poolStep) {
        case 0: return (
          <div class="onboard-question revealed" key="q0">
            <h3 class="onboard-q-title">Is your pool screened in?</h3>
            <div class="gs-radio-group" style="max-width: 320px;">
              <button type="button" class={`gs-radio-btn${formData.isScreenedIn === 'yes' ? ' active' : ''}`} onClick={() => { updateForm({ isScreenedIn: 'yes' }); nextPoolStep(); }}>Yes</button>
              <button type="button" class={`gs-radio-btn${formData.isScreenedIn === 'no' ? ' active' : ''}`} onClick={() => { updateForm({ isScreenedIn: 'no' }); nextPoolStep(); }}>No</button>
            </div>
          </div>
        );
        case 1: return (
          <div class="onboard-question revealed" key="q1">
            <h3 class="onboard-q-title">Est. Pool Volume</h3>
            <p class="onboard-q-subtitle">Optional — if you know your pool's approximate size in gallons</p>
            <div style="display: flex; align-items: center; gap: 0.5rem; max-width: 280px;">
              <input
                type="number"
                class="intake-input"
                value={formData.poolVolume}
                onInput={(e: any) => updateForm({ poolVolume: e.target.value })}
                placeholder="e.g., 15000"
                min="0"
                step="500"
                style="flex: 1;"
              />
              <span style="color: var(--text-light); font-size: 0.9rem;">gallons</span>
            </div>
          </div>
        );
        case 2: return (
          <div class="onboard-question revealed" key="q2">
            <h3 class="onboard-q-title">
              Chlorination System
              <span class="onboard-tip" data-tip="How your pool sanitizes water. Salt cells generate chlorine from salt; tablet feeders dissolve chlorine pucks.">?</span>
            </h3>
            <div class="onboard-option-grid onboard-option-grid--2">
              <OptionCard value="salt_cell" selected={formData.chlorinationSystem === 'salt_cell'} icon="🧂" label="Salt Cell" onClick={() => { updateForm({ chlorinationSystem: 'salt_cell' }); nextPoolStep(); }} />
              <OptionCard value="tablet_feeder" selected={formData.chlorinationSystem === 'tablet_feeder'} icon="💊" label="Tablet Feeder" onClick={() => { updateForm({ chlorinationSystem: 'tablet_feeder' }); nextPoolStep(); }} />
            </div>
          </div>
        );
        case 3: return (
          <div class="onboard-question revealed" key="q3">
            <h3 class="onboard-q-title">
              Filter Type
              <span class="onboard-tip" data-tip="Sand filters use sand to trap debris; cartridge filters use a replaceable paper element.">?</span>
            </h3>
            <div class="onboard-option-grid onboard-option-grid--2">
              <OptionCard value="sand" selected={formData.filterType === 'sand'} icon="🏖️" label="Sand Filter" onClick={() => { updateForm({ filterType: 'sand' }); nextPoolStep(); }} />
              <OptionCard value="cartridge" selected={formData.filterType === 'cartridge'} icon="🔲" label="Cartridge" onClick={() => { updateForm({ filterType: 'cartridge' }); nextPoolStep(); }} />
            </div>
          </div>
        );
        case 4: return (
          <div class="onboard-question revealed" key="q4">
            <h3 class="onboard-q-title">Vegetation Level</h3>
            <p class="onboard-q-subtitle">How many trees and plants surround your pool?</p>
            <div class="onboard-option-grid">
              <OptionCard value="high" selected={formData.vegetationLevel === 'high'} icon="🌳" label="High" onClick={() => { updateForm({ vegetationLevel: 'high' }); nextPoolStep(); }} />
              <OptionCard value="medium" selected={formData.vegetationLevel === 'medium'} icon="🌿" label="Medium" onClick={() => { updateForm({ vegetationLevel: 'medium' }); nextPoolStep(); }} />
              <OptionCard value="low" selected={formData.vegetationLevel === 'low'} icon="☀️" label="Low" onClick={() => { updateForm({ vegetationLevel: 'low' }); nextPoolStep(); }} />
            </div>
          </div>
        );
        case 5: return (
          <div class="onboard-question revealed" key="q5">
            <h3 class="onboard-q-title">Do you have an automatic pool cleaner?</h3>
            <div class="gs-radio-group" style="max-width: 320px;">
              <button type="button" class={`gs-radio-btn${formData.hasAutoCleaner === 'yes' ? ' active' : ''}`} onClick={() => { updateForm({ hasAutoCleaner: 'yes' }); nextPoolStep(); }}>Yes</button>
              <button type="button" class={`gs-radio-btn${formData.hasAutoCleaner === 'no' ? ' active' : ''}`} onClick={() => { updateForm({ hasAutoCleaner: 'no' }); nextPoolStep(); }}>No</button>
            </div>
          </div>
        );
        case 6: return (
          <div class="onboard-question revealed" key="q6">
            <h3 class="onboard-q-title">Are there dogs on the property? <span style="color: #ef4444;">*</span></h3>
            <p class="onboard-q-subtitle">Required for technician safety</p>
            <div class="gs-radio-group" style="max-width: 320px;">
              <button type="button" class={`gs-radio-btn${formData.hasDogs === 'yes' ? ' active' : ''}`} onClick={() => { updateForm({ hasDogs: 'yes' }); nextPoolStep(); }}>Yes</button>
              <button type="button" class={`gs-radio-btn${formData.hasDogs === 'no' ? ' active' : ''}`} onClick={() => { updateForm({ hasDogs: 'no' }); nextPoolStep(); }}>No</button>
            </div>
          </div>
        );
        case 7: return (
          <div class="onboard-question revealed" key="q7">
            <h3 class="onboard-q-title">Gate Code / Access Instructions</h3>
            <p class="onboard-q-subtitle">How do we get to your pool?</p>
            <input
              type="text"
              class="intake-input"
              value={formData.accessInstructions}
              onInput={(e: any) => updateForm({ accessInstructions: e.target.value })}
              placeholder="e.g., Gate code #1234, key under mat"
              style="max-width: 400px;"
            />
          </div>
        );
        case 8: return (
          <div class="onboard-question revealed" key="q8">
            <h3 class="onboard-q-title">Special Instructions</h3>
            <p class="onboard-q-subtitle">Anything else we should know?</p>
            <textarea
              class="intake-input"
              rows={3}
              value={formData.specialInstructions}
              onInput={(e: any) => updateForm({ specialInstructions: e.target.value })}
              placeholder="e.g., Pool cover, pets in yard, preferred chemicals"
              style="max-width: 400px; resize: vertical;"
            />
          </div>
        );
        case 9: return (
          <div class="onboard-question revealed" key="q9">
            <h3 class="onboard-q-title">Preferred Service Day</h3>
            <p class="onboard-q-subtitle">We'll do our best to accommodate your preference</p>
            <div class="onboard-option-grid">
              {[
                { val: 'monday', label: 'Mon' },
                { val: 'tuesday', label: 'Tue' },
                { val: 'wednesday', label: 'Wed' },
                { val: 'thursday', label: 'Thu' },
                { val: 'friday', label: 'Fri' },
                { val: 'no_preference', label: 'No Pref' },
              ].map(d => (
                <OptionCard key={d.val} value={d.val} selected={formData.serviceDayPreference === d.val} label={d.label} isDay onClick={() => updateForm({ serviceDayPreference: d.val })} />
              ))}
            </div>
          </div>
        );
        default: return null;
      }
    };

    const subPct = Math.round(((poolStep + 1) / POOL_QUESTIONS.length) * 100);

    return (
      <>
        <div class="onboard-sub-progress">
          <div class="onboard-sub-track">
            <div class="onboard-sub-fill" style={`width:${subPct}%`} />
          </div>
          <span class="onboard-sub-label">{poolStep + 1} of {POOL_QUESTIONS.length}</span>
        </div>

        <div class="gs-fade-in" key={poolStep}>
          {renderSubStep()}
        </div>

        {/* Navigation */}
        <div class="onboard-nav">
          {poolStep > 0 && (
            <button type="button" class="onboard-nav-back" onClick={() => setPoolStep(prev => prev - 1)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          )}
          {poolStep === 0 && <span />}

          {/* Skip for pool volume (1) and text fields (7, 8) */}
          {(poolStep === 1 || poolStep === 7 || poolStep === 8) && (
            <button type="button" class="onboard-nav-skip" onClick={() => nextPoolStep()}>
              {formData[POOL_QUESTIONS[poolStep].key as keyof OnboardingData] ? 'Next' : 'Skip'} →
            </button>
          )}

          {/* Service day — next/continue */}
          {poolStep === 9 && (
            <button type="button" class="intake-cta-btn" disabled={!dogsValid || submitting} onClick={() => submitOnboarding()} style="padding: 0.625rem 1.5rem; font-size: 0.9rem;">
              {submitting ? 'Submitting...' : 'Complete Signup'} {!submitting && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>}
            </button>
          )}
        </div>

        {poolStep === 9 && !dogsValid && (
          <p style="font-size: 0.8rem; color: #ef4444; text-align: center; margin-top: 0.5rem;">
            * Please answer <button type="button" style="color: #ef4444; text-decoration: underline; background: none; border: none; cursor: pointer; font: inherit; padding: 0;" onClick={() => setPoolStep(6)}>Dogs on Property</button> before continuing
          </p>
        )}
      </>
    );
  }

  /* ══════════════════════════════════
     Step 2 — Payment Placeholder
     ══════════════════════════════════ */
  function renderPayment() {
    // Initialize card collection token on first render of this step
    if (!cardToken && !cardTokenLoading && !cardTokenError) {
      initCardCollection();
    }

    return (
      <div style="max-width: 420px; margin: 0 auto;">
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <h2 class="intake-step-title">Secure Payment</h2>
          <p class="intake-step-subtitle">Your card won't be charged until you're confirmed on a route</p>
        </div>

        <div class="gs-quote-breakdown" style="margin: 0 0 1rem; display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: var(--primary-light, #f0f7ff); border-radius: 0.5rem;">
          <span style="font-weight: 500;">First Month's Pre-Payment</span>
          <span style="font-weight: 700; font-size: 1.1rem;">${quoteData!.quotedMonthly}</span>
        </div>
        <p style="font-size: 0.78rem; color: var(--text-light); margin-bottom: 1rem;">
          A temporary pre-authorization for ${quoteData!.quotedMonthly} will be placed on your card to verify it. This is <strong>not a charge</strong> and will drop off within 3-5 business days.
        </p>

        {/* Card collection — seamless embed */}
        {cardTokenLoading && (
          <div style="text-align: center; padding: 2rem;">
            <p style="color: var(--text-light);">Setting up secure payment...</p>
          </div>
        )}

        {cardTokenError && (
          <div style="text-align: center; padding: 2rem;">
            <p style="color: #dc2626; margin-bottom: 1rem;">{cardTokenError}</p>
            <button type="button" class="intake-outline-btn" onClick={() => { setCardTokenError(''); initCardCollection(); }}>
              Try Again
            </button>
            <p style="font-size: 0.85rem; color: var(--text-light); margin-top: 1rem;">
              Or call us at <a href="tel:9124590160" style="color: var(--primary);">(912) 459-0160</a>
            </p>
          </div>
        )}

        {cardToken && !cardComplete && (
          <iframe
            id="card-vault-iframe"
            src={`${CARD_VAULT_COLLECT_URL}/collect?token=${cardToken}&embed=true`}
            style={`width: 100%; border: none; height: ${isMobile ? '240px' : '260px'}; display: block; overflow: hidden;`}
            title="Secure card entry"
            allow="payment"
            scrolling="no"
          />
        )}

        {cardComplete && (
          <div style="text-align: center; padding: 1.5rem;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: #dcfce7; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <p style="color: #16a34a; font-weight: 500;">Card verified successfully!</p>
            <p style="color: var(--text-light); font-size: 0.85rem; margin-top: 0.5rem;">Moving to pool details...</p>
          </div>
        )}

        <p style="font-size: 0.75rem; color: var(--text-light); text-align: center; margin-top: 0.75rem;">
          Your card information is encrypted before it leaves your device
        </p>
      </div>
    );
  }

  /* ══════════════════════════════════
     Step 3 — Confirmation
     ══════════════════════════════════ */
  function renderConfirmation() {
    return (
      <div class="gs-sent-confirm">
        <div style="width: 80px; height: 80px; border-radius: 50%; background: #dcfce7; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>

        <h2 style="margin-bottom: 0.5rem; font-size: 1.5rem;">You're All Set! 🎉</h2>
        <p style="color: var(--text-light); margin-bottom: 2rem; font-size: 1.05rem;">
          We'll contact you within 48 hours to schedule your first service.
        </p>

        <div style="text-align: left; background: #f8fafc; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;">
          <h3 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-light); margin-bottom: 1rem;">Your Details</h3>
          <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-light);">Name</span>
              <span style="font-weight: 500;">{quoteData!.firstName} {quoteData!.lastName}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-light);">Email</span>
              <span style="font-weight: 500;">{quoteData!.email}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-light);">Phone</span>
              <span style="font-weight: 500;">{quoteData!.phone}</span>
            </div>
            {quoteData!.addressStreet && (
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-light);">Address</span>
                <span style="font-weight: 500; text-align: right; max-width: 60%;">{quoteData!.addressStreet}</span>
              </div>
            )}
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 0.25rem 0;" />
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-light);">Service</span>
              <span style="font-weight: 500;">{SERVICE_LABELS[quoteData!.serviceType] || 'Pool'}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-light);">Monthly Rate</span>
              <span style="font-weight: 600; color: var(--primary);">${quoteData!.quotedMonthly}/mo</span>
            </div>
            {formData.hasDogs === 'yes' && (
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-light);">Dogs</span>
                <span style="font-weight: 500;">Yes 🐕</span>
              </div>
            )}
          </div>
        </div>

        <p style="font-size: 0.9rem; color: var(--text-light);">
          Questions? Call us at{' '}
          <a href="tel:9124590160" style="color: var(--primary); font-weight: 600;">(912) 459-0160</a>
        </p>
      </div>
    );
  }

  /* ── No quote data — show fallback ── */
  if (!quoteData) {
    return (
      <div class="gs-card">
        <div class="intake-body" style="text-align: center; padding: 3rem 1.5rem;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: #fef3c7; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 style="margin-bottom: 0.5rem;">Let's Get Your Quote First</h2>
          <p style="color: var(--text-light); margin-bottom: 1.5rem;">
            You'll need a personalized quote before completing your signup.
          </p>
          <button
            type="button"
            class="intake-cta-btn"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('openGetStarted'));
              window.history.back();
            }}
          >
            Get Your Quote
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="onboard-wrapper">
      {/* ── Top-level progress bar — hidden on mobile ── */}
      {!isMobile && (
        <nav class="onboard-top-progress" aria-label="Signup progress">
          {TOP_STEPS.map((s, i) => (
            <div key={s.step} class={`onboard-top-step${currentStep === s.step ? ' active' : ''}${currentStep > s.step ? ' completed' : ''}`}>
              <span class="onboard-top-num">{currentStep > s.step ? '✓' : i + 1}</span>
              <span class="onboard-top-label">{s.label}</span>
            </div>
          ))}
        </nav>
      )}

      {/* ── Centered content: summary + card side-by-side ── */}
      <div class="onboard-center">
        {currentStep === 2 && (
          <aside class="onboard-summary">{renderSummary()}</aside>
        )}

        <div class={`gs-card onboard-card${currentStep !== 2 ? ' onboard-card--solo' : ''}`}>
          {/* Step content */}
          <div class="intake-body gs-fade-in" key={currentStep}>
            {currentStep === 1 && renderPayment()}
            {currentStep === 2 && renderPoolInfo()}
            {currentStep === 3 && renderConfirmation()}
          </div>
        </div>
      </div>
    </div>
  );
}
