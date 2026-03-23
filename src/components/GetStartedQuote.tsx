import { useState, useEffect, useRef } from 'preact/hooks';
import ChemicalCostChart from './ChemicalCostChart';
import { assetPath } from '../utils/base-url';

/* ── Constants ── */
const COUNTIES = ['Bryan', 'Chatham', 'Liberty', 'McIntosh', 'Glynn', 'Camden', 'Effingham'];
const GMAPS_KEY = 'AIzaSyCUZO0gGKKp_K7FEoLrF0H2gzW6maaSnAg';
const SERVICE_BOUNDS = {
  south: 30.60, west: -81.90,
  north: 32.45, east: -80.80,
};
const SUPABASE_URL = 'https://vvprodiuwraceabviyes.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2cHJvZGl1d3JhY2VhYnZpeWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MDU4MTYsImV4cCI6MjA3MjQ4MTgxNn0.HOFTUrInpmzhxTJDSp1xKp81noC7jMuTcdxr9JqC3z0';

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

const TOTAL_STEPS = 10;

const SERVICE_TYPES = [
  { id: 'maintenance', label: 'Recurring Pool Maintenance', desc: 'Weekly service to keep your pool pristine', icon: 'waves' },
  { id: 'green_pool', label: 'Green Pool Recovery', desc: 'Bring your pool back to life', icon: 'leaf' },
  { id: 'equipment', label: 'Equipment Issue', desc: 'Pump, filter, or heater problems', icon: 'wrench' },
  { id: 'renovation', label: 'Renovation', desc: 'Replaster, retile, or remodel', icon: 'hammer' },
];

const CUSTOMER_TYPES = [
  { id: 'residential', label: 'Residential', desc: 'Single-family home pool', icon: 'home' },
  { id: 'commercial', label: 'Commercial', desc: 'HOA, hotel, or business pool', icon: 'building' },
];

const POOL_SIZES = [
  { id: 'small', label: 'Small', desc: 'Under 15,000 gallons' },
  { id: 'medium', label: 'Medium', desc: '15,000 – 30,000 gallons' },
  { id: 'large', label: 'Large', desc: '30,000+ gallons' },
];

const POOL_CONDITIONS = [
  { id: 'good', label: 'Everything is Working', desc: 'Equipment running, water is blue' },
  { id: 'needs_repair', label: 'Something Needs Fixing', desc: 'Cloudy water, leak, pump down, etc.' },
];

const POOL_TYPE_OPTIONS = [
  { id: 'inground', label: 'In-Ground', desc: 'Built into the ground' },
  { id: 'above_ground', label: 'Above Ground', desc: 'Raised pool structure' },
];

const LEAD_CONTEXTS = [
  { id: 'new_owner', label: 'New Pool Owner', desc: 'Just moved in or had a pool built' },
  { id: 'switching', label: 'Switching Companies', desc: 'Looking for better service' },
  { id: 'diy_previously', label: 'Used to DIY', desc: 'Ready to hand it off to the pros' },
];

const SERVICE_BODY_OPTIONS = [
  { id: 'pool', label: 'Pool Only', price: 50 },
  { id: 'spa', label: 'Spa Only', price: 45 },
  { id: 'pool_spa_combo', label: 'Pool + Spa Combo', price: 60 },
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

/* ── Utilities ── */
function formatPhone(v: string) {
  const n = v.replace(/\D/g, '');
  if (n.length <= 3) return n;
  if (n.length <= 6) return `(${n.slice(0, 3)}) ${n.slice(3)}`;
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6, 10)}`;
}

function getSession() {
  try { const r = sessionStorage.getItem('getStartedQuote'); return r ? JSON.parse(r) : null; } catch { return null; }
}

function saveSession(d: any) {
  try { sessionStorage.setItem('getStartedQuote', JSON.stringify(d)); } catch {}
}

function loadGoogleMaps(): Promise<void> {
  if ((window as any).google?.maps?.places) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (document.getElementById('gmaps-script')) {
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

function isBiweeklyAvailable() {
  const month = new Date().getMonth();
  return month >= 8 || month <= 1;
}

/* ── Types ── */
export interface QuoteFormData {
  serviceInterest: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  county: string;
  areaResult: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  duplicateResolution: string;
  customerType: string;
  poolSize: string;
  poolCondition: string;
  isInground: string;
  serviceType: string;
  hasExtraBody: boolean;
  isBiweekly: boolean;
  leadContext: string;
  contactPreference: string;
  quotePath: string;
}

const DEFAULT_FORM: QuoteFormData = {
  serviceInterest: '',
  addressStreet: '', addressCity: '', addressState: 'GA', addressZip: '', county: '', areaResult: '',
  firstName: '', lastName: '', email: '', phone: '',
  duplicateResolution: '',
  customerType: '',
  poolSize: '',
  poolCondition: '',
  isInground: '',
  serviceType: 'pool', hasExtraBody: false, isBiweekly: false,
  leadContext: '',
  contactPreference: '', quotePath: '',
};

/* ── Main Component ── */
export default function GetStartedQuote({ basePath = '/' }: { basePath?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<QuoteFormData>(DEFAULT_FORM);
  const [redirect, setRedirect] = useState('');
  const [showDupCheck, setShowDupCheck] = useState(false);
  const [chemCostData, setChemCostData] = useState<any[] | null>(null);

  // P2-2: Ticket form state (equipment + green pool redirect screens)
  const [ticketFormOpen, setTicketFormOpen] = useState(false);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketError, setTicketError] = useState('');
  const [ticketContact, setTicketContact] = useState({ firstName: '', lastName: '', phone: '', email: '' });

  // P2-3: Commercial form state
  const [commercialForm, setCommercialForm] = useState({
    companyName: '',
    closesForWinter: null as boolean | null,
    summerFrequency: 3,
    winterFrequency: 2,
    pmName: '', pmPhone: '', pmEmail: '',
    commercialDescription: '',
  });
  const [showPmFields, setShowPmFields] = useState(false);
  const [commercialSubmitting, setCommercialSubmitting] = useState(false);
  const [commercialSubmitted, setCommercialSubmitted] = useState(false);
  const [commercialError, setCommercialError] = useState('');

  const updateForm = (updates: Partial<QuoteFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  /* ── Open / close ── */
  useEffect(() => {
    const handler = (e?: Event) => {
      const saved = getSession();
      if (saved) {
        setFormData(prev => ({ ...prev, ...saved.formData }));
        setCurrentStep(saved.currentStep || 1);
      }
      setIsOpen(true);
    };
    window.addEventListener('openGetStarted', handler);

    // Auto-open from URL param
    const params = new URLSearchParams(window.location.search);
    if (params.has('quote') || params.has('start')) {
      handler();
    }

    return () => window.removeEventListener('openGetStarted', handler);
  }, []);

  /* ── Escape key ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  /* ── Body scroll lock ── */
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  /* ── Fetch chemical cost estimates for quote page chart ── */
  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/chemical_cost_estimates?select=*`, {
      headers: { 'apikey': SUPABASE_ANON, 'Accept': 'application/json' },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setChemCostData(data); })
      .catch(() => {}); // Silent fail — chart just won't render
  }, []);

  /* ── Session persistence ── */
  useEffect(() => {
    if (isOpen) {
      saveSession({ currentStep, formData });
    }
  }, [currentStep, formData, isOpen]);

  /* ── Pricing calc ── */
  function calculatePrice() {
    const body = SERVICE_BODY_OPTIONS.find(b => b.id === formData.serviceType);
    const basePerVisit = body?.price || 50;
    const extraBodyAdj = formData.hasExtraBody ? 10 : 0;
    const biweeklyAdj = formData.isBiweekly ? 25 : 0;
    const perVisit = basePerVisit + extraBodyAdj + biweeklyAdj;
    const visitsPerMonth = formData.isBiweekly ? 2 : 4;
    const monthly = perVisit * visitsPerMonth;
    return { perVisit, monthly, visitsPerMonth };
  }

  /* ── Nav helpers ── */
  function goNext() { setRedirect(''); setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS)); }
  function goBack() {
    setRedirect('');
    setShowDupCheck(false);
    setCurrentStep(prev => Math.max(prev - 1, 1));
  }

  function handleClose() {
    setIsOpen(false);
  }

  function handleReset() {
    setCurrentStep(1);
    setFormData(DEFAULT_FORM);
    setRedirect('');
    try { sessionStorage.removeItem('getStartedQuote'); } catch {}
    setIsOpen(false);
  }

  /* ── "Get Started Now" → redirect to onboarding page ── */
  function handleGetStartedNow() {
    // Save quote data so the onboarding page can read it
    try {
      sessionStorage.setItem('getStartedOnboarding', JSON.stringify({
        ...formData,
        quotedPerVisit: price.perVisit,
        quotedMonthly: price.monthly,
        visitsPerMonth: price.visitsPerMonth,
      }));
    } catch {}
    window.location.href = assetPath('get-started/');
  }

  /* ── P2-2: Submit ticket (equipment / green pool) ── */
  async function submitTicket(type: 'equipment' | 'green_pool') {
    setTicketError('');
    // Use inline ticket contact fields (user hasn't been through Steps 2-3 at this point)
    const contact = ticketContact;
    if (!contact.firstName.trim() || !contact.phone.replace(/\D/g, '').length || !ticketDescription.trim()) {
      setTicketError('Please fill in your name, phone, and describe the issue.');
      return;
    }
    setTicketSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          firstName: contact.firstName.trim(),
          lastName: contact.lastName.trim(),
          phone: contact.phone.trim(),
          email: contact.email.trim(),
          address: formData.addressStreet || '',
          addressCity: formData.addressCity || '',
          addressState: formData.addressState || 'GA',
          addressZip: formData.addressZip || '',
          county: formData.county || '',
          description: ticketDescription.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Something went wrong' }));
        throw new Error(err.error || 'Submission failed');
      }
      setTicketSubmitted(true);
    } catch (e: any) {
      setTicketError(e.message || 'Something went wrong. Please try again or call us.');
    } finally {
      setTicketSubmitting(false);
    }
  }

  /* ── P2-3: Submit commercial lead ── */
  async function submitCommercialLead() {
    setCommercialError('');
    if (!commercialForm.companyName.trim()) {
      setCommercialError('Please enter your company or facility name.');
      return;
    }
    if (!formData.firstName.trim() || !formData.phone.replace(/\D/g, '').length) {
      setCommercialError('Contact info is missing. Please go back and fill in your details.');
      return;
    }
    setCommercialSubmitting(true);
    try {
      const body: Record<string, any> = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address_street: formData.addressStreet || null,
        address_city: formData.addressCity || null,
        address_state: formData.addressState || 'GA',
        address_zip: formData.addressZip || null,
        county: formData.county || null,
        service_interest: 'commercial',
        customer_type: 'commercial',
        lead_source: 'website_quote_form',
        company_name: commercialForm.companyName.trim(),
        closes_for_winter: commercialForm.closesForWinter,
        summer_frequency: commercialForm.summerFrequency,
        commercial_description: commercialForm.commercialDescription.trim() || null,
      };
      if (commercialForm.closesForWinter) {
        body.winter_frequency = commercialForm.winterFrequency;
      }
      if (commercialForm.pmName.trim()) {
        body.property_manager_name = commercialForm.pmName.trim();
        body.property_manager_phone = commercialForm.pmPhone.trim() || null;
        body.property_manager_email = commercialForm.pmEmail.trim() || null;
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Submission failed');
      }
      setCommercialSubmitted(true);
    } catch (e: any) {
      setCommercialError(e.message || 'Something went wrong. Please try again or call us.');
    } finally {
      setCommercialSubmitting(false);
    }
  }

  /* ── Reset helpers for redirect forms ── */
  function resetTicketState() {
    setTicketFormOpen(false);
    setTicketSubmitting(false);
    setTicketSubmitted(false);
    setTicketDescription('');
    setTicketError('');
    setTicketContact({ firstName: '', lastName: '', phone: '', email: '' });
    setRedirect('');
  }

  function resetCommercialState() {
    setCommercialForm({ companyName: '', closesForWinter: null, summerFrequency: 3, winterFrequency: 2, pmName: '', pmPhone: '', pmEmail: '', commercialDescription: '' });
    setShowPmFields(false);
    setCommercialSubmitting(false);
    setCommercialSubmitted(false);
    setCommercialError('');
    setRedirect('');
  }

  if (!isOpen) return null;

  const pct = Math.round((currentStep / TOTAL_STEPS) * 100);
  const price = calculatePrice();

  /* ═══════════════════════════════════════
     RENDER
     ═══════════════════════════════════════ */
  return (
    <div class="intake-overlay is-open" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }} role="dialog" aria-modal="true" aria-label="Get a quote">
      <div class="intake-modal">
        {/* Close button */}
        <button class="intake-close-btn" onClick={handleClose} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        {/* Progress bar */}
        <div class="intake-progress-bar">
          {currentStep > 1 && (
            <button class="intake-back-arrow" onClick={goBack} aria-label="Go back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            </button>
          )}
          <div class="intake-progress-track">
            <div class="intake-progress-fill" style={`width:${pct}%`} />
          </div>
          <div class="intake-progress-label">
            <span>Step {currentStep} of {TOTAL_STEPS}</span>
            <span>{pct}% Complete</span>
          </div>
        </div>

        {/* Step content */}
        <div class={`intake-body gs-fade-in`} key={currentStep + '-' + redirect + (showDupCheck ? '-dup' : '')}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && (showDupCheck ? renderDupCheck() : renderStep3())}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep7()}
          {currentStep === 6 && renderStep5()}
          {currentStep === 7 && renderStep6()}
          {currentStep === 8 && renderServiceBody()}
          {currentStep === 9 && renderStep9()}
          {currentStep === 10 && renderQuoteDisplay()}
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════
     Step 1 — Service Type
     ══════════════════════════════════ */
  function renderStep1() {
    if (redirect === 'green_pool') {
      return renderGreenPoolRedirect();
    }
    if (redirect === 'equipment') {
      return renderEquipmentRedirect();
    }
    if (redirect === 'renovation') {
      return renderRedirectScreen(
        'Pool Renovation',
        'We partner with PSP for renovation projects.',
        [
          { text: 'Replaster, retile, or full remodel', detail: 'Custom quotes available' },
          { text: 'Call us and we\'ll connect you', detail: 'With the right team' },
        ],
        '/services/pool-renovation/',
        'Explore Renovation Options'
      );
    }

    const icons: Record<string, any> = {
      waves: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>,
      leaf: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 1c1 2 2 4.5 2 8 0 5.5-4.78 10.7-10 11z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>,
      wrench: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
      hammer: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/></svg>,
    };

    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h2 class="intake-step-title">What can we help you with?</h2>
          <p class="intake-step-subtitle">Select the service you're interested in</p>
        </div>
        <div class="gs-service-grid">
          {SERVICE_TYPES.map(svc => (
            <button
              key={svc.id}
              type="button"
              class={`gs-service-card${formData.serviceInterest === svc.id ? ' selected' : ''}`}
              onClick={() => {
                updateForm({ serviceInterest: svc.id });
                if (svc.id === 'maintenance') setTimeout(() => goNext(), 300);
                else setRedirect(svc.id);
              }}
            >
              <div class="gs-service-card-icon">{icons[svc.icon]}</div>
              <h3>{svc.label}</h3>
              <p>{svc.desc}</p>
            </button>
          ))}
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 2 — Service Area
     ══════════════════════════════════ */
  function renderStep2() {
    if (formData.areaResult === 'out-of-area') {
      return (
        <>
          <div class="intake-step-header">
            <div class="intake-step-icon intake-step-icon--sorry">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </div>
            <h2 class="intake-step-title">We're not in your area yet</h2>
            <p class="intake-step-subtitle">We currently serve Bryan, Camden, Chatham, Effingham, Glynn, Liberty & McIntosh counties in Coastal Georgia.</p>
          </div>
          <div class="intake-sorry-content">
            <p>We're growing and may expand to your area in the future. Feel free to call us — we might be able to make something work!</p>
            <div class="intake-sorry-actions">
              <a href="tel:9124590160" class="intake-cta-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Call Us — (912) 459-0160
              </a>
              <button type="button" class="intake-outline-btn" onClick={() => updateForm({ areaResult: '', addressStreet: '', county: '' })}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Try a Different Address
              </button>
            </div>
          </div>
        </>
      );
    }
    return <Step2Address formData={formData} updateForm={updateForm} onContinue={goNext} />;
  }

  /* ══════════════════════════════════
     Step 3 — Contact Info
     ══════════════════════════════════ */
  function renderStep3() {
    const isValid = formData.firstName.trim() && formData.lastName.trim() &&
      formData.email.trim() && formData.phone.replace(/\D/g, '').length >= 10;
    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <h2 class="intake-step-title">Tell us about yourself</h2>
          <p class="intake-step-subtitle">We'll use this to personalize your quote</p>
        </div>
        <div class="intake-form-grid">
          <div class="intake-form-row intake-form-row--half">
            <div class="intake-field">
              <label class="intake-label">First Name *</label>
              <input type="text" class="intake-input" value={formData.firstName} onInput={(e: any) => updateForm({ firstName: e.target.value })} placeholder="First name" autoFocus />
            </div>
            <div class="intake-field">
              <label class="intake-label">Last Name *</label>
              <input type="text" class="intake-input" value={formData.lastName} onInput={(e: any) => updateForm({ lastName: e.target.value })} placeholder="Last name" />
            </div>
          </div>
          <div class="intake-field">
            <label class="intake-label">Email *</label>
            <input type="email" class="intake-input" value={formData.email} onInput={(e: any) => updateForm({ email: e.target.value })} placeholder="your@email.com" />
          </div>
          <div class="intake-field">
            <label class="intake-label">Phone *</label>
            <input type="tel" class="intake-input" value={formData.phone} onInput={(e: any) => updateForm({ phone: formatPhone(e.target.value) })} placeholder="(912) 555-0123" />
          </div>
          {formData.addressStreet && (
            <div class="intake-field">
              <label class="intake-label">Service Address</label>
              <input type="text" class="intake-input" value={formData.addressStreet} disabled style="opacity: 0.7; cursor: not-allowed;" />
              <p style="font-size: 0.8rem; color: var(--text-light); margin-top: 0.25rem;">From your service area check</p>
            </div>
          )}
        </div>
        <div class="intake-actions" style="margin-top: 1.5rem;">
          <button type="button" class="intake-cta-btn" disabled={!isValid} onClick={() => {
            // TODO: Replace mock with real Supabase duplicate check
            const mockDuplicateFound = true;
            if (mockDuplicateFound && !formData.duplicateResolution) {
              setShowDupCheck(true);
            } else {
              goNext();
            }
          }}>
            Continue <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 3b — Existing Customer Check (inline interstitial, not a numbered step)
     Shows within step 3 when a duplicate is found.
     ══════════════════════════════════ */
  function renderDupCheck() {
    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon" style="background: #fef3c7;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 class="intake-step-title">We may already know you!</h2>
          <p class="intake-step-subtitle">It looks like we've done work at this property before.</p>
        </div>
        <div class="gs-existing-card">
          <div class="gs-existing-match">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary-light); display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <strong style="display: block;">{formData.firstName || 'Carter'} S.</strong>
                <span style="font-size: 0.85rem; color: var(--text-light);">Phone: ***-0160</span>
              </div>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-light); margin: 0;">Previous service at this address</p>
          </div>
          <p style="text-align: center; font-weight: 500; margin: 1rem 0 0.75rem;">Is this you?</p>
          <div class="gs-existing-choices">
            <button type="button" class="intake-cta-btn" onClick={() => { updateForm({ duplicateResolution: 'confirmed_yes' }); setShowDupCheck(false); goNext(); }}>Yes, that's me</button>
            <button type="button" class="intake-outline-btn" onClick={() => { updateForm({ duplicateResolution: 'confirmed_no' }); setShowDupCheck(false); goNext(); }}>No, I'm a new customer</button>
            <button type="button" class="intake-text-btn" onClick={() => { updateForm({ duplicateResolution: 'not_sure' }); setShowDupCheck(false); goNext(); }}>Not sure</button>
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 4 — Customer Type
     ══════════════════════════════════ */
  function renderStep4() {
    if (redirect === 'commercial') {
      return renderCommercialForm();
    }
    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <h2 class="intake-step-title">What type of property?</h2>
          <p class="intake-step-subtitle">This helps us provide the right service level</p>
        </div>
        <div class="intake-choice-grid">
          {CUSTOMER_TYPES.map(ct => (
            <button key={ct.id} type="button" class="intake-choice" onClick={() => {
              updateForm({ customerType: ct.id });
              if (ct.id === 'commercial') setRedirect('commercial');
              else setTimeout(() => goNext(), 300);
            }}>
              <div class="intake-choice-icon intake-choice-icon--emoji">{ct.id === 'residential' ? '🏠' : '🏢'}</div>
              <h3>{ct.label}</h3>
              <p>{ct.desc}</p>
            </button>
          ))}
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 5 — Pool Size
     ══════════════════════════════════ */
  function renderStep5() {
    if (redirect === 'large_pool') {
      return renderRedirectScreen('This Pool Needs a Custom Quote', 'Pools over 30,000 gallons require a site visit for accurate pricing.', [
        { text: 'Free on-site evaluation', detail: 'At your convenience' },
        { text: 'Custom pricing based on exact specs', detail: 'Bulk chemical options available' },
      ], '/services/commercial-pool-cleaning/', 'View Large Pool Services');
    }
    const poolIcon = (w: number) => (
      <img src={`${basePath}images/icon-inground-pool.svg`} alt="" width={w} height={w} style="object-fit: contain;" />
    );
    const iconSizes: Record<string, number> = { small: 36, medium: 52, large: 68 };
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
            <button key={s.id} type="button" class={`intake-size-card intake-size-card--${s.id}`} onClick={() => {
              updateForm({ poolSize: s.id });
              if (s.id === 'large') setRedirect('large_pool');
              else setTimeout(() => goNext(), 300);
            }}>
              <div class={`intake-size-icon intake-size-icon--${s.id}`}>{poolIcon(iconSizes[s.id])}</div>
              <h3 class="intake-size-label">{s.label}</h3>
              <p class="intake-size-desc">{s.desc}</p>
            </button>
          ))}
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 6 — Pool Condition
     ══════════════════════════════════ */
  function renderStep6() {
    if (redirect === 'needs_repair') {
      return renderRedirectScreen('Let\'s Get Your Pool Fixed First', 'We recommend getting any issues resolved before starting weekly maintenance.', [
        { text: '$150 residential service call', detail: '$185 for commercial' },
        { text: 'Most repairs completed same day', detail: 'Then we can start maintenance' },
      ], '/services/pool-equipment-repair/', 'View Repair Services');
    }
    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h2 class="intake-step-title">What's the pool's current condition?</h2>
          <p class="intake-step-subtitle">We want to make sure your pool is ready for maintenance</p>
        </div>
        <div class="intake-choice-grid">
          {POOL_CONDITIONS.map(pc => (
            <button key={pc.id} type="button" class="intake-choice" onClick={() => {
              updateForm({ poolCondition: pc.id });
              if (pc.id === 'needs_repair') setRedirect('needs_repair');
              else setTimeout(() => goNext(), 300);
            }}>
              <div class="intake-choice-icon intake-choice-icon--emoji">{pc.id === 'good' ? '✅' : '🔧'}</div>
              <h3>{pc.label}</h3>
              <p>{pc.desc}</p>
            </button>
          ))}
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 7 — Pool Type
     ══════════════════════════════════ */
  function renderStep7() {
    if (redirect === 'above_ground') {
      return renderRedirectScreen('We Appreciate Your Interest!', 'Unfortunately, we only service in-ground pools at this time.', [
        { text: 'We can recommend above-ground specialists', detail: 'In your area' },
        { text: 'Considering converting to in-ground?', detail: 'We can help with that!' },
      ], '/services/', 'View Our Services');
    }
    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          </div>
          <h2 class="intake-step-title">What type of pool?</h2>
          <p class="intake-step-subtitle">This helps us determine if we're the right fit</p>
        </div>
        <div class="intake-choice-grid">
          {POOL_TYPE_OPTIONS.map(pt => (
            <button key={pt.id} type="button" class="intake-choice" onClick={() => {
              updateForm({ isInground: pt.id });
              if (pt.id === 'above_ground') setRedirect('above_ground');
              else setTimeout(() => goNext(), 300);
            }}>
              <div class="intake-choice-icon"><img src={`${basePath}images/${pt.id === 'inground' ? 'icon-inground-pool.svg' : 'icon-above-ground-pool.svg'}`} alt={pt.label} width="48" height="48" style="object-fit: contain;" /></div>
              <h3>{pt.label}</h3>
              <p>{pt.desc}</p>
            </button>
          ))}
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Service Body Selection (3 cards)
     ══════════════════════════════════ */
  function renderServiceBody() {
    const showBiweekly = isBiweeklyAvailable();
    const bodyIcons: Record<string, any> = {
      pool: <img src={`${basePath}images/icon-pool.svg`} alt="Pool" width="64" height="64" style="object-fit: contain;" />,
      spa: <img src={`${basePath}images/icon-spa.svg`} alt="Spa" width="64" height="64" style="object-fit: contain;" />,
      pool_spa_combo: <img src={`${basePath}images/icon-pool-spa-combo.png`} alt="Pool + Spa" width="72" height="72" style="object-fit: contain;" />,
    };

    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>
          </div>
          <h2 class="intake-step-title">What are we maintaining?</h2>
          <p class="intake-step-subtitle">Select the water body you'd like serviced</p>
        </div>

        <div class="gs-body-grid">
          {SERVICE_BODY_OPTIONS.map(opt => (
            <button key={opt.id} type="button" class={`gs-body-card${formData.serviceType === opt.id ? ' selected' : ''}`} onClick={() => updateForm({ serviceType: opt.id })}>
              <div class="gs-body-card-icon">{bodyIcons[opt.id]}</div>
              <h3>{opt.label}</h3>
              <p class="gs-body-card-price">from ${opt.price}/visit</p>
            </button>
          ))}
        </div>

        <button type="button" class={`gs-fountain-toggle${formData.hasExtraBody ? ' active' : ''}`} onClick={() => updateForm({ hasExtraBody: !formData.hasExtraBody })} style="margin-top: 1.25rem;">
          <div class="gs-fountain-icon">
            <img src={`${basePath}images/icon-fountain.svg`} alt="" width="28" height="28" style="object-fit: contain;" />
          </div>
          <div class="gs-fountain-text">
            <strong>Add Fountain</strong>
            <span>Water feature, fountain, etc. · +$10/visit</span>
          </div>
          <div class="gs-fountain-switch">
            <div class="gs-fountain-switch-thumb" />
          </div>
        </button>

        {showBiweekly && (
          <label class="gs-checkbox-item" style="margin-top: 0.75rem;">
            <div class="gs-checkbox-box">
              <input type="checkbox" checked={formData.isBiweekly} onChange={(e: any) => updateForm({ isBiweekly: e.target.checked })} />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <strong>Bi-weekly service</strong>
              <span style="color: var(--text-light); font-size: 0.85rem; display: block;">Every other week (+$25/visit surcharge)</span>
            </div>
          </label>
        )}
        {showBiweekly && <p class="gs-biweekly-note">❄️ Bi-weekly is available September through February only</p>}

        <div class="intake-actions" style="margin-top: 1.5rem;">
          <button type="button" class="intake-cta-btn" onClick={goNext}>
            Continue <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Step 9 — Lead Context
     ══════════════════════════════════ */
  function renderStep9() {
    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <h2 class="intake-step-title">What brings you to us?</h2>
          <p class="intake-step-subtitle">This helps us tailor your experience</p>
        </div>
        <div class="intake-surface-list">
          {LEAD_CONTEXTS.map(lc => (
            <button key={lc.id} type="button" class={`intake-surface-item${formData.leadContext === lc.id ? ' selected' : ''}`} onClick={() => {
              updateForm({ leadContext: lc.id });
              setTimeout(() => goNext(), 300);
            }}>
              <div><h3>{lc.label}</h3><p>{lc.desc}</p></div>
              <div class="intake-surface-radio" />
            </button>
          ))}
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Final Step — Quote Display + Decision
     ══════════════════════════════════ */
  function renderQuoteDisplay() {
    const bodyOpt = SERVICE_BODY_OPTIONS.find(o => o.id === formData.serviceType);
    const bodyLabel = bodyOpt?.label || 'Pool Only';
    const bodyPrice = bodyOpt?.price || 50;

    // "Send Details" confirmation (after clicking Email or Text)
    if (formData.quotePath === 'email' || formData.quotePath === 'text') {
      return (
        <div class="gs-sent-confirm">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: #dcfce7; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h2 style="margin-bottom: 0.5rem;">We'll Be in Touch!</h2>
          <p style="color: var(--text-light); margin-bottom: 1.5rem;">
            We'll send your quote details via <strong>{formData.quotePath === 'email' ? 'email' : 'text message'}</strong> within 24 hours.
          </p>
          <div class="intake-quote-details" style="margin-bottom: 1.5rem;">
            <div class="intake-quote-total">
              <span>Estimated Monthly Rate</span>
              <span class="intake-quote-total-val">${price.monthly}/mo</span>
            </div>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-light);">
            Questions? Call us at <a href="tel:9124590160" style="color: var(--color-primary); font-weight: 500;">(912) 459-0160</a>
          </p>
          <button type="button" class="intake-text-btn" style="margin-top: 1rem;" onClick={() => updateForm({ quotePath: '' })}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back to Quote
          </button>
        </div>
      );
    }

    // Main quote display with line-item breakdown
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
              <span>{bodyLabel} Maintenance</span>
              <span class="intake-quote-line-val">${bodyPrice}/visit</span>
            </div>
            {formData.hasExtraBody && (
              <div class="intake-quote-line">
                <span>Fountain / Water Feature</span>
                <span class="intake-quote-line-val">+$10/visit</span>
              </div>
            )}
            {formData.isBiweekly && (
              <div class="intake-quote-line">
                <span>Bi-weekly Service Surcharge</span>
                <span class="intake-quote-line-val">+$25/visit</span>
              </div>
            )}
            <div class="intake-quote-line intake-quote-line--subtle">
              <span>Per Visit Rate</span>
              <span class="intake-quote-line-val">${price.perVisit}</span>
            </div>
            <div class="intake-quote-total">
              <span>Estimated Monthly Rate</span>
              <span class="intake-quote-total-val">${price.monthly}/mo</span>
            </div>
          </div>

          <div class="gs-quote-disclaimers">
            <div class="gs-quote-disclaimer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>Chemical costs are <strong>not included</strong> and are billed separately based on usage</span>
            </div>
            <div class="gs-quote-disclaimer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Monthly estimate based on <strong>4 visits</strong> — some months may include 5 visits</span>
            </div>
          </div>

          {chemCostData && chemCostData.length > 0 && (
            <ChemicalCostChart
              data={chemCostData.filter((r: any) =>
                r.service_frequency === (formData.isBiweekly ? 'biweekly' : 'weekly')
              )}
              serviceMonthly={price.monthly}
            />
          )}

          <div class="intake-included">
            <h3>What's Included Each Visit:</h3>
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
            <button type="button" class="intake-cta-btn" onClick={handleGetStartedNow}>
              Get Started Now
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
            <div class="intake-btn-row">
              <button type="button" class="intake-outline-btn" onClick={() => updateForm({ quotePath: 'email' })}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                Email Quote
              </button>
              <button type="button" class="intake-outline-btn" onClick={() => updateForm({ quotePath: 'text' })}>
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
     P2-2 — Equipment Redirect (with ticket form)
     ══════════════════════════════════ */
  function renderEquipmentRedirect() {
    if (ticketSubmitted) {
      return (
        <>
          <div class="intake-step-header">
            <div class="intake-step-icon" style="background: #dcfce7;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <h2 class="intake-step-title">We've got your request!</h2>
            <p class="intake-step-subtitle">We'll have someone call you back shortly to schedule your equipment service call.</p>
          </div>
          <div class="intake-sorry-content">
            <div class="intake-ticket-pricing-note">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span><strong>$150 residential</strong> / <strong>$185 commercial</strong> diagnosis fee applies</span>
            </div>
            <div class="intake-sorry-actions">
              <button type="button" class="intake-text-btn" onClick={resetTicketState}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back to Services
              </button>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon intake-step-icon--commercial">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <h2 class="intake-step-title">Equipment Service & Repair</h2>
          <p class="intake-step-subtitle">Our techs can diagnose and fix the issue on-site.</p>
        </div>
        <div class="intake-sorry-content">
          <div class="intake-sorry-help intake-sorry-help--blue">
            <h3>What to expect:</h3>
            <ul>
              <li><strong>$150 residential service call</strong> — $185 for commercial</li>
              <li><strong>Most repairs completed same day</strong> — Parts ordered if needed</li>
            </ul>
          </div>

          <div class="intake-sorry-actions">
            <a href="tel:9124590160" class="intake-cta-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Call to Schedule — (912) 459-0160
            </a>
          </div>

          <div class="intake-ticket-divider">
            <span>or</span>
          </div>

          <button type="button" class={`intake-ticket-toggle${ticketFormOpen ? ' open' : ''}`} onClick={() => setTicketFormOpen(!ticketFormOpen)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Describe your issue & we'll call you back</span>
            <svg class="intake-ticket-toggle-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          {ticketFormOpen && (
            <div class="intake-ticket-form">
              <div class="intake-form-grid">
                <div class="intake-form-row intake-form-row--half">
                  <div class="intake-field">
                    <label class="intake-label">First Name *</label>
                    <input type="text" class="intake-input" value={ticketContact.firstName} onInput={(e: any) => setTicketContact(p => ({ ...p, firstName: e.target.value }))} placeholder="First name" />
                  </div>
                  <div class="intake-field">
                    <label class="intake-label">Last Name</label>
                    <input type="text" class="intake-input" value={ticketContact.lastName} onInput={(e: any) => setTicketContact(p => ({ ...p, lastName: e.target.value }))} placeholder="Last name" />
                  </div>
                </div>
                <div class="intake-form-row intake-form-row--half">
                  <div class="intake-field">
                    <label class="intake-label">Phone *</label>
                    <input type="tel" class="intake-input" value={ticketContact.phone} onInput={(e: any) => setTicketContact(p => ({ ...p, phone: formatPhone(e.target.value) }))} placeholder="(912) 555-0123" />
                  </div>
                  <div class="intake-field">
                    <label class="intake-label">Email</label>
                    <input type="email" class="intake-input" value={ticketContact.email} onInput={(e: any) => setTicketContact(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" />
                  </div>
                </div>
                <div class="intake-field">
                  <label class="intake-label">What's going on with your equipment? *</label>
                  <textarea class="intake-input intake-textarea" rows={3} value={ticketDescription} onInput={(e: any) => setTicketDescription(e.target.value)} placeholder="e.g. Pump is making a loud noise, filter pressure is high, heater won't turn on..." />
                </div>
              </div>

              <div class="intake-ticket-pricing-note">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span><strong>$150 residential</strong> / <strong>$185 commercial</strong> diagnosis fee</span>
              </div>

              {ticketError && <p class="intake-submit-error">{ticketError}</p>}

              <button type="button" class="intake-cta-btn" style="width: 100%; margin-top: 0.75rem;" disabled={ticketSubmitting} onClick={() => submitTicket('equipment')}>
                {ticketSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          )}

          <div style="margin-top: 1rem; text-align: center;">
            <a href="/services/pool-equipment-repair/" class="intake-outline-btn" style="display: inline-flex;">View Equipment Services</a>
          </div>
          <div style="text-align: center; margin-top: 0.75rem;">
            <button type="button" class="intake-text-btn" onClick={resetTicketState}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Go Back
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     P2-2 — Green Pool Redirect (with ticket form)
     ══════════════════════════════════ */
  function renderGreenPoolRedirect() {
    if (ticketSubmitted) {
      return (
        <>
          <div class="intake-step-header">
            <div class="intake-step-icon" style="background: #dcfce7;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <h2 class="intake-step-title">We've got your request!</h2>
            <p class="intake-step-subtitle">We'll have someone call you back shortly to schedule your green pool evaluation.</p>
          </div>
          <div class="intake-sorry-content">
            <div class="intake-ticket-pricing-note">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span><strong>$50 green pool evaluation</strong> — $150 if equipment is also down</span>
            </div>
            <div class="intake-sorry-actions">
              <button type="button" class="intake-text-btn" onClick={resetTicketState}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back to Services
              </button>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon intake-step-icon--commercial">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 1c1 2 2 4.5 2 8 0 5.5-4.78 10.7-10 11z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
          </div>
          <h2 class="intake-step-title">Green Pool Recovery</h2>
          <p class="intake-step-subtitle">Green pools need a site visit for an accurate quote.</p>
        </div>
        <div class="intake-sorry-content">
          <div class="intake-sorry-help intake-sorry-help--blue">
            <h3>What to expect:</h3>
            <ul>
              <li><strong>$50 green pool evaluation</strong> — $150 if equipment is also down</li>
              <li><strong>Typical recovery takes 3-7 days</strong> — Depending on severity</li>
            </ul>
          </div>

          <div class="intake-sorry-actions">
            <a href="tel:9124590160" class="intake-cta-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Call to Schedule — (912) 459-0160
            </a>
          </div>

          <div class="intake-ticket-divider">
            <span>or</span>
          </div>

          <button type="button" class={`intake-ticket-toggle${ticketFormOpen ? ' open' : ''}`} onClick={() => setTicketFormOpen(!ticketFormOpen)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Describe your pool & we'll call you back</span>
            <svg class="intake-ticket-toggle-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          {ticketFormOpen && (
            <div class="intake-ticket-form">
              <div class="intake-form-grid">
                <div class="intake-form-row intake-form-row--half">
                  <div class="intake-field">
                    <label class="intake-label">First Name *</label>
                    <input type="text" class="intake-input" value={ticketContact.firstName} onInput={(e: any) => setTicketContact(p => ({ ...p, firstName: e.target.value }))} placeholder="First name" />
                  </div>
                  <div class="intake-field">
                    <label class="intake-label">Last Name</label>
                    <input type="text" class="intake-input" value={ticketContact.lastName} onInput={(e: any) => setTicketContact(p => ({ ...p, lastName: e.target.value }))} placeholder="Last name" />
                  </div>
                </div>
                <div class="intake-form-row intake-form-row--half">
                  <div class="intake-field">
                    <label class="intake-label">Phone *</label>
                    <input type="tel" class="intake-input" value={ticketContact.phone} onInput={(e: any) => setTicketContact(p => ({ ...p, phone: formatPhone(e.target.value) }))} placeholder="(912) 555-0123" />
                  </div>
                  <div class="intake-field">
                    <label class="intake-label">Email</label>
                    <input type="email" class="intake-input" value={ticketContact.email} onInput={(e: any) => setTicketContact(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" />
                  </div>
                </div>
                <div class="intake-field">
                  <label class="intake-label">Tell us about your pool's condition *</label>
                  <textarea class="intake-input intake-textarea" rows={3} value={ticketDescription} onInput={(e: any) => setTicketDescription(e.target.value)} placeholder="e.g. Pool has been green for 2 weeks, pump is running but water isn't clearing..." />
                </div>
              </div>

              <div class="intake-ticket-pricing-note">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span><strong>$50 green pool evaluation</strong> — $150 if equipment is also down</span>
              </div>

              {ticketError && <p class="intake-submit-error">{ticketError}</p>}

              <button type="button" class="intake-cta-btn" style="width: 100%; margin-top: 0.75rem;" disabled={ticketSubmitting} onClick={() => submitTicket('green_pool')}>
                {ticketSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          )}

          <div style="margin-top: 1rem; text-align: center;">
            <a href="/services/green-pool-cleaning/" class="intake-outline-btn" style="display: inline-flex;">Learn About Green Pool Recovery</a>
          </div>
          <div style="text-align: center; margin-top: 0.75rem;">
            <button type="button" class="intake-text-btn" onClick={resetTicketState}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Go Back
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     P2-3 — Commercial Mini-Form
     ══════════════════════════════════ */
  function renderCommercialForm() {
    if (commercialSubmitted) {
      return (
        <>
          <div class="intake-step-header">
            <div class="intake-step-icon" style="background: #dcfce7;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <h2 class="intake-step-title">Request Received!</h2>
            <p class="intake-step-subtitle">We'll reach out within 24 hours to discuss your needs and schedule a free site visit.</p>
          </div>
          <div class="intake-sorry-content">
            <div class="intake-ticket-pricing-note" style="background: #f0fdf4; border-color: #bbf7d0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span>Free on-site evaluation included — no obligation</span>
            </div>
            <p style="text-align: center; color: var(--color-text-light); font-size: 0.9rem; margin-top: 1rem;">
              Questions? Call us at <a href="tel:9124590160" style="color: var(--color-primary); font-weight: 500;">(912) 459-0160</a>
            </p>
            <div class="intake-sorry-actions" style="margin-top: 0.75rem;">
              <button type="button" class="intake-text-btn" onClick={resetCommercialState}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back to Services
              </button>
            </div>
          </div>
        </>
      );
    }

    const freqOptions = [
      { value: 2, label: '2x per week' },
      { value: 3, label: '3x per week' },
      { value: 4, label: '4x per week' },
      { value: 5, label: '5x per week' },
      { value: 6, label: '6x per week' },
      { value: 7, label: '7x per week' },
    ];

    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon intake-step-icon--commercial">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
          </div>
          <h2 class="intake-step-title">Commercial Pool Service</h2>
          <p class="intake-step-subtitle">Tell us about your facility and we'll put together a custom quote.</p>
        </div>

        <div class="intake-commercial-body">
          {/* Your Info (read-only from previous steps) */}
          <div class="intake-commercial-section">
            <h3 class="intake-commercial-section-title">Your Info</h3>
            <div class="intake-commercial-confirm">
              <div class="intake-commercial-confirm-row">
                <span class="intake-commercial-confirm-label">Name</span>
                <span>{formData.firstName} {formData.lastName}</span>
              </div>
              {formData.email && (
                <div class="intake-commercial-confirm-row">
                  <span class="intake-commercial-confirm-label">Email</span>
                  <span>{formData.email}</span>
                </div>
              )}
              <div class="intake-commercial-confirm-row">
                <span class="intake-commercial-confirm-label">Phone</span>
                <span>{formData.phone}</span>
              </div>
              {formData.addressStreet && (
                <div class="intake-commercial-confirm-row">
                  <span class="intake-commercial-confirm-label">Address</span>
                  <span>{formData.addressStreet}{formData.addressCity ? `, ${formData.addressCity}` : ''}{formData.addressState ? `, ${formData.addressState}` : ''} {formData.addressZip}</span>
                </div>
              )}
            </div>
          </div>

          {/* Company Details */}
          <div class="intake-commercial-section">
            <h3 class="intake-commercial-section-title">Company Details</h3>
            <div class="intake-field">
              <label class="intake-label">Company / Facility Name *</label>
              <input type="text" class="intake-input" value={commercialForm.companyName} onInput={(e: any) => setCommercialForm(p => ({ ...p, companyName: e.target.value }))} placeholder="e.g. Oceanview HOA, Hampton Inn Savannah" />
            </div>
          </div>

          {/* Service Frequency */}
          <div class="intake-commercial-section">
            <h3 class="intake-commercial-section-title">Service Frequency</h3>
            <div class="intake-field">
              <label class="intake-label">Do you close your pool for the winter?</label>
              <div class="intake-toggle-btns">
                <button type="button" class={`intake-toggle-btn${commercialForm.closesForWinter === false ? ' active' : ''}`} onClick={() => setCommercialForm(p => ({ ...p, closesForWinter: false }))}>No — Year-round</button>
                <button type="button" class={`intake-toggle-btn${commercialForm.closesForWinter === true ? ' active' : ''}`} onClick={() => setCommercialForm(p => ({ ...p, closesForWinter: true }))}>Yes — Seasonal</button>
              </div>
            </div>

            {commercialForm.closesForWinter === false && (
              <div class="intake-field">
                <label class="intake-label">Service Frequency</label>
                <select class="intake-input" value={commercialForm.summerFrequency} onChange={(e: any) => setCommercialForm(p => ({ ...p, summerFrequency: parseInt(e.target.value) }))}>
                  {freqOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            )}

            {commercialForm.closesForWinter === true && (
              <div class="intake-freq-grid">
                <div class="intake-field">
                  <label class="intake-label">Summer Frequency</label>
                  <select class="intake-input" value={commercialForm.summerFrequency} onChange={(e: any) => setCommercialForm(p => ({ ...p, summerFrequency: parseInt(e.target.value) }))}>
                    {freqOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div class="intake-field">
                  <label class="intake-label">Winter Frequency</label>
                  <select class="intake-input" value={commercialForm.winterFrequency} onChange={(e: any) => setCommercialForm(p => ({ ...p, winterFrequency: parseInt(e.target.value) }))}>
                    {freqOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {commercialForm.closesForWinter !== null && (
              <p class="intake-freq-note">2x per week is the minimum required by us and the GA DPH for commercial pools.</p>
            )}
          </div>

          {/* Property Manager */}
          <div class="intake-commercial-section">
            {!showPmFields ? (
              <button type="button" class="intake-pm-toggle" onClick={() => setShowPmFields(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add property manager contact
              </button>
            ) : (
              <>
                <h3 class="intake-commercial-section-title">Property Manager (Optional)</h3>
                <div class="intake-form-grid">
                  <div class="intake-field">
                    <label class="intake-label">Name</label>
                    <input type="text" class="intake-input" value={commercialForm.pmName} onInput={(e: any) => setCommercialForm(p => ({ ...p, pmName: e.target.value }))} placeholder="Property manager name" />
                  </div>
                  <div class="intake-form-row intake-form-row--half">
                    <div class="intake-field">
                      <label class="intake-label">Phone</label>
                      <input type="tel" class="intake-input" value={commercialForm.pmPhone} onInput={(e: any) => setCommercialForm(p => ({ ...p, pmPhone: formatPhone(e.target.value) }))} placeholder="(912) 555-0123" />
                    </div>
                    <div class="intake-field">
                      <label class="intake-label">Email</label>
                      <input type="email" class="intake-input" value={commercialForm.pmEmail} onInput={(e: any) => setCommercialForm(p => ({ ...p, pmEmail: e.target.value }))} placeholder="pm@company.com" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Additional Details */}
          <div class="intake-commercial-section">
            <h3 class="intake-commercial-section-title">Additional Details <span style="font-weight: 400; color: var(--color-text-light);">(Optional)</span></h3>
            <div class="intake-field">
              <textarea class="intake-input intake-textarea" rows={3} value={commercialForm.commercialDescription} onInput={(e: any) => setCommercialForm(p => ({ ...p, commercialDescription: e.target.value }))} placeholder="Tell us about your facility, number of pools/spas, current service challenges, etc." />
            </div>
          </div>

          {/* Actions */}
          {commercialError && <p class="intake-submit-error">{commercialError}</p>}

          <button type="button" class="intake-cta-btn" style="width: 100%;" disabled={commercialSubmitting} onClick={submitCommercialLead}>
            {commercialSubmitting ? 'Submitting...' : 'Request Commercial Quote'}
          </button>

          <p style="text-align: center; color: var(--color-text-light); font-size: 0.85rem; margin-top: 0.75rem;">
            Or call us at <a href="tel:9124590160" style="color: var(--color-primary); font-weight: 500;">(912) 459-0160</a>
          </p>

          <div style="text-align: center; margin-top: 0.5rem;">
            <button type="button" class="intake-text-btn" onClick={resetCommercialState}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Go Back
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     Redirect Screen (reusable)
     ══════════════════════════════════ */
  function renderRedirectScreen(title: string, subtitle: string, bullets: { text: string; detail: string }[], linkHref: string, linkText: string) {
    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon intake-step-icon--commercial">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </div>
          <h2 class="intake-step-title">{title}</h2>
          <p class="intake-step-subtitle">{subtitle}</p>
        </div>
        <div class="intake-sorry-content">
          <div class="intake-sorry-help intake-sorry-help--blue">
            <h3>What to expect:</h3>
            <ul>{bullets.map((b, i) => <li key={i}><strong>{b.text}</strong> — {b.detail}</li>)}</ul>
          </div>
          <div class="intake-sorry-actions">
            <a href="tel:9124590160" class="intake-cta-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Call to Schedule — (912) 459-0160
            </a>
            <a href={linkHref} class="intake-outline-btn">{linkText}</a>
            <button type="button" class="intake-text-btn" onClick={() => setRedirect('')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Go Back
            </button>
          </div>
        </div>
      </>
    );
  }
}

/* ══════════════════════════════════
   Step 2 Address Sub-Component
   ══════════════════════════════════ */
function Step2Address({ formData, updateForm, onContinue }: {
  formData: QuoteFormData;
  updateForm: (u: Partial<QuoteFormData>) => void;
  onContinue: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [heatmapCount, setHeatmapCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try { await loadGoogleMaps(); } catch { console.error('Google Maps failed to load'); return; }
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

          const countyComp = place.address_components?.find(
            (c: any) => c.types.includes('administrative_area_level_2')
          );
          const hitCounty = (countyComp?.long_name || '').replace(' County', '');

          // Extract address components
          const comps = place.address_components || [];
          const streetNum = comps.find((c: any) => c.types.includes('street_number'))?.long_name || '';
          const route = comps.find((c: any) => c.types.includes('route'))?.long_name || '';
          const street = `${streetNum} ${route}`.trim();
          const city = comps.find((c: any) => c.types.includes('locality'))?.long_name || '';
          const state = comps.find((c: any) => c.types.includes('administrative_area_level_1'))?.short_name || 'GA';
          const zip = comps.find((c: any) => c.types.includes('postal_code'))?.long_name || '';

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
            updateForm({ areaResult: 'in-area', county: hitCounty, addressStreet: street || place.formatted_address || '', addressCity: city, addressState: state, addressZip: zip });
          } else {
            updateForm({ areaResult: 'out-of-area', county: '', addressStreet: place.formatted_address || '' });
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

              const scale = Math.min(count / 80, 1);

              // Outer glow
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

              // Mid glow
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

              // Core glow
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
  }, []);

  return (
    <>
      <div class="intake-step-header intake-step-header--inline">
        <div class="intake-step-icon intake-step-icon--sm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div>
          <h2 class="intake-step-title">Let's check your area</h2>
          <p class="intake-step-subtitle">Enter your address to confirm we service your neighborhood</p>
        </div>
      </div>

      <div class="intake-search intake-search--hero">
        <div class="intake-search-wrapper">
          <svg class="intake-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <input ref={inputRef} type="text" placeholder="Enter your address to check coverage..." class="intake-search-input intake-search-input--with-icon" autocomplete="off" onInput={() => { if (formData.areaResult) updateForm({ areaResult: '' }); }} />
        </div>
      </div>

      {formData.areaResult === 'in-area' && (
        <div class="intake-area-result intake-area-result--success">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span><strong>Great news!</strong> Join {heatmapCount > 50 ? `${heatmapCount}+` : '500+'} customers who trust Perfect Pools.</span>
          <button class="intake-area-continue" onClick={onContinue}>
            Continue <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
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
