import { useState, useEffect, useRef } from 'preact/hooks';

const GMAPS_KEY = 'AIzaSyCUZO0gGKKp_K7FEoLrF0H2gzW6maaSnAg';
const SERVICE_BOUNDS = { south: 30.60, west: -81.90, north: 32.45, east: -80.80 };

const SERVICE_COUNTIES = [
  'Bryan', 'Chatham', 'Effingham', 'Liberty', 'Long', 'McIntosh',
  'Glynn', 'Camden', 'Beaufort', 'Jasper',
];

declare const google: any;

export default function ServiceAreaChecker() {
  const [status, setStatus] = useState<'idle' | 'in-area' | 'out-of-area'>('idle');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

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
        setAddress(place.formatted_address || '');
        setCity(foundCity);
        sessionStorage.setItem('serviceAreaAddress', JSON.stringify({
          street: place.formatted_address,
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
          <a href="/get-started/" class="btn btn--cta btn--sm">Get a Quote</a>
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
