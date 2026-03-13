import { useState, useEffect } from 'preact/hooks';

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
  serviceType: string;
  hasExtraBody: boolean;
  isBiweekly: boolean;
  quotedPerVisit: number;
  quotedMonthly: number;
  visitsPerMonth: number;
}

interface OnboardingData {
  isScreenedIn: string;
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
  isScreenedIn: '', chlorinationSystem: '', filterType: '', vegetationLevel: '',
  hasAutoCleaner: '', accessInstructions: '', hasDogs: '', specialInstructions: '',
  preferredStartDate: '', serviceDayPreference: '',
};

const POOL_QUESTIONS = [
  { key: 'isScreenedIn', label: 'Screened In', summaryLabel: 'Screened' },
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
  chlorinationSystem: { salt_cell: 'Salt Cell', tablet_feeder: 'Tablet Feeder' },
  filterType: { sand: 'Sand', cartridge: 'Cartridge' },
  vegetationLevel: { high: 'High', medium: 'Medium', low: 'Low' },
  hasAutoCleaner: { yes: 'Yes', no: 'No' },
  hasDogs: { yes: 'Yes', no: 'No' },
  serviceDayPreference: { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', no_preference: 'No Pref' },
};

/* ── Top-level step labels ── */
const TOP_STEPS = [
  { label: 'Pool Details & Start Date', step: 1 },
  { label: 'Payment', step: 2 },
  { label: 'Worry Free Pool', step: 3 },
];

/* ── Main Component ── */
export default function GetStartedOnboarding() {
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [formData, setFormData] = useState<OnboardingData>(DEFAULT_ONBOARDING);
  const [currentStep, setCurrentStep] = useState(1); // 1=pool info, 2=payment, 3=confirmation
  const [poolStep, setPoolStep] = useState(0); // sub-step within pool info (0-8)
  const [isMobile, setIsMobile] = useState(false);

  const updateForm = (updates: Partial<OnboardingData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  /* Helper: advance to next sub-step */
  const nextPoolStep = () => setPoolStep(prev => Math.min(prev + 1, POOL_QUESTIONS.length - 1));
  const isLastPoolStep = poolStep === POOL_QUESTIONS.length - 1;

  /* ── Load quote data from session ── */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('getStartedOnboarding');
      if (raw) {
        setQuoteData(JSON.parse(raw));
      }
    } catch {}
  }, []);

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
            const display = DISPLAY_VALUES[q.key]?.[val] || (val ? val : null);
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
          <button type="button" class="intake-cta-btn" disabled={!dogsValid} onClick={() => setCurrentStep(2)}>
            Continue to Payment <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
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
        case 2: return (
          <div class="onboard-question revealed" key="q2">
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
        case 3: return (
          <div class="onboard-question revealed" key="q3">
            <h3 class="onboard-q-title">Vegetation Level</h3>
            <p class="onboard-q-subtitle">How many trees and plants surround your pool?</p>
            <div class="onboard-option-grid">
              <OptionCard value="high" selected={formData.vegetationLevel === 'high'} icon="🌳" label="High" onClick={() => { updateForm({ vegetationLevel: 'high' }); nextPoolStep(); }} />
              <OptionCard value="medium" selected={formData.vegetationLevel === 'medium'} icon="🌿" label="Medium" onClick={() => { updateForm({ vegetationLevel: 'medium' }); nextPoolStep(); }} />
              <OptionCard value="low" selected={formData.vegetationLevel === 'low'} icon="☀️" label="Low" onClick={() => { updateForm({ vegetationLevel: 'low' }); nextPoolStep(); }} />
            </div>
          </div>
        );
        case 4: return (
          <div class="onboard-question revealed" key="q4">
            <h3 class="onboard-q-title">Do you have an automatic pool cleaner?</h3>
            <div class="gs-radio-group" style="max-width: 320px;">
              <button type="button" class={`gs-radio-btn${formData.hasAutoCleaner === 'yes' ? ' active' : ''}`} onClick={() => { updateForm({ hasAutoCleaner: 'yes' }); nextPoolStep(); }}>Yes</button>
              <button type="button" class={`gs-radio-btn${formData.hasAutoCleaner === 'no' ? ' active' : ''}`} onClick={() => { updateForm({ hasAutoCleaner: 'no' }); nextPoolStep(); }}>No</button>
            </div>
          </div>
        );
        case 5: return (
          <div class="onboard-question revealed" key="q5">
            <h3 class="onboard-q-title">Are there dogs on the property? <span style="color: #ef4444;">*</span></h3>
            <p class="onboard-q-subtitle">Required for technician safety</p>
            <div class="gs-radio-group" style="max-width: 320px;">
              <button type="button" class={`gs-radio-btn${formData.hasDogs === 'yes' ? ' active' : ''}`} onClick={() => { updateForm({ hasDogs: 'yes' }); nextPoolStep(); }}>Yes</button>
              <button type="button" class={`gs-radio-btn${formData.hasDogs === 'no' ? ' active' : ''}`} onClick={() => { updateForm({ hasDogs: 'no' }); nextPoolStep(); }}>No</button>
            </div>
          </div>
        );
        case 6: return (
          <div class="onboard-question revealed" key="q6">
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
        case 7: return (
          <div class="onboard-question revealed" key="q7">
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
        case 8: return (
          <div class="onboard-question revealed" key="q8">
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

          {/* Skip for text fields (steps 6, 7) or Next for day preference (8) */}
          {(poolStep === 6 || poolStep === 7) && (
            <button type="button" class="onboard-nav-skip" onClick={() => nextPoolStep()}>
              {formData[POOL_QUESTIONS[poolStep].key as keyof OnboardingData] ? 'Next' : 'Skip'} →
            </button>
          )}

          {/* Service day — next/continue */}
          {poolStep === 8 && (
            <button type="button" class="intake-cta-btn" disabled={!dogsValid} onClick={() => setCurrentStep(2)} style="padding: 0.625rem 1.5rem; font-size: 0.9rem;">
              Continue to Payment <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
        </div>

        {poolStep === 8 && !dogsValid && (
          <p style="font-size: 0.8rem; color: #ef4444; text-align: center; margin-top: 0.5rem;">
            * Please answer <button type="button" style="color: #ef4444; text-decoration: underline; background: none; border: none; cursor: pointer; font: inherit; padding: 0;" onClick={() => setPoolStep(5)}>Dogs on Property</button> before continuing
          </p>
        )}
      </>
    );
  }

  /* ══════════════════════════════════
     Step 2 — Payment Placeholder
     ══════════════════════════════════ */
  function renderPayment() {
    return (
      <>
        <button type="button" class="onboard-nav-back" onClick={() => setCurrentStep(1)} style="margin-bottom: 1rem;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Pool Info
        </button>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <h2 class="intake-step-title">Secure Payment</h2>
          <p class="intake-step-subtitle">Your card won't be charged until your first service</p>
        </div>

        <div class="gs-payment-placeholder">
          <div style="text-align: center; padding: 2rem;">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h3 style="color: var(--text-light); margin-bottom: 0.5rem;">Payment Form Coming Soon</h3>
            <p style="color: var(--text-light); font-size: 0.85rem; margin-bottom: 1rem;">Secure card collection will be integrated here</p>
            <div class="gs-quote-breakdown" style="max-width: 280px; margin: 0 auto 1.5rem;">
              <div class="gs-quote-row gs-quote-row--total">
                <span>Monthly Rate</span>
                <span class="gs-quote-val">${quoteData!.quotedMonthly}/mo</span>
              </div>
            </div>
          </div>
        </div>

        <div class="intake-actions" style="margin-top: 1.5rem;">
          <button type="button" class="intake-cta-btn" onClick={() => setCurrentStep(3)}>
            Complete Signup (Demo) <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <p style="font-size: 0.75rem; color: var(--text-light); text-align: center; margin-top: 0.5rem;">🔒 Your payment info is encrypted and secure</p>
        </div>
      </>
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
        {currentStep === 1 && (
          <aside class="onboard-summary">{renderSummary()}</aside>
        )}

        <div class={`gs-card onboard-card${currentStep !== 1 ? ' onboard-card--solo' : ''}`}>
          {/* Step content */}
          <div class="intake-body gs-fade-in" key={currentStep}>
            {currentStep === 1 && renderPoolInfo()}
            {currentStep === 2 && renderPayment()}
            {currentStep === 3 && renderConfirmation()}
          </div>
        </div>
      </div>
    </div>
  );
}
