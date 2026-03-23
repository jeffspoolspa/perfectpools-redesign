import { useState } from 'preact/hooks';

interface PricingConfiguratorProps {
  frequency: 'weekly' | 'biweekly';
  ctaHref: string;
}

const TYPES = [
  { id: 'pool', label: 'Pool', perVisit: 50, biweeklyPerVisit: 75 },
  { id: 'spa', label: 'Spa', perVisit: 45, biweeklyPerVisit: 70 },
  { id: 'combo', label: 'Pool + Spa', perVisit: 60, biweeklyPerVisit: 85 },
] as const;

const FOUNTAIN_ADD = 10;
const VISITS_PER_MONTH = 4.33;
const BIWEEKLY_VISITS = 2.17;

const CHECK_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#E28D33"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
const GREEN_CHECK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;

export default function PricingConfigurator({ frequency, ctaHref }: PricingConfiguratorProps) {
  const [activeType, setActiveType] = useState<string>('pool');
  const [hasFountain, setHasFountain] = useState(false);

  const isWeekly = frequency === 'weekly';
  const type = TYPES.find(t => t.id === activeType)!;
  const basePerVisit = isWeekly ? type.perVisit : type.biweeklyPerVisit;
  const perVisit = basePerVisit + (hasFountain ? FOUNTAIN_ADD : 0);
  const visits = isWeekly ? VISITS_PER_MONTH : BIWEEKLY_VISITS;
  const monthly = Math.round(perVisit * (isWeekly ? 4 : 2)); // Display monthly as clean number (4 or 2 visits)
  const title = isWeekly ? 'Weekly Service' : 'Bi-Weekly Service';

  const includes = isWeekly ? [
    'Complete water chemistry testing & balancing',
    'Pool surface skimming & debris removal',
    'Basket cleaning (skimmer & pump)',
    'Equipment inspection & monitoring',
    'Digital service report after every visit',
  ] : [
    'Complete water chemistry testing & balancing',
    'Pool surface skimming & debris removal',
    'Basket cleaning (skimmer & pump)',
    'Equipment inspection & monitoring',
    'Digital service report after every visit',
  ];

  const RED_X = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>`;

  return (
    <div class="pricing-config">
      <h3>{title}</h3>

      {/* Per visit hero price */}
      <div class="pricing-card__headline">
        <span class="pricing-card__period">per visit</span>
        <span class="pricing-card__price-line">
          <span class="pricing-card__amount">${perVisit}</span>
          <span class="pricing-card__plus-chem"><span class="plus-sign">Plus</span>Chemicals</span>
        </span>
      </div>

      {/* Service type tabs */}
      <div class="pricing-config__types">
        {TYPES.map(t => (
          <button
            key={t.id}
            class={`pricing-config__type ${activeType === t.id ? 'pricing-config__type--active' : ''}`}
            onClick={() => setActiveType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Fountain checkbox */}
      <label class="pricing-config__addon">
        <input
          type="checkbox"
          checked={hasFountain}
          onChange={(e) => setHasFountain((e.target as HTMLInputElement).checked)}
        />
        <span>Add fountain (+${FOUNTAIN_ADD}/visit)</span>
      </label>

      {/* Monthly derived line */}
      <div class="pricing-config__monthly">
        <span class="pricing-config__monthly-label">Per Month ({isWeekly ? 4 : 2} × ${perVisit}/visit)</span>
        <span class="pricing-config__monthly-amount">${monthly} <span class="pricing-config__monthly-chem"><span>Plus</span><span>Chemicals</span></span></span>
      </div>

      {/* Winter only notice for bi-weekly */}
      {!isWeekly && (
        <div class="pricing-config__notice pricing-config__notice--info" style="margin-top: 0.5rem; margin-bottom: 0.5rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          <div>
            <strong>Winter Service Only</strong>
            <span>Available September through March. Requires homeowner to manage chemicals between visits.</span>
          </div>
        </div>
      )}

      {isWeekly && (
        <p class="pricing-card__note">Assumes 4 visits per month. Some months may have 5 visits.</p>
      )}

      {/* Includes list */}
      <ul class="pricing-card__includes">
        {isWeekly && (
          <li class="pricing-card__green-guarantee" dangerouslySetInnerHTML={{
            __html: GREEN_CHECK + '<span>Green Free Guarantee <span class="tooltip-trigger">?<span class="tooltip">If your pool turns green between weekly visits, we fix it at no additional labor cost. Chemicals used for recovery are billed at standard cost-plus rates.</span></span></span>'
          }} />
        )}
        {!isWeekly && (
          <li class="pricing-card__no-guarantee" dangerouslySetInnerHTML={{
            __html: RED_X + '<span>No Green Free Guarantee <span class="tooltip-trigger">?<span class="tooltip">Bi-weekly service does not include our Green Free Guarantee. Algae recovery between visits is billed separately.</span></span></span>'
          }} />
        )}
        {includes.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: CHECK_SVG + item }} />
        ))}
      </ul>
    </div>
  );
}
