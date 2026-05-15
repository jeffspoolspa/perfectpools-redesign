import { useEffect, useState } from 'preact/hooks';
import ChemicalCostChart from './QuoteChemicalCostChart';

/* ===================================================================
   QuotePricingSection — form-only pricing component adapted from
   https://registry.watermelon.sh/r/changeable-pricing-section.json

   Source was React + framer-motion + lucide-react + Tailwind. This
   port is Preact (no react), uses CSS transitions in place of
   framer-motion (no animation lib), inlines the SVGs in place of
   lucide-react (no icon lib), and uses plain classes that map to
   styles in global.css (no Tailwind).

   The original was a generic SaaS-style "select a plan" UI with a
   Monthly/Yearly toggle. We swapped that for our maintenance flow:
     - Top toggle: Weekly ↔ Bi-Weekly (frequency, not billing cycle)
     - Plans: per-body-type service tiers (Pool / Spa / Pool+Spa)
     - Features list expands under the selected plan and shows the
       checklist that used to live in the residential pricing card
       (Green Free Guarantee on weekly, water-chemistry, skimming,
       etc.)
   The visual structure (radio-style cards stacked in a rounded
   container, slide-animated price on toggle, expandable features
   under the selected card, CTA + footer at bottom) is preserved
   from the source.
   =================================================================== */

export type PlanId = 'pool' | 'spa' | 'combo';
export type Cycle = 'weekly' | 'biweekly';

export interface PlanFeature {
  text: string;
  hasInfo?: boolean;
  variant?: 'check' | 'green-guarantee' | 'no-guarantee';
}

export interface PricingPlan {
  id: PlanId;
  name: string;
  description: string;
  priceWeekly: string;   // display string (e.g. "$50")
  priceBiweekly: string; // display string (e.g. "$75")
  badge?: string;
  features: PlanFeature[];
}

interface Props {
  title?: string;
  plans: PricingPlan[];
  defaultPlanId?: PlanId;
  defaultCycle?: Cycle;
  /** Hide the plans-list interaction entirely and pre-select one.
      Used by the quote modal where the body type was chosen on a
      prior step — the user just sees their selected plan expanded. */
  lockedPlanId?: PlanId;
  footerText?: string;
  buttonText?: string;
  onContinue?: (planId: PlanId, cycle: Cycle) => void;
  /** Pre-set the toggle. Used by the quote modal to honour the
      frequency the user picked on the progressive page. */
  initialCycle?: Cycle;
  chemicalCostData?: any[] | null;
}

const CheckIcon = ({ size = 14, color = 'currentColor', strokeWidth = 3 }: { size?: number; color?: string; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const InfoIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const XIcon = ({ size = 14, color = 'currentColor', strokeWidth = 3 }: { size?: number; color?: string; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const LockIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.25" />
    <path d="M8 10.5V7.75a4 4 0 0 1 8 0v2.75" />
  </svg>
);

const CHEMICAL_AVERAGES: Record<Cycle, {
  amount: string;
  label: string;
  note: string;
}> = {
  weekly: {
    amount: '$25',
    label: 'Weekly average',
    note: 'Steady chemistry. Costs scale to your pool, not catch-up dosing.',
  },
  biweekly: {
    amount: '$31',
    label: 'Bi-weekly average',
    note: 'About 24% more chemicals per visit when two weeks pass between services.',
  },
};

const VISIT_COUNT_OPTIONS: Record<Cycle, number[]> = {
  weekly: [4, 5],
  biweekly: [2, 3],
};

const GRAPH_VISITS_PER_MONTH: Record<Cycle, { value: number; label: string }> = {
  weekly: { value: 4.333, label: '4.333' },
  biweekly: { value: 2.167, label: '2.167' },
};

function getBodyLabel(plan: PricingPlan) {
  if (plan.id === 'pool') return 'Pool only';
  if (plan.id === 'spa') return 'Spa only';
  return 'Pool + spa combo';
}

function parseDisplayPrice(price: string) {
  const value = Number(price.replace(/[^0-9.]/g, ''));
  return Number.isFinite(value) ? value : 0;
}

function isBiweeklyLockedNow(date = new Date()) {
  const monthDay = (date.getMonth() + 1) * 100 + date.getDate();
  return monthDay >= 401 && monthDay <= 831;
}

export default function QuotePricingSection({
  title = 'Select a plan',
  plans,
  defaultPlanId,
  defaultCycle = 'weekly',
  lockedPlanId,
  footerText = 'Cancel anytime. No long-term contract.',
  buttonText = 'Continue',
  onContinue,
  initialCycle,
  chemicalCostData,
}: Props) {
  const biweeklyLocked = isBiweeklyLockedNow();
  const requestedInitialCycle = initialCycle || defaultCycle;
  const resolvedInitialCycle = biweeklyLocked && requestedInitialCycle === 'biweekly'
    ? 'weekly'
    : requestedInitialCycle;
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(
    lockedPlanId || defaultPlanId || (plans[0]?.id ?? 'pool'),
  );
  const [cycle, setCycle] = useState<Cycle>(resolvedInitialCycle);
  const [activePanel, setActivePanel] = useState<'service' | 'chemicals' | null>(null);
  const [isTotalOpen, setIsTotalOpen] = useState(false);
  const [monthlyVisitCount, setMonthlyVisitCount] = useState(resolvedInitialCycle === 'biweekly' ? 2 : 4);
  const [winterNoticeKey, setWinterNoticeKey] = useState(0);
  const chemicalAverage = CHEMICAL_AVERAGES[cycle];
  const visitOptions = VISIT_COUNT_OPTIONS[cycle];
  const graphVisitAverage = GRAPH_VISITS_PER_MONTH[cycle];
  const selectedVisitCount = visitOptions.includes(monthlyVisitCount)
    ? monthlyVisitCount
    : visitOptions[0];

  /* When lockedPlanId is set we still render only the locked plan's
     card. The toggle and features stay interactive. */
  const visiblePlans = lockedPlanId
    ? plans.filter(p => p.id === lockedPlanId)
    : plans;
  const activePlan = visiblePlans.find(p => p.id === selectedPlan)
    || plans.find(p => p.id === selectedPlan)
    || visiblePlans[0]
    || plans[0];
  const activeLaborPrice = activePlan
    ? (cycle === 'weekly' ? activePlan.priceWeekly : activePlan.priceBiweekly)
    : '$0';
  const laborPerVisit = parseDisplayPrice(activeLaborPrice);
  const chemicalPerVisit = parseDisplayPrice(chemicalAverage.amount);
  const totalPerVisit = laborPerVisit + chemicalPerVisit;
  const serviceMonthly = Math.round(laborPerVisit * graphVisitAverage.value);
  const estimatedMonthlyTotal = Math.round(totalPerVisit * selectedVisitCount);
  const chemicalDemandData = (chemicalCostData || []).filter((row: any) => row.service_frequency === 'weekly');
  const hasChemicalDemandData = chemicalDemandData.length >= 6;
  const toggleServicePanel = (planId: PlanId) => {
    const isOpen = selectedPlan === planId && activePanel === 'service';
    setSelectedPlan(planId);
    setIsTotalOpen(false);
    setActivePanel(isOpen ? null : 'service');
  };
  const toggleChemicalPanel = () => {
    const isOpen = activePanel === 'chemicals';
    setIsTotalOpen(false);
    setActivePanel(isOpen ? null : 'chemicals');
  };
  const toggleTotalPanel = () => {
    const willOpen = !isTotalOpen;
    setIsTotalOpen(willOpen);
    if (willOpen) setActivePanel(null);
  };
  const showWinterNotice = biweeklyLocked && winterNoticeKey > 0;
  const selectWeekly = () => {
    setCycle('weekly');
    setMonthlyVisitCount(4);
  };
  const selectBiweekly = () => {
    if (biweeklyLocked) {
      setWinterNoticeKey(key => key + 1);
      selectWeekly();
      return;
    }

    setCycle('biweekly');
    setMonthlyVisitCount(2);
  };

  useEffect(() => {
    if (!winterNoticeKey) return;

    const timer = window.setTimeout(() => {
      setWinterNoticeKey(0);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [winterNoticeKey]);

  return (
    <div class="cps">
      {/* Header — title + cycle toggle (Weekly / Bi-Weekly) */}
      <div class="cps__header">
        <h3 class="cps__title">{title}</h3>
        <div class="cps__toggle-wrap">
          {showWinterNotice && (
            <div
              key={winterNoticeKey}
              id="cps-biweekly-lock-note"
              class="cps__winter-note"
              role="status"
              aria-live="polite"
            >
              <span>Winter only</span>
              <small>Sep-Mar</small>
            </div>
          )}
          <div class="cps__toggle" role="tablist" aria-label="Service frequency">
            {/* Sliding pill highlight — pure CSS via data-cycle attr
                on the parent + transform on the pseudo-element. */}
            <span class="cps__toggle-slider" data-cycle={cycle} aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={cycle === 'weekly'}
              class={`cps__toggle-btn ${cycle === 'weekly' ? 'is-active' : ''}`}
              onClick={selectWeekly}
            >
              Weekly
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={cycle === 'biweekly'}
              aria-disabled={biweeklyLocked}
              aria-describedby={showWinterNotice ? 'cps-biweekly-lock-note' : undefined}
              class={`cps__toggle-btn ${cycle === 'biweekly' ? 'is-active' : ''} ${biweeklyLocked ? 'is-locked' : ''}`}
              onClick={selectBiweekly}
            >
              <span>Bi-Weekly</span>
              {biweeklyLocked && <LockIcon />}
            </button>
          </div>
        </div>
      </div>

      {/* Plans list */}
      <div class="cps__plans">
        {visiblePlans.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          const priceStr = cycle === 'weekly' ? plan.priceWeekly : plan.priceBiweekly;
          const serviceTitle = cycle === 'weekly' ? 'Weekly Service' : 'Bi-Weekly Service';
          const laborSubtitle = `${serviceTitle} · ${getBodyLabel(plan)}`;
          return (
            <div
              key={plan.id}
              class={`cps__plan ${isSelected ? 'is-selected' : ''}`}
              onClick={() => toggleServicePanel(plan.id)}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e: any) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleServicePanel(plan.id);
                }
              }}
            >
              <div class="cps__plan-inner">
                {/* Top row: labor label on left, labor price on right */}
                <div class="cps__plan-top">
                  <div class="cps__plan-left">
                    <div class="cps__plan-info">
                      <div class="cps__plan-name-row">
                        <span class="cps__plan-name">Labor</span>
                      </div>
                      <span class="cps__plan-desc">{laborSubtitle}</span>
                    </div>
                  </div>

                  <div class="cps__plan-price">
                    {/* Key on cycle + price re-runs the slide animation
                        whenever the toggle flips. Pure CSS — see the
                        .cps__plan-price-amount keyframes in global.css. */}
                    <span class="cps__plan-price-amount" key={`${plan.id}-${cycle}`}>
                      {priceStr}
                    </span>
                    <span class="cps__plan-price-unit">per visit</span>
                  </div>
                </div>

                {/* Expandable features — only on the selected plan */}
                <div class={`cps__plan-features ${isSelected && activePanel === 'service' ? 'is-open' : ''}`}>
                  <div class="cps__plan-features-inner">
                    <strong class="cps__features-heading">Includes:</strong>
                    <ul class="cps__feature-list">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} class={`cps__feature cps__feature--${feat.variant || 'check'}`}>
                          <span class="cps__feature-icon" aria-hidden="true">
                            {feat.variant === 'no-guarantee'
                              ? <XIcon size={14} color="#ef4444" strokeWidth={3} />
                              : feat.variant === 'green-guarantee'
                              ? <CheckIcon size={14} color="#059669" strokeWidth={3} />
                              : <CheckIcon size={14} color="#E28D33" strokeWidth={3} />
                            }
                          </span>
                          <span class="cps__feature-text">{feat.text}</span>
                          {feat.hasInfo && (
                            <span class="cps__feature-info" aria-hidden="true">
                              <InfoIcon size={13} />
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div class={`cps__chem-option ${activePanel === 'chemicals' ? 'is-open' : ''}`}>
          <button
            type="button"
            class="cps__chem-trigger"
            aria-expanded={activePanel === 'chemicals'}
            onClick={toggleChemicalPanel}
          >
            <div class="cps__chem-copy">
              <span class="cps__chem-name">Chemicals</span>
              <span class="cps__chem-desc">{chemicalAverage.label} per-visit estimate</span>
            </div>
            <div class="cps__chem-summary">
              <span class="cps__chem-price">
                <span class="cps__chem-price-amount" key={`chem-summary-${cycle}`}>~{chemicalAverage.amount}</span>
                <span class="cps__chem-price-unit">per visit</span>
              </span>
            </div>
          </button>

          <div class="cps__chem-details" aria-hidden={activePanel !== 'chemicals'}>
            <div class="cps__chem-details-inner">
              <div class="cps__chem-card">
                <div class="cps__chem-header">
                  <span class="chem-kicker">HOW CHEMICALS BILL</span>
                  <h4>Chemical Demand</h4>
                  <p>Chemicals stay itemized, so the bill follows what your pool actually needs each season.</p>
                </div>

                {hasChemicalDemandData ? (
                  <div class="cps__chem-chart">
                    <ChemicalCostChart
                      data={chemicalDemandData}
                      serviceMonthly={serviceMonthly}
                      compact
                      compactMode="demand-only"
                    />
                  </div>
                ) : (
                  <div class="strain-section cps__chem-strain" data-strain-active={cycle}>
                    <div class="strain-panel cps__chem-panel">
                      <div class="cps__chem-row">
                        <div>
                          <span class="cps__chem-row-label">Estimated chemicals</span>
                          <strong>{chemicalAverage.label}</strong>
                        </div>
                        <span class="strain-bar__value cps__chem-value">
                          <span class="strain-bar__amount" key={`chem-${cycle}`}>~{chemicalAverage.amount}</span>
                          <span class="strain-bar__unit">/visit</span>
                        </span>
                      </div>
                      <p class="strain-bar__note cps__chem-note">{chemicalAverage.note}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class={`cps__monthly ${isTotalOpen ? 'is-open' : ''}`}>
        <div class="cps__monthly-summary">
          <div class="cps__monthly-copy">
            <button
              type="button"
              class="cps__monthly-toggle"
              aria-expanded={isTotalOpen}
              onClick={toggleTotalPanel}
            >
              <span class="cps__monthly-label">
                Estimated monthly total
                <span class="cps__monthly-math">({selectedVisitCount} x ${totalPerVisit}/visit)</span>
              </span>
            </button>

            <div class="cps__visit-toggle" role="tablist" aria-label="Monthly visit count">
              {visitOptions.map((count) => (
                <button
                  key={count}
                  type="button"
                  role="tab"
                  aria-selected={selectedVisitCount === count}
                  class={`cps__visit-toggle-btn ${selectedVisitCount === count ? 'is-active' : ''}`}
                  onClick={() => setMonthlyVisitCount(count)}
                >
                  {count} visit month
                </button>
              ))}
            </div>
          </div>

          <span class="cps__monthly-price">
            <span class="cps__monthly-price-main" key={`monthly-${cycle}-${selectedVisitCount}-${estimatedMonthlyTotal}`}>
              ~${estimatedMonthlyTotal}
            </span>
            <span class="cps__monthly-price-unit">Labor + Chemicals</span>
          </span>
        </div>

        <div class="cps__monthly-details" aria-hidden={!isTotalOpen}>
          <div class="cps__monthly-details-inner">
            {hasChemicalDemandData ? (
              <div class="cps__monthly-chart">
                <ChemicalCostChart
                  data={chemicalDemandData}
                  serviceMonthly={serviceMonthly}
                  compact
                  compactMode="total-only"
                  competitorFlat={350}
                  visitsPerMonthLabel={graphVisitAverage.label}
                />
              </div>
            ) : (
              <p class="cps__monthly-note">
                Choose 4 or 5 visits to see how the monthly total changes in shorter and longer service months.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer — fine print + CTA */}
      <div class="cps__footer">
        <span class="cps__footer-text">{footerText}</span>
        <button
          type="button"
          class="cps__cta"
          data-intake-advance
          onClick={() => onContinue?.(selectedPlan, cycle)}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
