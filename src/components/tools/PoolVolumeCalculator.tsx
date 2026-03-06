import { useState } from 'preact/hooks';

type PoolShape = 'rectangular' | 'circular' | 'oval' | 'l-shaped' | 'kidney';

export default function PoolVolumeCalculator() {
  const [shape, setShape] = useState<PoolShape>('rectangular');
  const [result, setResult] = useState<number | null>(null);

  // Rectangular
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [avgDepth, setAvgDepth] = useState('');
  const [shallowDepth, setShallowDepth] = useState('');
  const [deepDepth, setDeepDepth] = useState('');
  const [useAvgDepth, setUseAvgDepth] = useState(true);

  // Circular
  const [diameter, setDiameter] = useState('');

  // Oval
  const [longDiameter, setLongDiameter] = useState('');
  const [shortDiameter, setShortDiameter] = useState('');

  // L-Shaped (two rectangles)
  const [l1Length, setL1Length] = useState('');
  const [l1Width, setL1Width] = useState('');
  const [l2Length, setL2Length] = useState('');
  const [l2Width, setL2Width] = useState('');

  // Kidney
  const [kidneyLength, setKidneyLength] = useState('');
  const [kidneyWidthWide, setKidneyWidthWide] = useState('');
  const [kidneyWidthNarrow, setKidneyWidthNarrow] = useState('');

  function getDepth(): number {
    if (useAvgDepth) return parseFloat(avgDepth) || 0;
    const s = parseFloat(shallowDepth) || 0;
    const d = parseFloat(deepDepth) || 0;
    return (s + d) / 2;
  }

  function calculate() {
    let gallons = 0;
    const depth = getDepth();

    switch (shape) {
      case 'rectangular':
        gallons = (parseFloat(length) || 0) * (parseFloat(width) || 0) * depth * 7.5;
        break;
      case 'circular':
        gallons = Math.PI * Math.pow((parseFloat(diameter) || 0) / 2, 2) * depth * 7.5;
        break;
      case 'oval':
        gallons = Math.PI * ((parseFloat(longDiameter) || 0) / 2) * ((parseFloat(shortDiameter) || 0) / 2) * depth * 7.5;
        break;
      case 'l-shaped': {
        const d = depth;
        const vol1 = (parseFloat(l1Length) || 0) * (parseFloat(l1Width) || 0) * d;
        const vol2 = (parseFloat(l2Length) || 0) * (parseFloat(l2Width) || 0) * d;
        gallons = (vol1 + vol2) * 7.5;
        break;
      }
      case 'kidney': {
        const kl = parseFloat(kidneyLength) || 0;
        const wWide = parseFloat(kidneyWidthWide) || 0;
        const wNarrow = parseFloat(kidneyWidthNarrow) || 0;
        gallons = kl * ((wWide + wNarrow) / 2) * depth * 7.5 * 0.45;
        break;
      }
    }

    setResult(Math.round(gallons));
  }

  function reset() {
    setResult(null);
    setLength(''); setWidth(''); setAvgDepth(''); setShallowDepth(''); setDeepDepth('');
    setDiameter(''); setLongDiameter(''); setShortDiameter('');
    setL1Length(''); setL1Width(''); setL2Length(''); setL2Width('');
    setKidneyLength(''); setKidneyWidthWide(''); setKidneyWidthNarrow('');
  }

  const shockLbs = result ? (result / 10000 * 1).toFixed(1) : null;

  return (
    <div class="calculator">
      <div class="calc-shape-selector">
        <label class="form-label">Pool Shape</label>
        <div class="calc-shapes">
          {(['rectangular', 'circular', 'oval', 'l-shaped', 'kidney'] as PoolShape[]).map((s) => (
            <button
              type="button"
              class={`calc-shape-btn ${shape === s ? 'active' : ''}`}
              onClick={() => { setShape(s); setResult(null); }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1).replace('-', '-')}
            </button>
          ))}
        </div>
      </div>

      <div class="calc-fields">
        {shape === 'rectangular' && (
          <>
            <div class="form-group">
              <label class="form-label">Length (ft)</label>
              <input type="number" class="form-input" value={length} onInput={(e) => setLength((e.target as HTMLInputElement).value)} min="0" step="0.5" />
            </div>
            <div class="form-group">
              <label class="form-label">Width (ft)</label>
              <input type="number" class="form-input" value={width} onInput={(e) => setWidth((e.target as HTMLInputElement).value)} min="0" step="0.5" />
            </div>
          </>
        )}

        {shape === 'circular' && (
          <div class="form-group">
            <label class="form-label">Diameter (ft)</label>
            <input type="number" class="form-input" value={diameter} onInput={(e) => setDiameter((e.target as HTMLInputElement).value)} min="0" step="0.5" />
          </div>
        )}

        {shape === 'oval' && (
          <>
            <div class="form-group">
              <label class="form-label">Long Diameter (ft)</label>
              <input type="number" class="form-input" value={longDiameter} onInput={(e) => setLongDiameter((e.target as HTMLInputElement).value)} min="0" step="0.5" />
            </div>
            <div class="form-group">
              <label class="form-label">Short Diameter (ft)</label>
              <input type="number" class="form-input" value={shortDiameter} onInput={(e) => setShortDiameter((e.target as HTMLInputElement).value)} min="0" step="0.5" />
            </div>
          </>
        )}

        {shape === 'l-shaped' && (
          <>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Section 1</p>
            <div class="form-group">
              <label class="form-label">Length (ft)</label>
              <input type="number" class="form-input" value={l1Length} onInput={(e) => setL1Length((e.target as HTMLInputElement).value)} min="0" step="0.5" />
            </div>
            <div class="form-group">
              <label class="form-label">Width (ft)</label>
              <input type="number" class="form-input" value={l1Width} onInput={(e) => setL1Width((e.target as HTMLInputElement).value)} min="0" step="0.5" />
            </div>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Section 2</p>
            <div class="form-group">
              <label class="form-label">Length (ft)</label>
              <input type="number" class="form-input" value={l2Length} onInput={(e) => setL2Length((e.target as HTMLInputElement).value)} min="0" step="0.5" />
            </div>
            <div class="form-group">
              <label class="form-label">Width (ft)</label>
              <input type="number" class="form-input" value={l2Width} onInput={(e) => setL2Width((e.target as HTMLInputElement).value)} min="0" step="0.5" />
            </div>
          </>
        )}

        {shape === 'kidney' && (
          <>
            <div class="form-group">
              <label class="form-label">Length (ft)</label>
              <input type="number" class="form-input" value={kidneyLength} onInput={(e) => setKidneyLength((e.target as HTMLInputElement).value)} min="0" step="0.5" />
            </div>
            <div class="form-group">
              <label class="form-label">Width at Widest (ft)</label>
              <input type="number" class="form-input" value={kidneyWidthWide} onInput={(e) => setKidneyWidthWide((e.target as HTMLInputElement).value)} min="0" step="0.5" />
            </div>
            <div class="form-group">
              <label class="form-label">Width at Narrowest (ft)</label>
              <input type="number" class="form-input" value={kidneyWidthNarrow} onInput={(e) => setKidneyWidthNarrow((e.target as HTMLInputElement).value)} min="0" step="0.5" />
            </div>
          </>
        )}

        {/* Depth fields shared across shapes */}
        <div class="calc-depth-toggle">
          <label>
            <input type="checkbox" checked={useAvgDepth} onChange={() => setUseAvgDepth(!useAvgDepth)} />
            {' '}Use average depth
          </label>
        </div>

        {useAvgDepth ? (
          <div class="form-group">
            <label class="form-label">Average Depth (ft)</label>
            <input type="number" class="form-input" value={avgDepth} onInput={(e) => setAvgDepth((e.target as HTMLInputElement).value)} min="0" step="0.5" />
          </div>
        ) : (
          <>
            <div class="form-group">
              <label class="form-label">Shallow End Depth (ft)</label>
              <input type="number" class="form-input" value={shallowDepth} onInput={(e) => setShallowDepth((e.target as HTMLInputElement).value)} min="0" step="0.5" />
            </div>
            <div class="form-group">
              <label class="form-label">Deep End Depth (ft)</label>
              <input type="number" class="form-input" value={deepDepth} onInput={(e) => setDeepDepth((e.target as HTMLInputElement).value)} min="0" step="0.5" />
            </div>
          </>
        )}
      </div>

      <div class="calc-actions">
        <button type="button" class="btn btn--primary" onClick={calculate}>Calculate Volume</button>
        <button type="button" class="btn btn--outline" onClick={reset}>Reset</button>
      </div>

      {result !== null && result > 0 && (
        <div class="calc-result">
          <p class="calc-result__volume">
            <strong>{result.toLocaleString()}</strong> gallons
          </p>
          <p class="calc-result__context">
            A pool this size needs approximately <strong>{shockLbs} lbs</strong> of calcium hypochlorite for a full shock treatment.
          </p>
        </div>
      )}

      {result !== null && result <= 0 && (
        <div class="calc-result calc-result--error">
          <p>Please enter valid dimensions to calculate your pool volume.</p>
        </div>
      )}
    </div>
  );
}
