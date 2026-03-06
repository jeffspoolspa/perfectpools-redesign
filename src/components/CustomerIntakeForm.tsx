import { useState, useEffect, useRef } from 'preact/hooks';

/* ── Constants ── */
const COUNTIES = ['Bryan', 'Chatham', 'Liberty', 'McIntosh', 'Glynn', 'Camden', 'Effingham'];
const TOTAL_STEPS = 9;
const GMAPS_KEY = 'AIzaSyCUZO0gGKKp_K7FEoLrF0H2gzW6maaSnAg';
const SUPABASE_URL = 'https://vvprodiuwraceabviyes.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2cHJvZGl1d3JhY2VhYnZpeWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MDU4MTYsImV4cCI6MjA3MjQ4MTgxNn0.HOFTUrInpmzhxTJDSp1xKp81noC7jMuTcdxr9JqC3z0';

/* Service area bounding box (coastal GA) */
const SERVICE_BOUNDS = {
  south: 30.60, west: -81.90,
  north: 32.45, east: -80.80,
};

const POOL_SIZES = [
  { id: 'small', label: 'Small', desc: 'Under 15,000 gallons' },
  { id: 'medium', label: 'Medium', desc: '15,000 – 30,000 gallons' },
  { id: 'large', label: 'Large', desc: '30,000+ gallons' },
];

const SURFACES = [
  { id: 'plaster', label: 'Plaster', desc: 'Classic smooth finish' },
  { id: 'pebble', label: 'Pebble', desc: 'Textured natural stone' },
  { id: 'tile', label: 'Tile', desc: 'Ceramic or glass tile' },
  { id: 'fiberglass', label: 'Fiberglass', desc: 'Smooth gel coat finish' },
  { id: 'vinyl', label: 'Vinyl Liner', desc: 'Flexible liner surface' },
];

const TIME_SLOTS = [
  '8:00 AM – 10:00 AM',
  '10:00 AM – 12:00 PM',
  '12:00 PM – 2:00 PM',
  '2:00 PM – 4:00 PM',
  '4:00 PM – 6:00 PM',
];

const INCLUDED = [
  'Weekly pool cleaning',
  'Chemical balancing',
  'Filter maintenance',
  'Skimming & vacuuming',
  'Equipment inspection',
  'Water testing',
  'Debris removal',
  'Service report each visit',
];

/* Custom map style — subtle, branded */
const MAP_STYLES = [
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c8e3f5' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry.fill', stylers: [{ color: '#eef2ee' }] },
  { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: '#e8efe8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dde4dd' }, { visibility: 'simplified' }] },
  { featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#e8ece8' }, { visibility: 'simplified' }] },
  { featureType: 'road.arterial', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#f0f4f0' }, { visibility: 'simplified' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#4a5568' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
];

/* ── Utilities ── */
function formatPhone(v: string) {
  const n = v.replace(/\D/g, '');
  if (n.length <= 3) return n;
  if (n.length <= 6) return `(${n.slice(0, 3)}) ${n.slice(3)}`;
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6, 10)}`;
}

function getSession() {
  try { const r = sessionStorage.getItem('intakeForm'); return r ? JSON.parse(r) : null; } catch { return null; }
}

function saveSession(d: any) {
  try { sessionStorage.setItem('intakeForm', JSON.stringify(d)); } catch {}
}

/** Load Google Maps JS API once */
function loadGoogleMaps(): Promise<void> {
  if ((window as any).google?.maps?.places) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (document.getElementById('gmaps-script')) {
      // Script already loading — wait for it
      const check = setInterval(() => {
        if ((window as any).google?.maps?.places) { clearInterval(check); resolve(); }
      }, 100);
      return;
    }
    const s = document.createElement('script');
    s.id = 'gmaps-script';
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places&loading=async`;
    s.async = true;
    s.onload = () => {
      const check = setInterval(() => {
        if ((window as any).google?.maps?.places) { clearInterval(check); resolve(); }
      }, 50);
    };
    s.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(s);
  });
}

/* ── Main Component ── */
export default function CustomerIntakeForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);

  // Step 1 — Location
  const [searchResult, setSearchResult] = useState('');
  const [county, setCounty] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [heatmapCount, setHeatmapCount] = useState(0);

  // Step 2 — Pool type (qualifying gate)
  const [isAboveGround, setIsAboveGround] = useState<boolean | null>(null);

  // Step 3 — Pool size
  const [poolSize, setPoolSize] = useState('');

  // Step 4 — Screened
  const [isScreened, setIsScreened] = useState<boolean | null>(null);

  // Step 5 — Surface
  const [surfaceType, setSurfaceType] = useState('');

  // Step 7 — Contact
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Step 8 — Calendar
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Step 9 — Countdown
  const [countdown, setCountdown] = useState(10);

  // Refs — Google Maps
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Open event from static buttons ── */
  useEffect(() => {
    const handler = () => {
      const saved = getSession();
      if (saved) {
        setStep(saved.step || 1);
        setCounty(saved.county || '');
        setPoolSize(saved.poolSize || '');
        setIsScreened(saved.isScreened ?? null);
        setSurfaceType(saved.surfaceType || '');
        setIsAboveGround(saved.isAboveGround ?? null);
        setContactName(saved.contactName || '');
        setContactPhone(saved.contactPhone || '');
        setContactEmail(saved.contactEmail || '');
        setSelectedDate(saved.selectedDate || '');
        setSelectedTime(saved.selectedTime || '');
      }
      setIsOpen(true);
    };
    window.addEventListener('openIntakeForm', handler);
    return () => window.removeEventListener('openIntakeForm', handler);
  }, []);

  /* ── Persist state ── */
  useEffect(() => {
    if (isOpen) {
      saveSession({
        step, county, poolSize, isScreened,
        surfaceType, isAboveGround, contactName, contactPhone,
        contactEmail, selectedDate, selectedTime,
      });
    }
  }, [step, county, poolSize, isScreened, surfaceType, isAboveGround, contactName, contactPhone, contactEmail, selectedDate, selectedTime, isOpen]);

  /* ── Escape key ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && step !== 9) handleClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, step]);

  /* ── Body scroll lock ── */
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  /* ── Countdown for success step ── */
  useEffect(() => {
    if (step !== 9) return;
    setCountdown(10);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          window.location.href = 'https://secure.jeffspoolspa.com';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  /* ── Google Maps + Places Autocomplete + Heatmap (step 1) ── */
  useEffect(() => {
    if (!isOpen || step !== 1) {
      // Tear down when leaving step 1
      if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; }
      if (autocompleteRef.current) { autocompleteRef.current = null; }
      mapInstanceRef.current = null;
      setMapReady(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await loadGoogleMaps();
      } catch {
        console.error('Google Maps failed to load');
        return;
      }
      if (cancelled || !mapContainerRef.current) return;

      // Wait one frame for DOM
      await new Promise(r => requestAnimationFrame(r));
      if (cancelled || !mapContainerRef.current) return;

      const google = (window as any).google;

      // ─── Create Map (centered on greater Savannah / Richmond Hill) ───
      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: 31.90, lng: -81.20 },
        zoom: 9,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: MAP_STYLES,
        gestureHandling: 'cooperative',
      });
      mapInstanceRef.current = map;

      // ─── Places Autocomplete ───
      if (inputRef.current && !autocompleteRef.current) {
        const bounds = new google.maps.LatLngBounds(
          { lat: SERVICE_BOUNDS.south, lng: SERVICE_BOUNDS.west },
          { lat: SERVICE_BOUNDS.north, lng: SERVICE_BOUNDS.east },
        );

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'us' },
          bounds,
          strictBounds: true,
          types: ['address'],
          fields: ['address_components', 'geometry', 'formatted_address'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place.geometry?.location) return;

          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();

          // Extract county from address_components
          const countyComp = place.address_components?.find(
            (c: any) => c.types.includes('administrative_area_level_2')
          );
          const hitCounty = (countyComp?.long_name || '').replace(' County', '');

          // Place marker with animation
          if (markerRef.current) markerRef.current.setMap(null);
          markerRef.current = new google.maps.Marker({
            position: { lat, lng },
            map,
            animation: google.maps.Animation.DROP,
          });

          map.panTo({ lat, lng });
          map.setZoom(13);

          // Check if in service area
          if (COUNTIES.includes(hitCounty)) {
            setCounty(hitCounty);
            setSearchResult('in-area');
          } else {
            setCounty('');
            setSearchResult('out-of-area');
          }
        });

        autocompleteRef.current = autocomplete;
      }

      // ─── Cluster Bubbles (aggregated — no individual locations) ───
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/heatmap-data`, {
          headers: { 'apikey': SUPABASE_ANON },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.points?.length > 0) {
            const points = data.points as { lat: number; lng: number }[];

            // Area centers — pools get grouped to the nearest one
            const areas = [
              { name: 'Savannah', lat: 32.065, lng: -81.09 },
              { name: 'Pooler', lat: 32.12, lng: -81.25 },
              { name: 'Richmond Hill', lat: 31.94, lng: -81.30 },
              { name: 'Wilmington Is.', lat: 31.99, lng: -80.97 },
              { name: 'Tybee Island', lat: 32.00, lng: -80.85 },
              { name: 'Skidaway Is.', lat: 31.94, lng: -81.06 },
              { name: 'Hinesville', lat: 31.84, lng: -81.60 },
              { name: 'Midway', lat: 31.81, lng: -81.43 },
              { name: 'Brunswick', lat: 31.16, lng: -81.49 },
              { name: 'St. Simons Is.', lat: 31.17, lng: -81.37 },
            ];

            // Assign each pool to nearest area
            const counts = new Map<string, number>();
            areas.forEach(a => counts.set(a.name, 0));
            points.forEach(p => {
              let nearest = areas[0];
              let minD = Infinity;
              areas.forEach(a => {
                const d = (p.lat - a.lat) ** 2 + (p.lng - a.lng) ** 2;
                if (d < minD) { minD = d; nearest = a; }
              });
              counts.set(nearest.name, (counts.get(nearest.name) || 0) + 1);
            });

            // Render layered radial glows — soft watercolor wash effect
            areas.forEach(area => {
              const count = counts.get(area.name) || 0;
              if (count < 3) return;

              // Scale factor: bigger count = bigger + richer glow
              const scale = Math.min(count / 80, 1); // 0→1 based on count

              // Outer glow — wide reach, fills gaps between areas
              new google.maps.Circle({
                center: { lat: area.lat, lng: area.lng },
                radius: 5000 + scale * 9000,
                map,
                fillColor: '#22d3ee',
                fillOpacity: 0.08 + scale * 0.04,
                strokeWeight: 0,
                clickable: false,
                zIndex: 0,
              });

              // Mid glow — shows the service zone
              new google.maps.Circle({
                center: { lat: area.lat, lng: area.lng },
                radius: 3000 + scale * 5500,
                map,
                fillColor: '#06b6d4',
                fillOpacity: 0.12 + scale * 0.06,
                strokeWeight: 0,
                clickable: false,
                zIndex: 1,
              });

              // Core glow — marks the center
              new google.maps.Circle({
                center: { lat: area.lat, lng: area.lng },
                radius: 1200 + scale * 2800,
                map,
                fillColor: '#0891b2',
                fillOpacity: 0.17 + scale * 0.09,
                strokeWeight: 0,
                clickable: false,
                zIndex: 2,
              });
            });

            setHeatmapCount(data.points.length);
          }
        }
      } catch {
        // Visualization is an enhancement — don't block the flow
      }

      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; }
      autocompleteRef.current = null;
      mapInstanceRef.current = null;
      setMapReady(false);
    };
  }, [isOpen, step]);

  /* ── Quote calculation ── */
  function calculateQuote() {
    /* Large pools never reach quote — redirected to commercial page */
    const basePrice = poolSize === 'small' ? 120 : 150;
    const screenAdj = isScreened === true ? 0 : 20;
    return { basePrice, screenAdj, total: basePrice + screenAdj };
  }

  /* ── Close & reset ── */
  function handleClose() {
    setStep(1);
    setSearchResult(''); setCounty('');
    setPoolSize(''); setIsScreened(null); setSurfaceType('');
    setIsAboveGround(null); setContactName(''); setContactPhone('');
    setContactEmail(''); setSelectedDate(''); setSelectedTime('');
    setCountdown(10); setHeatmapCount(0);
    try { sessionStorage.removeItem('intakeForm'); } catch {}
    setIsOpen(false);
  }

  if (!isOpen) return null;

  const pct = Math.round((step / TOTAL_STEPS) * 100);
  const quote = calculateQuote();

  /* ── Render ── */
  return (
    <div class="intake-overlay is-open" onClick={(e) => { if (e.target === e.currentTarget && step !== 9) handleClose(); }} role="dialog" aria-modal="true" aria-label="Get a quote">
      <div class="intake-modal">
        {/* Close */}
        {step !== 9 && (
          <button class="intake-close-btn" onClick={handleClose} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}

        {/* Progress bar */}
        {step < 9 && (
          <div class="intake-progress-bar">
            {step > 1 && (
              <button class="intake-back-arrow" onClick={() => setStep(step - 1)} aria-label="Go back">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
            )}
            <div class="intake-progress-track">
              <div class="intake-progress-fill" style={`width:${pct}%`} />
            </div>
            <div class="intake-progress-label">
              <span>Step {step} of {TOTAL_STEPS}</span>
              <span>{pct}% Complete</span>
            </div>
          </div>
        )}

        {/* Step content */}
        <div class={`intake-body ${step === 6 || step === 9 ? 'intake-body--flush' : ''}`}>
          {step === 1 && renderLocation()}
          {step === 2 && renderPoolType()}
          {step === 3 && renderPoolSize()}
          {step === 4 && renderScreen()}
          {step === 5 && renderSurface()}
          {step === 6 && renderQuote()}
          {step === 7 && renderContact()}
          {step === 8 && renderCalendar()}
          {step === 9 && renderSuccess()}
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════
     Step 1 — Location Check (Google Maps)
     ══════════════════════════════════ */
  function renderLocation() {
    return (
      <>
        <div class="intake-step-header intake-step-header--inline">
          <div class="intake-step-icon intake-step-icon--sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div>
            <h2 class="intake-step-title">Let's check your location</h2>
            <p class="intake-step-subtitle">Enter your address to see if we service your area</p>
          </div>
        </div>

        <div class="intake-search intake-search--hero">
          <div class="intake-search-wrapper">
            <svg class="intake-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter your address to check coverage..."
              class="intake-search-input intake-search-input--with-icon"
              autocomplete="off"
              onInput={() => { if (searchResult) setSearchResult(''); }}
            />
          </div>
        </div>

        {searchResult === 'in-area' && (
          <div class="intake-area-result intake-area-result--success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span><strong>Great news!</strong> Join {heatmapCount > 50 ? `${heatmapCount}+` : '500+'} customers who trust Perfect Pools.</span>
            <button class="intake-area-continue" onClick={() => setStep(2)}>
              Continue <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}
        {searchResult === 'out-of-area' && (
          <div class="intake-area-result intake-area-result--error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Sorry, we don't currently serve this area. We cover Bryan, Camden, Chatham, Effingham, Glynn, Liberty &amp; McIntosh counties in Coastal Georgia.</span>
          </div>
        )}

        <div class="intake-map-container intake-map-container--fill">
          <div ref={mapContainerRef} class="intake-google-map" />
          {!mapReady && <div class="intake-map-loading">Loading map...</div>}
        </div>

        <p class="intake-map-caption">
          {heatmapCount > 0
            ? `Serving ${heatmapCount}+ Coastal Georgia pools`
            : 'Proudly serving Coastal Georgia'}
        </p>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 3 — Pool Size
     ══════════════════════════════════ */
  function renderPoolSize() {
    /* MDI "pool" icon (Material Design, Apache 2.0) — pool structure + waves */
    const poolIcon = (w: number) => (
      <svg width={w} height={w} viewBox="0 0 24 24" fill="currentColor">
        <path d="M2 15c1.67-.75 3.33-1.5 5-1.83V5a3 3 0 0 1 3-3c1.31 0 2.42.83 2.83 2H10a1 1 0 0 0-1 1v1h5V5a3 3 0 0 1 3-3c1.31 0 2.42.83 2.83 2H17a1 1 0 0 0-1 1v9.94c2-.32 4-1.94 6-1.94v2c-2.22 0-4.44 2-6.67 2c-2.22 0-4.44-2-6.66-2c-2.23 0-4.45 1-6.67 2zm12-7H9v2h5zm0 4H9v1c1.67.16 3.33 1.31 5 1.79zM2 19c2.22-1 4.44-2 6.67-2c2.22 0 4.44 2 6.66 2c2.23 0 4.45-2 6.67-2v2c-2.22 0-4.44 2-6.67 2c-2.22 0-4.44-2-6.66-2c-2.23 0-4.45 1-6.67 2z"/>
      </svg>
    );
    const iconSizes: Record<string, number> = { small: 28, medium: 40, large: 54 };

    /* Large pool selected — commercial redirect screen */
    if (poolSize === 'large') {
      return (
        <>
          <div class="intake-step-header">
            <div class="intake-step-icon intake-step-icon--commercial">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><rect x="4" y="8" width="16" height="12" rx="1"/><path d="M12 8V4"/><path d="M8 8V6"/><path d="M16 8V6"/><path d="M8 12h2"/><path d="M14 12h2"/><path d="M8 16h2"/><path d="M14 16h2"/></svg>
            </div>
            <h2 class="intake-step-title">This pool needs a custom quote</h2>
            <p class="intake-step-subtitle">Pools over 30,000 gallons require a site visit</p>
          </div>

          <div class="intake-sorry-content">
            <p>Large pools have unique service requirements — more water means more chemicals, longer visits, and specialized equipment. We'll need to see your pool in person to give you an accurate price and explore bulk chemical options that can save you money.</p>
            <div class="intake-sorry-help intake-sorry-help--blue">
              <h3>What to expect:</h3>
              <ul>
                <li>Free on-site evaluation at your convenience</li>
                <li>Custom quote based on your pool's exact specs</li>
                <li>Bulk chemical pricing options for large volumes</li>
              </ul>
            </div>
            <div class="intake-sorry-actions">
              <a href="/services/commercial-pool-cleaning/" class="intake-cta-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20h20"/><rect x="4" y="8" width="16" height="12" rx="1"/><path d="M12 8V4"/></svg>
                View Commercial Services
              </a>
              <a href="tel:9124590160" class="intake-outline-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Call to Schedule — (912) 459-0160
              </a>
              <button type="button" class="intake-text-btn" onClick={() => { setPoolSize(''); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Not sure? Go back
              </button>
              <a href="/tools/pool-volume-calculator/" class="intake-text-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/></svg>
                Calculate your pool volume
              </a>
            </div>
          </div>
        </>
      );
    }

    /* Default — size selection with scaling pool icons */
    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>
          </div>
          <h2 class="intake-step-title">How large is your pool?</h2>
          <p class="intake-step-subtitle">This helps us match you with the right service plan</p>
        </div>

        <div class="intake-size-list">
          {POOL_SIZES.map(s => (
            <button
              key={s.id}
              type="button"
              class={`intake-size-card intake-size-card--${s.id}`}
              onClick={() => {
                setPoolSize(s.id);
                if (s.id !== 'large') setTimeout(() => setStep(4), 400);
              }}
            >
              <div class={`intake-size-icon intake-size-icon--${s.id}`}>
                {poolIcon(iconSizes[s.id])}
              </div>
              <h3 class="intake-size-label">{s.label}</h3>
              <p class="intake-size-desc">{s.desc}</p>
            </button>
          ))}
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 4 — Screen
     ══════════════════════════════════ */
  function renderScreen() {
    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </div>
          <h2 class="intake-step-title">Is your pool screened in?</h2>
          <p class="intake-step-subtitle">A screened enclosure affects debris cleanup time</p>
        </div>

        <div class="intake-choice-grid">
          <button type="button" class="intake-choice" onClick={() => { setIsScreened(true); setTimeout(() => setStep(5), 400); }}>
            <div class="intake-choice-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3>Yes, Screened</h3>
            <p>Less debris, faster cleaning</p>
          </button>
          <button type="button" class="intake-choice" onClick={() => { setIsScreened(false); setTimeout(() => setStep(5), 400); }}>
            <div class="intake-choice-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </div>
            <h3>No, Open Air</h3>
            <p>More debris, thorough cleaning</p>
          </button>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 5 — Surface
     ══════════════════════════════════ */
  function renderSurface() {
    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          </div>
          <h2 class="intake-step-title">What type of pool surface?</h2>
          <p class="intake-step-subtitle">Different surfaces require different care techniques</p>
        </div>

        <div class="intake-surface-list">
          {SURFACES.map(s => (
            <button
              key={s.id}
              type="button"
              class="intake-surface-item"
              onClick={() => { setSurfaceType(s.id); setTimeout(() => setStep(6), 400); }}
            >
              <div>
                <h3>{s.label}</h3>
                <p>{s.desc}</p>
              </div>
              <div class="intake-surface-radio" />
            </button>
          ))}
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 2 — Pool Type (qualifying gate)
     ══════════════════════════════════ */
  function renderPoolType() {
    // Above-ground selected — show polite "sorry" screen
    if (isAboveGround === true) {
      return (
        <>
          <div class="intake-step-header">
            <div class="intake-step-icon intake-step-icon--sorry">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </div>
            <h2 class="intake-step-title">We appreciate your interest!</h2>
            <p class="intake-step-subtitle">Unfortunately, we only service in-ground pools at this time.</p>
          </div>

          <div class="intake-sorry-content">
            <p>Above-ground pools require different equipment and techniques than what our team specializes in. We want to make sure every pool we service gets the expert care it deserves.</p>

            <div class="intake-sorry-help">
              <h3>How we can still help:</h3>
              <ul>
                <li>We'd be happy to recommend a trusted above-ground pool service in your area</li>
                <li>If you're considering converting to an in-ground pool, we can help with that too</li>
              </ul>
            </div>

            <div class="intake-sorry-actions">
              <a href="tel:9124590160" class="intake-cta-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Call Us — (912) 459-0160
              </a>
              <button type="button" class="intake-outline-btn" onClick={() => { setIsAboveGround(null); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Go Back
              </button>
            </div>
          </div>
        </>
      );
    }

    // Default — show the choice
    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          </div>
          <h2 class="intake-step-title">What type of pool do you have?</h2>
          <p class="intake-step-subtitle">This helps us match you with the right service</p>
        </div>

        <div class="intake-choice-grid">
          <button type="button" class="intake-choice" onClick={() => { setIsAboveGround(false); setTimeout(() => setStep(3), 400); }}>
            <div class="intake-choice-icon intake-choice-icon--emoji">🏊</div>
            <h3>In-Ground</h3>
            <p>Built into the ground</p>
          </button>
          <button type="button" class="intake-choice" onClick={() => { setIsAboveGround(true); }}>
            <div class="intake-choice-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            </div>
            <h3>Above Ground</h3>
            <p>Raised pool structure</p>
          </button>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 6 — Quote
     ══════════════════════════════════ */
  function renderQuote() {
    return (
      <>
        <div class="intake-quote-header">
          <div class="intake-quote-header-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h2>Your Personalized Quote</h2>
          <p>Based on your pool details</p>
        </div>

        <div class="intake-quote-content">
          <div class="intake-quote-details">
            <div class="intake-quote-line">
              <span>Base Service</span>
              <span class="intake-quote-line-val">${quote.basePrice}/month</span>
            </div>
            {quote.screenAdj !== 0 && (
              <div class="intake-quote-line">
                <span>Unscreened Pool</span>
                <span class="intake-quote-line-val">+${quote.screenAdj}/month</span>
              </div>
            )}
            <div class="intake-quote-total">
              <span>Total Monthly Rate</span>
              <span class="intake-quote-total-val">${quote.total}/mo</span>
            </div>
          </div>

          <div class="intake-included">
            <h3>What's Included:</h3>
            <div class="intake-included-grid">
              {INCLUDED.map((item, i) => (
                <div key={i} class="intake-included-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div class="intake-quote-actions">
            <button type="button" class="intake-cta-btn" onClick={() => setStep(7)}>
              Continue to Sign Up
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
            <div class="intake-btn-row">
              <button type="button" class="intake-outline-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                Email Quote
              </button>
              <button type="button" class="intake-outline-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Text Quote
              </button>
            </div>
          </div>

          <p class="intake-quote-fine-print">No long-term contracts &bull; Cancel anytime &bull; Same-day service available</p>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 7 — Contact Info
     ══════════════════════════════════ */
  function renderContact() {
    const canSubmit = contactName.trim() && contactPhone.trim() && contactEmail.trim();

    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <h2 class="intake-step-title">Your Contact Information</h2>
          <p class="intake-step-subtitle">We'll use this to send your quote and schedule service</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) setStep(8); }}>
          <div class="intake-field">
            <label>Full Name</label>
            <div class="intake-field-icon-wrap">
              <svg class="intake-field-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <input type="text" value={contactName} onInput={(e) => setContactName((e.target as HTMLInputElement).value)} placeholder="John Smith" required />
            </div>
          </div>

          <div class="intake-field">
            <label>Phone Number</label>
            <div class="intake-field-icon-wrap">
              <svg class="intake-field-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <input type="tel" value={contactPhone} onInput={(e) => setContactPhone(formatPhone((e.target as HTMLInputElement).value))} placeholder="(912) 555-1234" required />
            </div>
          </div>

          <div class="intake-field">
            <label>Email Address</label>
            <div class="intake-field-icon-wrap">
              <svg class="intake-field-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              <input type="email" value={contactEmail} onInput={(e) => setContactEmail((e.target as HTMLInputElement).value)} placeholder="john@example.com" required />
            </div>
          </div>

          <button type="submit" class="intake-cta-btn" disabled={!canSubmit}>Continue</button>
        </form>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 8 — Calendar
     ══════════════════════════════════ */
  function renderCalendar() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    const canContinue = selectedDate && selectedTime;

    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <h2 class="intake-step-title">Schedule Your First Visit</h2>
          <p class="intake-step-subtitle">Pick a date and time that works best for you</p>
        </div>

        <div class="intake-calendar-grid">
          <div>
            <h3 class="intake-cal-heading">Select Date</h3>
            <input
              type="date"
              class="intake-date-input"
              value={selectedDate}
              min={minDate}
              onInput={(e) => setSelectedDate((e.target as HTMLInputElement).value)}
            />
            <p class="intake-cal-note">* We're closed on Sundays</p>
          </div>

          <div>
            <h3 class="intake-cal-heading">Select Time</h3>
            <div class="intake-time-list">
              {TIME_SLOTS.map(time => (
                <button
                  key={time}
                  type="button"
                  class={`intake-time-slot ${selectedTime === time ? 'intake-time-slot--selected' : ''}`}
                  onClick={() => setSelectedTime(time)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>{time}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button type="button" class="intake-cta-btn" disabled={!canContinue} onClick={() => setStep(9)}>
          Continue to Payment
        </button>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 9 — Success
     ══════════════════════════════════ */
  function renderSuccess() {
    const firstName = contactName.split(' ')[0] || 'there';

    return (
      <>
        <div class="intake-success-header">
          <div class="intake-success-header-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h2>Perfect! You're All Set!</h2>
          <p>Thanks for choosing Perfect Pools, {firstName}!</p>
        </div>

        <div class="intake-success-content">
          <div class="intake-next-steps">
            <h3>What happens next?</h3>
            <ol>
              <li>
                <div class="intake-next-step-num">1</div>
                <div>
                  <strong>Complete Your Payment</strong>
                  <p>You'll be redirected to our secure payment portal</p>
                </div>
              </li>
              <li>
                <div class="intake-next-step-num">2</div>
                <div>
                  <strong>Confirmation Email</strong>
                  <p>Check {contactEmail || 'your inbox'} for your service details</p>
                </div>
              </li>
              <li>
                <div class="intake-next-step-num">3</div>
                <div>
                  <strong>We'll See You Soon!</strong>
                  <p>Our team will arrive at your scheduled time</p>
                </div>
              </li>
            </ol>
          </div>

          <div class="intake-success-actions">
            <button type="button" class="intake-cta-btn" onClick={() => { window.location.href = 'https://secure.jeffspoolspa.com'; }}>
              Complete Payment Now
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </button>
            <p class="intake-countdown">
              Redirecting automatically in <strong>{countdown}</strong> seconds...
            </p>
          </div>

          <div class="intake-success-contact">
            <p>Questions? Contact us:</p>
            <p class="intake-success-contact-info">
              <a href="tel:9124590160">📞 (912) 459-0160</a>
              <span>&nbsp;|&nbsp;</span>
              <a href="mailto:info@perfectpoolscleaning.com">✉️ info@perfectpoolscleaning.com</a>
            </p>
          </div>
        </div>
      </>
    );
  }
}
