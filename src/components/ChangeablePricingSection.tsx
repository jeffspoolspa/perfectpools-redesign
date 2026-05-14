import { useState } from 'preact/hooks';

/* ===================================================================
   ChangeablePricingSection — adapted from
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

export default function ChangeablePricingSection({
  title = 'Select a plan',
  plans,
  defaultPlanId,
  defaultCycle = 'weekly',
  lockedPlanId,
  footerText = 'Cancel anytime. No long-term contract.',
  buttonText = 'Continue',
  onContinue,
  initialCycle,
}: Props) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(
    lockedPlanId || defaultPlanId || (plans[0]?.id ?? 'pool'),
  );
  const [cycle, setCycle] = useState<Cycle>(initialCycle || defaultCycle);

  /* When lockedPlanId is set we still render only the locked plan's
     card. The toggle and features stay interactive. */
  const visiblePlans = lockedPlanId
    ? plans.filter(p => p.id === lockedPlanId)
    : plans;

  return (
    <div class="cps">
      {/* Header — title + cycle toggle (Weekly / Bi-Weekly) */}
      <div class="cps__header">
        <h3 class="cps__title">{title}</h3>
        <div class="cps__toggle" role="tablist" aria-label="Service frequency">
          {/* Sliding pill highlight — pure CSS via data-cycle attr
              on the parent + transform on the pseudo-element. */}
          <span class="cps__toggle-slider" data-cycle={cycle} aria-hidden="true" />
          <button
            type="button"
            role="tab"
            aria-selected={cycle === 'weekly'}
            class={`cps__toggle-btn ${cycle === 'weekly' ? 'is-active' : ''}`}
            onClick={() => setCycle('weekly')}
          >
            Weekly
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={cycle === 'biweekly'}
            class={`cps__toggle-btn ${cycle === 'biweekly' ? 'is-active' : ''}`}
            onClick={() => setCycle('biweekly')}
          >
            Bi-Weekly
          </button>
        </div>
      </div>

      {/* Plans list */}
      <div class="cps__plans">
        {visiblePlans.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          const priceStr = cycle === 'weekly' ? plan.priceWeekly : plan.priceBiweekly;
          return (
            <div
              key={plan.id}
              class={`cps__plan ${isSelected ? 'is-selected' : ''}`}
              onClick={() => setSelectedPlan(plan.id)}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e: any) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedPlan(plan.id);
                }
              }}
            >
              <div class="cps__plan-inner">
                {/* Top row: radio + name/description on left, price on right */}
                <div class="cps__plan-top">
                  <div class="cps__plan-left">
                    <div class="cps__radio" aria-hidden="true">
                      {isSelected && <CheckIcon size={11} color="#fff" strokeWidth={3.5} />}
                    </div>
                    <div class="cps__plan-info">
                      <div class="cps__plan-name-row">
                        <span class="cps__plan-name">{plan.name}</span>
                        {plan.badge && <span class="cps__plan-badge">{plan.badge}</span>}
                      </div>
                      <span class="cps__plan-desc">{plan.description}</span>
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
                <div class={`cps__plan-features ${isSelected ? 'is-open' : ''}`}>
                  <div class="cps__plan-features-inner">
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
      </div>

      {/* Footer — fine print + CTA */}
      <div class="cps__footer">
        <span class="cps__footer-text">{footerText}</span>
        <button
          type="button"
          class="cps__cta"
          onClick={() => onContinue?.(selectedPlan, cycle)}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
