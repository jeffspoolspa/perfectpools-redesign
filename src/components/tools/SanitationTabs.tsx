import { useState } from 'preact/hooks';
import HOClWaterfall from './HOClWaterfall';
import HOClCalculator from './HOClCalculator';

/**
 * Sanitation pillar container.
 *
 * Two slides behind a Tesla-style pill segmented control:
 *   1. "Active HOCl"      — the waterfall chart: how much of your FC
 *                           actually kills algae, based on pH and CYA.
 *   2. "Daily Protection" — the 24-hour timeline: how pump runtime,
 *                           cell output, and demand interact to keep
 *                           active HOCl above the 0.05 floor all day.
 *
 * Shared state lives HERE, not in the individual tabs: Free Chlorine,
 * pH, and CYA are set on Tab 1 (where the user discovers the RIGHT
 * target) and then consumed by Tab 2 (where they figure out whether
 * their equipment can actually hit that target). Tab 1's "See daily
 * protection →" button flips to Tab 2, carrying the chemistry forward.
 */

type TabKey = 0 | 1;

const TABS: { key: TabKey; label: string }[] = [
  { key: 0, label: 'Active HOCl' },
  { key: 1, label: 'Daily Protection' },
];

// Shared pool chemistry — the values that both tabs read from.
type PoolChem = {
  fc: number;   // ppm
  ph: number;
  cya: number;  // ppm
};

const DEFAULT_CHEM: PoolChem = {
  fc: 3,
  ph: 7.5,
  cya: 30,
};

export default function SanitationTabs() {
  const [active, setActive] = useState<TabKey>(0);
  const [chem, setChem] = useState<PoolChem>({ ...DEFAULT_CHEM });

  const updateChem = (patch: Partial<PoolChem>) => {
    setChem((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div class="sp-tabs">
      {/* ===== Pill segmented control (Tesla-style) ===== */}
      <div class="sp-tabs__switcher" role="tablist" aria-label="Sanitation view">
        <div
          class="sp-tabs__indicator"
          style={{ transform: `translateX(${active * 100}%)` }}
          aria-hidden="true"
        />
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            class={`sp-tabs__btn ${active === t.key ? 'is-active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== Panel — only the active tab is mounted ===== */}
      <div class="sp-tabs__panel" role="tabpanel">
        {active === 0 ? (
          <HOClWaterfall
            fc={chem.fc}
            ph={chem.ph}
            cya={chem.cya}
            onChemChange={updateChem}
            onGoToProtection={() => setActive(1)}
          />
        ) : (
          <HOClCalculator
            fc={chem.fc}
            ph={chem.ph}
            cya={chem.cya}
          />
        )}
      </div>
    </div>
  );
}
