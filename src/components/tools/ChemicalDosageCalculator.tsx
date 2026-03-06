import { useState } from 'preact/hooks';

type ChemicalType = 'chlorine' | 'ph-down' | 'ph-up' | 'alkalinity' | 'calcium' | 'cya' | 'salt';

interface ChemicalInfo {
  label: string;
  unit: string;
  idealMin: number;
  idealMax: number;
  currentLabel: string;
  targetLabel: string;
}

const chemicals: Record<ChemicalType, ChemicalInfo> = {
  chlorine: { label: 'Free Chlorine', unit: 'ppm', idealMin: 1, idealMax: 3, currentLabel: 'Current FC (ppm)', targetLabel: 'Target FC (ppm)' },
  'ph-down': { label: 'pH Down', unit: '', idealMin: 7.2, idealMax: 7.6, currentLabel: 'Current pH', targetLabel: 'Target pH' },
  'ph-up': { label: 'pH Up', unit: '', idealMin: 7.2, idealMax: 7.6, currentLabel: 'Current pH', targetLabel: 'Target pH' },
  alkalinity: { label: 'Total Alkalinity', unit: 'ppm', idealMin: 80, idealMax: 120, currentLabel: 'Current TA (ppm)', targetLabel: 'Target TA (ppm)' },
  calcium: { label: 'Calcium Hardness', unit: 'ppm', idealMin: 200, idealMax: 400, currentLabel: 'Current CH (ppm)', targetLabel: 'Target CH (ppm)' },
  cya: { label: 'Cyanuric Acid (Stabilizer)', unit: 'ppm', idealMin: 30, idealMax: 50, currentLabel: 'Current CYA (ppm)', targetLabel: 'Target CYA (ppm)' },
  salt: { label: 'Salt', unit: 'ppm', idealMin: 2700, idealMax: 3400, currentLabel: 'Current Salt (ppm)', targetLabel: 'Target Salt (ppm)' },
};

export default function ChemicalDosageCalculator() {
  const [poolVolume, setPoolVolume] = useState('');
  const [chemType, setChemType] = useState<ChemicalType>('chlorine');
  const [currentReading, setCurrentReading] = useState('');
  const [targetReading, setTargetReading] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const chem = chemicals[chemType];

  function calculate() {
    const vol = parseFloat(poolVolume) || 0;
    const current = parseFloat(currentReading) || 0;
    const target = parseFloat(targetReading) || 0;

    if (vol <= 0) {
      setResult('Please enter a valid pool volume.');
      return;
    }

    const diff = target - current;
    if (diff <= 0) {
      setResult('Target must be higher than current reading (or your levels are already adequate).');
      return;
    }

    let output = '';

    switch (chemType) {
      case 'chlorine': {
        // Liquid chlorine (12.5% sodium hypochlorite): ~1 gallon per 10,000 gal raises FC by ~10 ppm
        const liquidOz = (diff / 10) * (vol / 10000) * 128;
        // Cal-hypo (68%): ~2 oz per 10,000 gal per 1 ppm
        const calHypoOz = diff * (vol / 10000) * 2;
        output = `Liquid Chlorine (12.5%): ${(liquidOz / 128).toFixed(1)} gallons (${Math.round(liquidOz)} fl oz)\nCal-Hypo (68%): ${calHypoOz.toFixed(1)} oz`;
        break;
      }
      case 'ph-down': {
        // Muriatic acid: ~26 oz per 10,000 gal to lower pH by 0.2
        const acidOz = (diff / 0.2) * (vol / 10000) * 26;
        output = `Muriatic Acid (31.45%): ${Math.round(acidOz)} fl oz\n\n⚠️ Safety: Always add acid to water, never water to acid. Add in small amounts, test, and retest after 4 hours.`;
        break;
      }
      case 'ph-up': {
        // Soda ash: ~6 oz per 10,000 gal to raise pH by 0.2
        const sodaOz = (diff / 0.2) * (vol / 10000) * 6;
        output = `Soda Ash: ${sodaOz.toFixed(1)} oz`;
        break;
      }
      case 'alkalinity': {
        // Baking soda: ~1.5 lbs per 10,000 gal to raise TA by 10 ppm
        const bakingLbs = (diff / 10) * (vol / 10000) * 1.5;
        output = `Baking Soda: ${bakingLbs.toFixed(1)} lbs`;
        break;
      }
      case 'calcium': {
        // Calcium chloride: ~1.25 lbs per 10,000 gal to raise CH by 10 ppm
        const calciumLbs = (diff / 10) * (vol / 10000) * 1.25;
        output = `Calcium Chloride: ${calciumLbs.toFixed(1)} lbs`;
        break;
      }
      case 'cya': {
        // CYA: ~13 oz per 10,000 gal to raise by 10 ppm
        const cyaOz = (diff / 10) * (vol / 10000) * 13;
        output = `Cyanuric Acid (Stabilizer): ${cyaOz.toFixed(1)} oz`;
        break;
      }
      case 'salt': {
        // Salt: ~30 lbs per 10,000 gal to raise by 1000 ppm
        const saltLbs = (diff / 1000) * (vol / 10000) * 30;
        output = `Pool Salt: ${saltLbs.toFixed(0)} lbs`;
        break;
      }
    }

    setResult(output);
  }

  return (
    <div class="calculator">
      <div class="form-group">
        <label class="form-label">Pool Volume (gallons)</label>
        <input
          type="number"
          class="form-input"
          value={poolVolume}
          onInput={(e) => setPoolVolume((e.target as HTMLInputElement).value)}
          placeholder="e.g. 15000"
          min="0"
        />
        <small style={{ color: '#6b7280', marginTop: '4px', display: 'block' }}>
          Don't know? <a href="/tools/pool-volume-calculator/">Calculate it here</a>
        </small>
      </div>

      <div class="form-group">
        <label class="form-label">Chemical Type</label>
        <div class="calc-chem-tabs">
          {(Object.keys(chemicals) as ChemicalType[]).map((key) => (
            <button
              type="button"
              class={`calc-shape-btn ${chemType === key ? 'active' : ''}`}
              onClick={() => { setChemType(key); setResult(null); setCurrentReading(''); setTargetReading(''); }}
            >
              {chemicals[key].label}
            </button>
          ))}
        </div>
      </div>

      <div class="calc-ideal-range">
        <small>Ideal range: <strong>{chem.idealMin} – {chem.idealMax} {chem.unit}</strong></small>
      </div>

      <div class="calc-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div class="form-group">
          <label class="form-label">{chem.currentLabel}</label>
          <input
            type="number"
            class="form-input"
            value={currentReading}
            onInput={(e) => setCurrentReading((e.target as HTMLInputElement).value)}
            step="0.1"
          />
        </div>
        <div class="form-group">
          <label class="form-label">{chem.targetLabel}</label>
          <input
            type="number"
            class="form-input"
            value={targetReading}
            onInput={(e) => setTargetReading((e.target as HTMLInputElement).value)}
            step="0.1"
          />
        </div>
      </div>

      <div class="calc-actions">
        <button type="button" class="btn btn--primary" onClick={calculate}>Calculate Dosage</button>
      </div>

      {result && (
        <div class="calc-result">
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{result}</pre>
        </div>
      )}

      <p class="calc-disclaimer">
        <strong>⚠️ Always test your water before adding chemicals.</strong> When in doubt, call a professional. These are estimates — actual dosing may vary based on water temperature, sunlight exposure, and other factors.
      </p>
    </div>
  );
}
