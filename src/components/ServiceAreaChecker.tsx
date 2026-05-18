import { useState, useEffect, useRef } from 'preact/hooks';

const GMAPS_KEY = 'AIzaSyCUZO0gGKKp_K7FEoLrF0H2gzW6maaSnAg';
const SERVICE_BOUNDS = { south: 30.60, west: -81.90, north: 32.45, east: -80.80 };

const SERVICE_COUNTIES = [
  'Bryan', 'Chatham', 'Effingham', 'Liberty', 'Long', 'McIntosh',
  'Glynn', 'Camden', 'Beaufort', 'Jasper',
];

declare const google: any;

/** Parse a Google formatted_address ("123 Main St, Savannah, GA 31401, USA")
 *  into the modal's address fields. Handles 4-part and 5-part variants. */
function parseFormattedAddress(formatted: string): { street: string; city: string; state: string; zip: string } {
  const parts = formatted.split(',').map(p => p.trim());
  // Drop trailing "USA"
  if (parts.length && parts[parts.length - 1].toUpperCase() === 'USA') parts.pop();
  let street = '', city = '', state = '', zip = '';
  if (parts.length >= 3) {
    street = parts[0];
    city = parts[1];
    const stateZip = parts[2].split(/\s+/);
    state = stateZip[0] || '';
    zip = stateZip[1] || '';
  } else if (parts.length === 2) {
    street = parts[0];
    const stateZip = parts[1].split(/\s+/);
    state = stateZip[0] || '';
    zip = stateZip[1] || '';
  }
  return { street, city, state, zip };
}

export default function ServiceAreaChecker() {
  const [status, setStatus] = useState<'idle' | 'in-area' | 'out-of-area'>('idle');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  // Captured pieces of the resolved address, used to build the prefill
  // payload when the user clicks "Get a Quote" after an in-area check.
  const resolvedRef = useRef<{ street: string; city: string; state: string; zip: string; county: string } | null>(null);

  // Load Google Maps — poll until places is ready
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Add script if not already present
    if (!document.getElementById('gmaps-script')) {
      const s = document.createElement('script');
      s.id = 'gmaps-script';
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places&loading=async`;
      s.async = true;
      document.head.appendChild(s);
    }
    // Poll until places API is available
    const check = setInterval(() => {
      if ((window as any).google?.maps?.places) {
        clearInterval(check);
        setMapsLoaded(true);
      }
    }, 100);
    return () => clearInterval(check);
  }, []);

  // Setup autocomplete
  useEffect(() => {
    if (!mapsLoaded || !inputRef.current || autocompleteRef.current) return;
    const bounds = new google.maps.LatLngBounds(
      { lat: SERVICE_BOUNDS.south, lng: SERVICE_BOUNDS.west },
      { lat: SERVICE_BOUNDS.north, lng: SERVICE_BOUNDS.east },
    );
    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      bounds, types: ['address'], componentRestrictions: { country: 'us' },
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place?.geometry?.location) return;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const inBounds = lat >= SERVICE_BOUNDS.south && lat <= SERVICE_BOUNDS.north &&
                       lng >= SERVICE_BOUNDS.west && lng <= SERVICE_BOUNDS.east;

      // Check county
      let foundCity = '';
      let hitCounty = '';
      for (const c of place.address_components || []) {
        if (c.types.includes('locality')) foundCity = c.long_name;
        if (c.types.includes('administrative_area_level_2')) hitCounty = c.long_name.replace(' County', '');
      }

      const inCounty = SERVICE_COUNTIES.some(sc => hitCounty.toLowerCase().includes(sc.toLowerCase()));

      // Dispatch event for map to react
      window.dispatchEvent(new CustomEvent('address-checked', {
        detail: { lat, lng, inArea: inBounds && inCounty, city: foundCity }
      }));

      if (inBounds && inCounty) {
        setStatus('in-area');
        const formatted = place.formatted_address || '';
        setAddress(formatted);
        setCity(foundCity);
        const parsed = parseFormattedAddress(formatted);
        resolvedRef.current = {
          street: parsed.street,
          city: parsed.city || foundCity,
          state: parsed.state || 'GA',
          zip: parsed.zip,
          county: hitCounty,
        };
        sessionStorage.setItem('serviceAreaAddress', JSON.stringify({
          street: formatted,
          city: foundCity,
          county: hitCounty,
          lat, lng,
        }));
      } else {
        setStatus('out-of-area');
        setAddress(place.formatted_address || '');
      }
    });
    autocompleteRef.current = ac;
  }, [mapsLoaded]);

  return (
    <div class="sac">
      <div class="sac__input-row">
        <input
          ref={inputRef}
          type="text"
          class="sac__input"
          placeholder="Enter your address to check availability"
          aria-label="Check if your address is in our service area"
        />
        {status === 'idle' && (
          <span class="sac__hint">We serve coastal Georgia and the Lowcountry</span>
        )}
      </div>

      {status === 'in-area' && (
        <div class="sac__result sac__result--success">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
          <div>
            <strong>Great news — we service {city || 'your area'}!</strong>
            <p>We're currently accepting new clients on our {city || 'local'} routes.</p>
          </div>
          <button
            type="button"
            class="btn btn--cta btn--sm"
            onClick={() => {
              const r = resolvedRef.current;
              const prefill: Record<string, string> = {};
              if (r) {
                if (r.street) prefill.addressStreet = r.street;
                if (r.city) prefill.addressCity = r.city;
                if (r.state) prefill.addressState = r.state;
                if (r.zip) prefill.addressZip = r.zip;
                if (r.county) prefill.county = r.county;
              }
              window.dispatchEvent(new CustomEvent('openGetStarted', {
                detail: Object.keys(prefill).length ? { prefill } : undefined,
              }));
            }}
          >
            Get a Quote
          </button>
        </div>
      )}

      {status === 'out-of-area' && (
        <div class="sac__result sac__result--outside">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <div>
            <strong>We don't currently service that area</strong>
            <p>But we're expanding — leave your info and we'll let you know when we reach you.</p>
          </div>
        </div>
      )}
    </div>
  );
}
