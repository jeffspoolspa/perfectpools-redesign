import { useState, useEffect, useRef } from 'preact/hooks';
import { assetPath } from '../utils/base-url';
import QuotePricingSection, { type PricingPlan } from './QuotePricingSection';

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

const REFERRAL_SOURCES = [
  { id: 'google', label: 'Google', icon: 'search' },
  { id: 'social_media', label: 'Social Media', icon: 'share' },
  { id: 'saw_truck', label: 'Saw Our Truck', icon: 'truck' },
  { id: 'word_of_mouth', label: 'Word of Mouth', icon: 'users' },
  { id: 'print_ad', label: 'Print Advertisement', icon: 'newspaper' },
  { id: 'other', label: 'Other', icon: 'more' },
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

const COMMERCIAL_FREQUENCY_OPTIONS = [
  { value: 2, label: '2x per week' },
  { value: 3, label: '3x per week' },
  { value: 4, label: '4x per week' },
  { value: 5, label: '5x per week' },
  { value: 6, label: '6x per week' },
  { value: 7, label: '7x per week' },
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
  try { const r = sessionStorage.getItem('getStartedQuoteV2'); return r ? JSON.parse(r) : null; } catch { return null; }
}

function saveSession(d: any) {
  try { sessionStorage.setItem('getStartedQuoteV2', JSON.stringify(d)); } catch {}
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

/* ── API client lives in src/lib/leads/client.ts now ─────────
   Extracted in PR C so the network layer is testable in isolation and
   can be reused by future surfaces (e.g. the internal-app back office).
   The Turnstile site key is browser-safe (PUBLIC_ prefix); only the
   server-side secret needs protection. */
const TURNSTILE_SITE_KEY = ((import.meta.env as Record<string, string | undefined>).PUBLIC_TURNSTILE_SITE_KEY ?? '') as string;
import {
  apiSubmitLead,
  apiAcceptLead,
  apiSendQuote,
  getUtmParams,
  setTurnstileToken,
  type DedupMatch as _DedupMatch,
} from '../lib/leads/client';
export type DedupMatch = _DedupMatch;
import { ConfirmationModal, type ConfirmKind } from './lead-flow/ConfirmationModal';

/* Load Cloudflare Turnstile JS once. The widget then auto-mounts onto any
   `.cf-turnstile` div in the DOM and writes the token into the input named
   `cf-turnstile-response`. We poll for the token and stash it in module
   scope so apiStartLead can attach it without prop drilling. */
function loadTurnstile(): void {
  if (!TURNSTILE_SITE_KEY) return; // dev mode: backend uses TURNSTILE_DISABLED=1
  if (document.getElementById('cf-turnstile-script')) return;
  const s = document.createElement('script');
  s.id = 'cf-turnstile-script';
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
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
  poolCondition: string;
  referralSource: string;
  isInground: string;
  serviceType: string;
  serviceTypeTouched: boolean;
  hasExtraBody: boolean;
  isBiweekly: boolean;
  leadContext: string;
  contactPreference: string;
  quotePath: string;
}

type TicketType = 'equipment' | 'green_pool' | 'renovation';
type TicketQualifierState = Record<TicketType, Record<string, string>>;

type TicketQualifierQuestion = {
  id: string;
  label: string;
  options: Array<{ id: string; label: string }>;
};

const TICKET_QUALIFIER_CONFIG: Record<TicketType, { questions: TicketQualifierQuestion[] }> = {
  equipment: {
    questions: [
      {
        id: 'equipment_type',
        label: 'What equipment is acting up?',
        options: [
          { id: 'pump', label: 'Pump' },
          { id: 'filter', label: 'Filter' },
          { id: 'heater', label: 'Heater' },
          { id: 'cleaner_automation', label: 'Cleaner / automation' },
          { id: 'not_sure', label: 'Not sure' },
        ],
      },
      {
        id: 'currently_running',
        label: 'Is the system currently running?',
        options: [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
          { id: 'intermittent', label: 'Intermittent' },
          { id: 'not_sure', label: 'Not sure' },
        ],
      },
    ],
  },
  green_pool: {
    questions: [
      {
        id: 'green_duration',
        label: 'How long has it been green?',
        options: [
          { id: 'under_week', label: 'Under 1 week' },
          { id: 'one_two_weeks', label: '1-2 weeks' },
          { id: 'over_two_weeks', label: '2+ weeks' },
          { id: 'not_sure', label: 'Not sure' },
        ],
      },
      {
        id: 'bottom_visible',
        label: 'Can you see the pool bottom?',
        options: [
          { id: 'yes', label: 'Yes' },
          { id: 'partially', label: 'Partially' },
          { id: 'no', label: 'No' },
        ],
      },
    ],
  },
  renovation: {
    questions: [
      {
        id: 'project_type',
        label: 'What kind of project?',
        options: [
          { id: 'resurface', label: 'Resurface' },
          { id: 'tile_coping', label: 'Tile / coping' },
          { id: 'full_remodel', label: 'Full remodel' },
          { id: 'not_sure', label: 'Not sure' },
        ],
      },
      {
        id: 'timeline',
        label: 'When are you hoping to start?',
        options: [
          { id: 'asap', label: 'ASAP' },
          { id: 'one_three_months', label: '1-3 months' },
          { id: 'planning_ahead', label: 'Planning ahead' },
          { id: 'not_sure', label: 'Not sure' },
        ],
      },
    ],
  },
};

function createEmptyTicketQualifiers(): TicketQualifierState {
  return { equipment: {}, green_pool: {}, renovation: {} };
}

function isTicketType(value: string): value is TicketType {
  return value === 'equipment' || value === 'green_pool' || value === 'renovation';
}

function getCommercialFrequencyLabel(value: number) {
  return COMMERCIAL_FREQUENCY_OPTIONS.find(option => option.value === value)?.label || `${value}x per week`;
}

const DEFAULT_FORM: QuoteFormData = {
  serviceInterest: '',
  addressStreet: '', addressCity: '', addressState: 'GA', addressZip: '', county: '', areaResult: '',
  firstName: '', lastName: '', email: '', phone: '',
  duplicateResolution: '',
  customerType: '',
  poolCondition: '',
  referralSource: '',
  isInground: '',
  serviceType: '', serviceTypeTouched: false, hasExtraBody: false, isBiweekly: false,
  leadContext: '',
  contactPreference: '', quotePath: '',
};

/* ── Main Component (V2 — persistent hero banner shell) ──
 * Iterating on the modal UX. The original GetStartedQuote.tsx is
 * preserved on disk as the revert path; if this V2 doesn't pan out,
 * change the BaseLayout import back to the original.
 */
export default function GetStartedQuoteV2({ basePath = '/' }: { basePath?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<QuoteFormData>(DEFAULT_FORM);
  const [redirect, setRedirect] = useState('');
  /* Transient "preparing your request" loading state shown when the
     user picks a non-maintenance service from the progressive page.
     Before this existed, clicking Green Pool / Equipment / Renovation
     instantly swapped the entire screen to the ticket-form view —
     which felt jarring (the user described it as a "blank bar
     flash"). With this state we hold a brief loading screen
     (~700ms) so the old content fades out, a loading screen with
     the logo shows, then the new content settles in. Holds the
     PENDING service id so the loading screen could theoretically
     show the picked icon — current implementation just shows the
     brand logo, but we keep the id around in case we want to. */
  const [redirectLoading, setRedirectLoading] = useState<string>('');
  const [showDupCheck, setShowDupCheck] = useState(false);
  const [chemCostData, setChemCostData] = useState<any[] | null>(null);

  // P2-2: Ticket form state (equipment + green pool redirect screens)
  const [ticketFormOpen, setTicketFormOpen] = useState(false);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketQualifiers, setTicketQualifiers] = useState<TicketQualifierState>(createEmptyTicketQualifiers());
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

  // Lead submission state
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadToken, setLeadToken] = useState<string | null>(null);
  /* The Supabase customer id that the first createLead call created
     (or matched into via dedup). Tracked separately from leadId so we
     can fire a NEW lead under the SAME customer when the user clicks
     "Need something else?" on the confirmation modal — passing
     existing_customer_id + customer_action='use_existing' to the
     /api/leads/submit RPC skips the dedup round trip the second time. */
  const [accountId, setAccountId] = useState<number | null>(null);
  /* The actual server-side resume token (HttpOnly cookie's value), echoed
     back to us in the submit response. We pass this in the body of
     subsequent /accept and /send-quote calls so the flow keeps working
     even if the cookie gets dropped (Safari ITP, third-party-cookie
     blocking, iframe sandboxing). Separate from leadToken (the URL
     token to the onboarding page, currently equal to lead_id). */
  const [resumeToken, setResumeToken] = useState<string | null>(null);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState('');
  // Separate state for the post-createLead "actually send the quote" POST.
  // Lets us show "Sending..." after the lead is saved, and keep both buttons
  // disabled during the send without conflating it with the createLead state.
  const [quoteSending, setQuoteSending] = useState<'email' | 'sms' | null>(null);
  /* Tracks which channels the customer has successfully fired the
     initial-quote send through. Each channel can fire AT MOST ONCE —
     after a successful send we mark it sent here, swap the button to a
     green "Sent" state, and ignore further clicks. This separates from
     formData.quotePath (which records the INITIAL channel the customer
     picked and drives the "Check your email/text" confirmation pill).
     The pill stays locked to the initial channel even after they fire
     the other channel as a secondary action. */
  const [channelsSent, setChannelsSent] = useState<{ email: boolean; sms: boolean }>({
    email: false,
    sms: false,
  });

  // Duplicate check state
  const [dupChecking, setDupChecking] = useState(false);
  const [dupMatchName, setDupMatchName] = useState('');
  const [dupMatchPhone, setDupMatchPhone] = useState('');
  const [dupMatchEmail, setDupMatchEmail] = useState('');
  // Customer_id of the matched record — needed to re-submit with
  // customer_action='use_existing' when the user confirms "Yes, that's me".
  const [dupMatchCustomerId, setDupMatchCustomerId] = useState<number | null>(null);

  const updateForm = (updates: Partial<QuoteFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  /* ── Open / close ── */
  useEffect(() => {
    /**
     * Open handler. Accepts an optional CustomEvent payload:
     *   detail.prefill — partial QuoteFormData (firstName, lastName,
     *     email, phone, addressStreet, addressCity, addressState,
     *     addressZip, county, serviceInterest, customerType, …).
     *   detail.skipToStep — explicit step override.
     *
     * If no skipToStep is passed but prefill includes enough data, we
     * smart-skip: address-only opens at the contact step; address +
     * contact opens at the progressive pool page. Without prefill,
     * starts at step 1 as before.
     */
    const handler = (e?: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const prefill: Partial<QuoteFormData> = detail.prefill || {};
      const saved = getSession();
      const savedForm = saved?.formData || {};
      // Prefill wins over session, but session fills in anything the
      // prefill doesn't specify (so a returning user's earlier inputs
      // aren't blown away).
      const merged = { ...savedForm, ...prefill };
      setFormData(prev => ({ ...prev, ...merged }));

      let nextStep = detail.skipToStep as number | undefined;
      if (!nextStep) {
        const hasAddress = !!merged.addressStreet;
        const hasContact = !!(merged.firstName && merged.lastName && merged.email && merged.phone);
        if (hasAddress && hasContact) nextStep = 3;
        else if (hasAddress) nextStep = 2;
        else nextStep = 1;
      }
      setCurrentStep(nextStep);
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

  /* (Cookie-based resume effect removed — in the new flow, the lead row
     and its resume_token only exist AFTER a full submit at the end of the
     qualifying page. There's no partial-lead state to resume to. The
     sessionStorage saveSession/getSession pattern still handles "user
     closed and reopened the modal in the same browser session" for the
     in-progress form data.) */

  /* ── Turnstile widget mount ────────────────────────────────
     Loads the Cloudflare Turnstile script once. When the script is ready
     it auto-mounts onto our `.cf-turnstile` div (rendered in the modal
     JSX below) and invokes window.ppTurnstileCallback with the verification
     token. We stash the token in module scope so apiStartLead can attach it.
     Without a PUBLIC_TURNSTILE_SITE_KEY env var, the widget is skipped —
     in dev set TURNSTILE_DISABLED=1 on the server so /api/leads/start still
     accepts requests.                                                  */
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    (window as any).ppTurnstileCallback = (token: string) => setTurnstileToken(token);
    (window as any).ppTurnstileExpired = () => setTurnstileToken(null);
    loadTurnstile();
  }, []);

  /* ── Escape key ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  /* ── Enter-to-advance ──────────────────────────────────────
     Lets keyboard users move through the modal by pressing Enter
     whenever the current screen has an enabled forward/submit button.
     Textareas keep normal Enter behavior, and Google Places keeps Enter
     while autocomplete suggestions are visible. */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key !== 'Enter' ||
        e.defaultPrevented ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.shiftKey
      ) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('textarea, [contenteditable="true"]')) return;

      const autocompleteOpen = Array.from(document.querySelectorAll<HTMLElement>('.pac-container .pac-item'))
        .some(item => item.offsetParent !== null);
      if (target.closest('.intake-search-input') && autocompleteOpen) return;

      const modal = document.querySelector('.intake-overlay.is-open');
      const advanceButton = Array.from(modal?.querySelectorAll<HTMLButtonElement>('button[data-intake-advance]') || [])
        .find(button => !button.disabled && button.offsetParent !== null);

      if (!advanceButton) return;

      const nativeControl = target.closest('button, a, select');
      const isAdvanceControl = nativeControl && (nativeControl as HTMLElement).matches('[data-intake-advance]');
      const isSelectedQualifierChip = nativeControl && (nativeControl as HTMLElement).matches('.intake-ticket-chip.is-selected');
      if (nativeControl && !isAdvanceControl && !isSelectedQualifierChip) return;

      e.preventDefault();
      advanceButton.click();
    };

    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  /* ── Body scroll lock ──────────────────────────────────────
     `overflow: hidden` on the body blocks NATIVE wheel/touch
     scroll — which is enough on plain pages. But this site runs
     Lenis (a smooth-scroll library) on every page; Lenis intercepts
     wheel events and scrolls PROGRAMMATICALLY via window.scrollTo,
     which bypasses body overflow:hidden. So with just the overflow
     trick the background page kept scrolling under the modal.
     Fix: also tell Lenis to pause while the modal is open. The
     instance lives at `window.__lenis` (set up in BaseLayout). On
     close we resume so the rest of the page scrolls normally. */
  useEffect(() => {
    const lenis = (window as any).__lenis;
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      lenis?.stop?.();
    } else {
      document.body.style.overflow = '';
      lenis?.start?.();
    }
    return () => {
      document.body.style.overflow = '';
      lenis?.start?.();
    };
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
    try { sessionStorage.removeItem('getStartedQuoteV2'); } catch {}
    setIsOpen(false);
  }

  /* "Need something else?" on the confirmation takeover. The customer
     already gave us address + contact, and a lead+customer row is
     persisted server-side. We DON'T want to wipe their answers; we
     just want to send them back to the qualifier page so they can
     resubmit with different pool details / service interest. Clears
     lead-side state (id/token/quotePath) so createLead fires fresh on
     the next Continue — the existing customer row gets reused via the
     dedup "Is this you?" flow when phone/email match. */
  function handleNeedSomethingElse() {
    setLeadId(null);
    setLeadToken(null);
    // resume_token is per-lead — drop it so the next submit issues a
    // fresh one that authenticates against the new lead row.
    setResumeToken(null);
    try { sessionStorage.removeItem('resumeToken'); } catch {}
    setLeadError('');
    setQuoteSending(null);
    // Send slots are per-lead — fresh lead, fresh slots.
    setChannelsSent({ email: false, sms: false });
    // Clear the success flags for ALL flows so the takeover modal
    // exits and the user lands back on the qualifier page regardless
    // of which service they originally picked.
    setTicketSubmitted(false);
    setCommercialSubmitted(false);
    setTicketError('');
    setCommercialError('');
    updateForm({
      quotePath: '',
      contactPreference: '',
    });
    setShowDupCheck(false);
    setRedirect('');
    setCurrentStep(3);
  }

  /* ── Create lead in Supabase via edge function ── */
  /* ── Single submit ────────────────────────────────────────
     Called from handleContinue (end of qualifying page) and from the
     renderDupCheck Yes/No buttons. Posts the full payload to
     /api/leads/submit which runs server-side dedup + creates the customer,
     lead, child row, and service bodies in one transaction.

     Returns null if either:
       - dedup match found (state set to surface the "Is this you?" UI,
         caller doesn't advance)
       - error (leadError set, caller doesn't advance)
     Returns { id, token } on success — id and token are both the lead_id
     (preserved for compat with handleGetStartedNow's URL building).        */
  async function createLead(opts: {
    contactPref?: 'email' | 'text';
    customer_action?: 'use_existing' | 'create_new';
    existing_customer_id?: number;
    type_override?: 'residential_maintenance' | 'commercial_maintenance' | 'service_request';
    qualifying_override?: Record<string, unknown>;
  } = {}): Promise<{ id: string; token: string } | null> {
    if (leadId) return { id: leadId, token: leadToken! };
    setLeadSubmitting(true);
    setLeadError('');
    // If we already know this customer's account_id from an earlier
    // submit in the same session (e.g. they hit "Need something else?"
    // after sending themselves a quote), short-circuit the dedup round
    // trip by passing customer_action='use_existing' + that id. Without
    // this we'd just match ourselves on phone/email and force the user
    // through the "Is this you?" UI a second time for no reason.
    const resolvedCustomerAction = opts.customer_action
      ?? (accountId && !opts.existing_customer_id ? 'use_existing' : undefined);
    const resolvedExistingId = opts.existing_customer_id
      ?? (resolvedCustomerAction === 'use_existing' ? accountId ?? undefined : undefined);
    try {
      // Default qualifying payload (residential). The submitTicket and
      // submitCommercialLead paths pass their own type_override + qualifying.
      const leadType = opts.type_override ?? 'residential_maintenance';
      let qualifying: Record<string, unknown>;
      if (opts.qualifying_override) {
        qualifying = opts.qualifying_override;
      } else {
        // Residential — build from current formData
        const bodies: any[] = [];
        const st = formData.serviceType;
        const isInground = formData.isInground === 'inground' ? true
          : formData.isInground === 'above_ground' ? false : null;
        if (st === 'pool' || st === 'pool_spa_combo') {
          bodies.push({ body_type: 'pool', is_primary: true, is_inground: isInground });
        }
        if (st === 'spa') bodies.push({ body_type: 'spa', is_primary: true });
        if (st === 'pool_spa_combo') bodies.push({ body_type: 'spa', is_primary: false });
        if (formData.hasExtraBody) {
          bodies.push({ body_type: 'fountain', is_primary: bodies.length === 0 });
        }
        const poolCondition =
          formData.poolCondition === 'needs_repair' || formData.poolCondition === 'green_pool'
            ? formData.poolCondition
            : 'good';
        qualifying = {
          type: 'residential_maintenance',
          visits_per_week: formData.isBiweekly ? 0.5 : 1,
          pool_condition: poolCondition,
          issue_description: poolCondition !== 'good'
            ? (formData.leadContext || 'Customer reported issue via website')
            : undefined,
          contact_preference: opts.contactPref ?? formData.contactPreference,
          lead_context: formData.leadContext || undefined,
          bodies,
        };
      }

      const result = await apiSubmitLead({
        contact: {
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          email: formData.email.trim() || undefined,
          phone: formData.phone.trim() || undefined,
        },
        address: {
          street: formData.addressStreet || '',
          city: formData.addressCity || '',
          state: formData.addressState || 'GA',
          zip: formData.addressZip || '',
        },
        account_type: formData.customerType === 'commercial' ? 'commercial' : 'residential',
        qualifying,
        referral_source: formData.referralSource || undefined,
        customer_action: resolvedCustomerAction,
        existing_customer_id: resolvedExistingId,
        client: {
          user_agent: navigator.userAgent,
          referrer: document.referrer || undefined,
          utm: getUtmParams(),
        },
      });

      if (result.dedup_required) {
        const matches = result.matches ?? [];
        if (matches.length > 0) {
          const first = matches[0];
          setDupMatchName(first.display_name || `${first.first_name ?? ''} ${first.last_name?.charAt(0) ?? ''}.`);
          setDupMatchPhone(first.redacted_phone || '');
          setDupMatchEmail(first.redacted_email || '');
          setDupMatchCustomerId(first.customer_id);
          setShowDupCheck(true);
        }
        return null;
      }

      if (!result.ok || !result.data) {
        const msg = result.error || 'Something went wrong. Please try again or call us.';
        // Out-of-area gets a friendlier message.
        if (result.error === 'out_of_service_area') {
          setLeadError("We don't currently service that zip code. Please call us at (912) 459-0160 — we'd still love to help.");
        } else {
          setLeadError(msg);
        }
        return null;
      }

      const leadIdStr = result.data.lead_id;
      const token = leadIdStr; // onboarding page reuses lead_id as its URL token
      setLeadId(leadIdStr);
      setLeadToken(token);
      // Remember the customer/account id so "Need something else?" can
      // resubmit a NEW lead under the SAME customer without re-running
      // dedup (we'd just match ourselves on phone/email).
      if (typeof result.data.account_id === 'number') {
        setAccountId(result.data.account_id);
        try { sessionStorage.setItem('accountId', String(result.data.account_id)); } catch {}
      }
      // Stash the server-issued resume_token as a cookie fallback —
      // see resumeToken state declaration for why.
      if (typeof result.data.resume_token === 'string' && result.data.resume_token) {
        setResumeToken(result.data.resume_token);
        try { sessionStorage.setItem('resumeToken', result.data.resume_token); } catch {}
      }
      try { sessionStorage.setItem('leadId', leadIdStr); } catch {}
      try { sessionStorage.setItem('leadToken', token); } catch {}
      return { id: leadIdStr, token };
    } catch (e: any) {
      console.error('createLead error:', e);
      setLeadError(e.message || 'Something went wrong. Please try again or call us.');
      return null;
    } finally {
      setLeadSubmitting(false);
    }
  }

  /* ── "Get Started Now" → flip child status to 'accepted' + redirect ──
     Lead already exists at this point (created on qualifying-page Continue).
     The Accept call validates the cookie's resume_token and updates the
     child row's status. Then we redirect to /get-started for the onboarding
     flow (payment + scheduling). */
  async function handleGetStartedNow() {
    if (!leadId) {
      setLeadError("Something went wrong — please refresh and try again.");
      return;
    }
    setLeadSubmitting(true);
    setLeadError('');
    try {
      const result = await apiAcceptLead(leadId, resumeToken);
      if (!result.ok) {
        setLeadError(result.error || "Couldn't accept the quote. Please try again or call us.");
        return;
      }
      // Save quote data so the onboarding page can read it
      try {
        sessionStorage.setItem('getStartedOnboarding', JSON.stringify({
          ...formData,
          quotedPerVisit: price.perVisit,
          quotedMonthly: price.monthly,
          visitsPerMonth: price.visitsPerMonth,
          leadId,
          resumeToken: leadToken,
        }));
      } catch {}
      window.location.href = assetPath(`get-started/?token=${leadToken ?? leadId}`);
    } finally {
      setLeadSubmitting(false);
    }
  }

  /* ── "Email Quote" / "Text Quote" → just fire the send-quote endpoint ──
     The lead already exists (created on qualifying-page Continue). These
     buttons just trigger comms. Both can fire — they're tracked
     independently in the communications table, and the first successful
     send enrolls the lead in the quote_followup drip campaign. */
  async function handleQuoteSend(channel: 'email' | 'sms') {
    if (!leadId) {
      setLeadError("Something went wrong — please refresh and try again.");
      return;
    }
    // Each channel fires at most once — re-clicks while in flight or
    // after a successful send are ignored. Failed sends keep the slot
    // open so the user can retry.
    if (channelsSent[channel] || quoteSending) return;
    const contactPref = channel === 'email' ? 'email' : 'text';
    /* quotePath is locked to the FIRST channel the customer chose so
       the confirmation pill keeps reading "Check your email" (or text)
       even after they fire the OTHER channel as a secondary action.
       Without this guard, sending the second channel flips the pill,
       which is jarring. */
    const isFirstSend = !formData.quotePath;
    setQuoteSending(channel);
    setLeadError('');
    try {
      const result = await apiSendQuote(leadId, channel, resumeToken);
      if (!result.ok) {
        setLeadError(
          channel === 'email'
            ? "We saved your info but couldn't send the email. We'll follow up by phone."
            : "We saved your info but couldn't send the text. We'll follow up by phone.",
        );
        return;
      }
      setChannelsSent(prev => ({ ...prev, [channel]: true }));
      if (isFirstSend) {
        updateForm({
          quotePath: channel === 'email' ? 'email' : 'text',
          contactPreference: contactPref,
        });
      }
    } catch (e: any) {
      console.error('send-quote network error:', e);
      setLeadError("We saved your info but couldn't send the quote. We'll follow up by phone.");
    } finally {
      setQuoteSending(null);
    }
  }

  function updateTicketQualifier(type: TicketType, questionId: string, optionId: string) {
    const currentAnswer = ticketQualifiers[type][questionId];
    const nextAnswer = currentAnswer === optionId ? '' : optionId;
    const nextTypeAnswers = { ...ticketQualifiers[type], [questionId]: nextAnswer };
    const allQualifierQuestionsAnswered = TICKET_QUALIFIER_CONFIG[type].questions.every(question => !!nextTypeAnswers[question.id]);

    setTicketQualifiers(prev => {
      return {
        ...prev,
        [type]: {
          ...prev[type],
          [questionId]: nextAnswer,
        },
      };
    });

    if (nextAnswer && allQualifierQuestionsAnswered) {
      window.setTimeout(() => {
        const modal = document.querySelector('.intake-overlay.is-open');
        const advanceButton = Array.from(modal?.querySelectorAll<HTMLButtonElement>('button[data-intake-advance]') || [])
          .find(button => !button.disabled && button.offsetParent !== null);
        advanceButton?.focus();
      }, 30);
    }
  }

  function buildTicketDescription(type: TicketType) {
    const answers = ticketQualifiers[type];
    const lines: string[] = [];
    // Property type + commercial property name lead the description
    // so the dispatcher sees them first.
    if (formData.customerType) {
      const ctLabel = CUSTOMER_TYPES.find(c => c.id === formData.customerType)?.label || formData.customerType;
      lines.push(`Property type: ${ctLabel}`);
    }
    if (formData.customerType === 'commercial' && commercialForm.companyName.trim()) {
      lines.push(`Property name: ${commercialForm.companyName.trim()}`);
    }
    const qualifierLines = TICKET_QUALIFIER_CONFIG[type].questions
      .map(question => {
        const selected = question.options.find(option => option.id === answers[question.id]);
        return selected ? `${question.label}: ${selected.label}` : null;
      })
      .filter((line): line is string => Boolean(line));
    lines.push(...qualifierLines);
    const notes = ticketDescription.trim();
    if (notes) lines.push(`Additional details: ${notes}`);
    return lines.length
      ? lines.join('\n')
      : 'Customer requested a call back through the website quote form.';
  }

  /* ── P2-2: Submit ticket (equipment / green pool / renovation) ── */
  async function submitTicket(type: TicketType) {
    setTicketError('');
    /* Contact info now comes from the main formData (collected in
       Step 2) — we no longer ask for it again on the ticket form.
       The user has already gone through Address → Contact → Service
       by the time they reach this submission, so this form only adds
       a few optional qualifiers for dispatch context. */
    const contact = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      email: formData.email,
    };
    if (!contact.firstName.trim() || !contact.phone.replace(/\D/g, '').length) {
      setTicketError('Contact info is missing. Go back and edit it from the summary.');
      return;
    }
    setTicketSubmitting(true);
    try {
      const description = buildTicketDescription(type);
      const kindMap: Record<TicketType, string> = {
        green_pool: 'green_pool',
        renovation: 'renovation',
        equipment: 'service',
      };
      // Single submit. The submit_website_lead RPC handles service_request
      // by closing the lead immediately with closed_reason='ticketed' and
      // stashing details in leads.metadata.service_request. The Airtable
      // ticket fires from the /api/leads/submit endpoint as a side effect.
      const lead = await createLead({
        type_override: 'service_request',
        qualifying_override: {
          type: 'service_request',
          kind: kindMap[type],
          issue_description: description,
          pool_condition: type === 'green_pool' ? 'green_pool' : 'needs_repair',
        },
      });
      if (!lead) {
        // dedup_required or error — leadError set by createLead
        if (!showDupCheck) {
          setTicketError(leadError || 'Something went wrong. Please try again or call us.');
        }
        return;
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
      const lead = await createLead({
        type_override: 'commercial_maintenance',
        qualifying_override: {
          type: 'commercial_maintenance',
          company_name: commercialForm.companyName.trim(),
          closes_for_winter: commercialForm.closesForWinter ?? undefined,
          summer_frequency: commercialForm.summerFrequency,
          winter_frequency: commercialForm.closesForWinter ? commercialForm.winterFrequency : undefined,
          property_manager_name: commercialForm.pmName.trim() || undefined,
          property_manager_phone: commercialForm.pmName.trim() ? (commercialForm.pmPhone.trim() || undefined) : undefined,
          property_manager_email: commercialForm.pmName.trim() ? (commercialForm.pmEmail.trim() || undefined) : undefined,
          commercial_description: commercialForm.commercialDescription.trim() || undefined,
        },
      });
      if (!lead) {
        if (!showDupCheck) {
          setCommercialError(leadError || 'Something went wrong. Please try again or call us.');
        }
        return;
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
    setTicketQualifiers(createEmptyTicketQualifiers());
    setTicketError('');
    setTicketContact({ firstName: '', lastName: '', phone: '', email: '' });
    setRedirect('');
    setRedirectLoading('');
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
  // Once the user has fired off Email Quote or Text Quote, we replace the
  // entire modal contents with a confirmation takeover — no progress bar,
  // no summary rail, no edit affordances. They can only close out or click
  // Get Started Now (or fire the OTHER channel they didn't pick).
  /* Confirmation modal trigger + which variant.
     ConfirmationModal (src/components/lead-flow/ConfirmationModal.tsx)
     owns the JSX + per-service copy. We just derive which kind to show
     based on the flow state and pass props. */
  const isQuoteSent = formData.quotePath === 'email' || formData.quotePath === 'text';
  const sentBodyOpt = SERVICE_BODY_OPTIONS.find(o => o.id === formData.serviceType);
  const sentPlanLabel = sentBodyOpt?.label ?? 'Pool Only';
  const sentCycleLabel = formData.isBiweekly ? 'Bi-Weekly' : 'Weekly';
  const confirmKind: ConfirmKind | null = isQuoteSent
    ? 'quote'
    : commercialSubmitted
      ? 'commercial'
      : ticketSubmitted && (redirect === 'green_pool' || redirect === 'equipment' || redirect === 'renovation')
        ? (redirect as 'green_pool' | 'equipment' | 'renovation')
        : null;
  const isFlowComplete = confirmKind !== null;

  /* ═══════════════════════════════════════
     RENDER
     ═══════════════════════════════════════ */

  /* When the flow is complete, render the standalone ConfirmationModal
     (it owns its own overlay + backdrop). Skip the in-progress modal
     entirely. */
  if (isFlowComplete && confirmKind) {
    const otherChannel: 'email' | 'sms' = formData.quotePath === 'email' ? 'sms' : 'email';
    return (
      <ConfirmationModal
        kind={confirmKind}
        initialChannel={
          formData.quotePath === 'email' ? 'email'
          : formData.quotePath === 'text' ? 'text'
          : undefined
        }
        quote={confirmKind === 'quote' ? {
          planLabel: sentPlanLabel,
          cycleLabel: sentCycleLabel,
          visitsPerMonth: price.visitsPerMonth,
          perVisit: price.perVisit,
          monthly: price.monthly,
          addressLine: formData.addressStreet
            ? [formData.addressStreet, formData.addressCity].filter(Boolean).join(', ')
            : undefined,
        } : undefined}
        channelsSent={channelsSent}
        sendingChannel={quoteSending}
        onGetStartedNow={handleGetStartedNow}
        getStartedLoading={leadSubmitting}
        onAlsoSend={(ch) => handleQuoteSend(ch)}
        onNeedSomethingElse={handleNeedSomethingElse}
        onClose={handleClose}
        error={leadError || undefined}
      />
    );
  }

  return (
    <div class={`intake-overlay is-open${currentStep === 5 ? ' intake-overlay--quote' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }} role="dialog" aria-modal="true" aria-label="Get a quote">
      {TURNSTILE_SITE_KEY ? (
        <div
          class="cf-turnstile"
          data-sitekey={TURNSTILE_SITE_KEY}
          data-callback="ppTurnstileCallback"
          data-expired-callback="ppTurnstileExpired"
          data-size="invisible"
          style="position: absolute; left: -9999px;"
        />
      ) : null}
      <div class={`intake-modal intake-modal--v2${currentStep === 5 ? ' intake-modal--quote' : ''}`}>
        {/* Persistent hero — visible on every step. The new artwork
            already has the dark navy background with the
            pool/house/truck composition baked in on the right side,
            so the whole thing is a background-image and the title
            sits over the dark left half (white, vertically centered,
            left-aligned with comfortable padding). */}
        <div
          class="intake-hero"
          style={`background-image: url(${assetPath('images/quote-modal-hero.png')})`}
        >
          <div class="intake-hero__bar">
            <div class="intake-hero__brand">
              <img
                class="intake-hero__logo"
                src={assetPath('images/perfect-pools-logo.png')}
                alt="Perfect Pools"
              />
              <div class="intake-hero__divider" />
              <div class="intake-hero__brand-text">
                <strong>PERFECT POOLS</strong>
                <span>Get Your Quote</span>
              </div>
            </div>
            <button class="intake-hero__close" onClick={handleClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="intake-hero__body">
            <h2 class="intake-hero__title">We're on the way!</h2>
          </div>
        </div>

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

        {/* Live summary — only after the user is past the address page.
            Address is rendered as a distinct "green pin" chip at the top
            of the rail; everything else uses the generic chip style.
            Hidden while the user is in a stage that renders its OWN
            consolidated summary card at the top of the body:
              - Non-maintenance ticket-form redirects
                (green_pool / equipment / renovation)
              - Maintenance quote view (currentStep === 5)
            In both cases the consolidated card already shows service +
            address + contact — we don't want the same info twice. */}
        {currentStep > 1 && formData.addressStreet && currentStep !== 5 && !['green_pool', 'equipment', 'renovation', 'commercial'].includes(redirect) && (() => {
          // Each row is its own SECTION — its edit pencil jumps back to
          // the page that owns those answers, not always to step 1.
          // Rows render in flow order (address, contact, service, …)
          // and only appear once the user has advanced PAST that section.
          const fullAddress = [
            formData.addressStreet,
            formData.addressCity,
            formData.addressState,
            formData.addressZip,
          ].filter(Boolean).join(', ').replace(/, ([A-Z]{2}), /, ', $1 ');
          const fullName = `${formData.firstName} ${formData.lastName}`.trim();
          const contactBits = [fullName, formData.email, formData.phone].filter(Boolean);
          const svc = formData.serviceInterest
            ? SERVICE_TYPES.find(s => s.id === formData.serviceInterest)
            : null;
          const ct = formData.customerType
            ? CUSTOMER_TYPES.find(c => c.id === formData.customerType)
            : null;
          const pt = formData.isInground
            ? POOL_TYPE_OPTIONS.find(p => p.id === formData.isInground)
            : null;
          const pc = formData.poolCondition
            ? POOL_CONDITIONS.find(p => p.id === formData.poolCondition)
            : null;
          const sb = formData.serviceType && formData.serviceType !== 'pool'
            ? SERVICE_BODY_OPTIONS.find(s => s.id === formData.serviceType)
            : null;

          const editIcon = (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
          );

          return (
            <div class="gs-summary">
              {/* Address — green pin, distinct from the rest */}
              <div class="gs-summary__row gs-summary__row--address">
                <span class="gs-summary__pin" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </span>
                <span class="gs-summary__row-text">{fullAddress}</span>
                <button type="button" class="gs-summary__edit" onClick={() => setCurrentStep(1)} aria-label="Edit address" title="Edit address">{editIcon}</button>
              </div>

              {/* Contact — each piece (name, phone, email) renders
                  with its own inline glyph so it reads like a small
                  contact card rather than one dense bullet-joined
                  string. Wraps to a new line at narrow widths. */}
              {currentStep > 2 && contactBits.length > 0 && (
                <div class="gs-summary__row gs-summary__row--contact">
                  <div class="gs-summary__contact-pieces">
                    {fullName && (
                      <span class="gs-summary__contact-piece">
                        <span class="gs-summary__icon gs-summary__icon--inline" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                        </span>
                        <span>{fullName}</span>
                      </span>
                    )}
                    {formData.phone && (
                      <span class="gs-summary__contact-piece">
                        <span class="gs-summary__icon gs-summary__icon--inline" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                          </svg>
                        </span>
                        <span>{formData.phone}</span>
                      </span>
                    )}
                    {formData.email && (
                      <span class="gs-summary__contact-piece">
                        <span class="gs-summary__icon gs-summary__icon--inline" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                        </span>
                        <span>{formData.email}</span>
                      </span>
                    )}
                  </div>
                  <button type="button" class="gs-summary__edit" onClick={() => setCurrentStep(2)} aria-label="Edit contact info" title="Edit contact info">{editIcon}</button>
                </div>
              )}

              {/* Pool Info — all the answers from the progressive page
                  collapse into one row once the user has advanced past it. */}
              {currentStep > 3 && (svc || ct || pt || pc || sb) && (() => {
                const poolBits = [
                  svc?.label,
                  ct?.label,
                  pt?.label,
                  pc?.label,
                  sb?.label,
                ].filter(Boolean);
                return (
                  <div class="gs-summary__row">
                    <span class="gs-summary__icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <ellipse cx="12" cy="15" rx="9" ry="3"/>
                        <path d="M3 15v3c0 1.66 4 3 9 3s9-1.34 9-3v-3"/>
                      </svg>
                    </span>
                    <span class="gs-summary__row-text">{poolBits.join(' · ')}</span>
                    <button type="button" class="gs-summary__edit" onClick={() => { setRedirect(''); setCurrentStep(3); }} aria-label="Edit pool info" title="Edit pool info">{editIcon}</button>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Step content. Flow: Address → Contact (with dup check) →
            Pool questions (progressive: service, property, pool type,
            condition, body type all on one page) → Referral → Quote. */}
        <div class={`intake-body gs-fade-in${currentStep === 5 ? ' intake-body--quote' : ''}`} key={currentStep + '-' + redirect + (showDupCheck ? '-dup' : '')}>
          {currentStep === 1 && renderStep2()}
          {currentStep === 2 && renderStep3()}
          {currentStep === 3 && (showDupCheck ? renderDupCheck() : renderProgressivePoolPage())}
          {currentStep === 4 && renderReferralSource()}
          {currentStep === 5 && renderQuoteDisplay()}
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
      return renderRenovationRedirect();
    }

    const icons: Record<string, any> = {
      /* Same icon swap as in serviceIcons below. */
      waves: <img src={`${basePath}images/icon-recurring-maintenance.svg`} alt="" width="34" height="34" />,
      /* Same icon swap as in serviceIcons below — illustrated pool
         art instead of a stroked-leaf SVG. */
      leaf: <img src={`${basePath}images/icon-green-pool.png`} alt="" width="34" height="34" />,
      wrench: <img src={`${basePath}images/icon-equipment.svg`} alt="" width="34" height="34" />,
      hammer: <img src={`${basePath}images/icon-renovation.png`} alt="" width="34" height="34" />,
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
          {/* Service Address field removed in V2 — address is now shown
              in the green-pin summary band above the form, with an edit
              pencil that returns the user to the address page. */}
        </div>
        <div class="intake-actions" style="margin-top: 1.5rem;">
          {/* No DB writes happen here in the new flow — submit fires at the
              end of the qualifying page, after all data is collected. The
              contact step just advances. */}
          <button type="button" class="intake-cta-btn" data-intake-advance disabled={!isValid} onClick={goNext}>
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
          <div class="gs-existing-match" style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: var(--primary-light, #f0f7ff); border-radius: 0.75rem;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #2563eb)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <strong style="display: block; font-size: 1rem;">{dupMatchName || `${formData.firstName} ${formData.lastName.charAt(0)}.`}</strong>
              {dupMatchPhone && <span style="display: block; font-size: 0.85rem; color: var(--text-light);">Phone: {dupMatchPhone}</span>}
              {dupMatchEmail && <span style="display: block; font-size: 0.85rem; color: var(--text-light);">Email: {dupMatchEmail}</span>}
            </div>
          </div>
          <p style="text-align: center; font-weight: 500; margin: 1rem 0 0.75rem;">Is this you?</p>
          <div class="gs-existing-choices">
            <button type="button" class="intake-cta-btn" disabled={leadSubmitting} onClick={async () => {
              updateForm({ duplicateResolution: 'confirmed_yes' });
              setShowDupCheck(false);
              setRedirectLoading('quote');
              const lead = await createLead({
                customer_action: 'use_existing',
                existing_customer_id: dupMatchCustomerId ?? undefined,
              });
              setRedirectLoading('');
              if (lead) setCurrentStep(5);
            }}>{leadSubmitting ? 'Saving...' : "Yes, that's me"}</button>
            <button type="button" class="intake-outline-btn" disabled={leadSubmitting} onClick={async () => {
              updateForm({ duplicateResolution: 'confirmed_no' });
              setShowDupCheck(false);
              setRedirectLoading('quote');
              const lead = await createLead({ customer_action: 'create_new' });
              setRedirectLoading('');
              if (lead) setCurrentStep(5);
            }}>{leadSubmitting ? 'Saving...' : "No, I'm a new customer"}</button>
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
  function renderReferralSource() {
    const icons: Record<string, any> = {
      search: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
      share: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
      truck: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
      users: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      newspaper: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><line x1="10" y1="6" x2="18" y2="6"/><line x1="10" y1="10" x2="18" y2="10"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
      more: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
    };
    return (
      <>
        <div class="intake-step-header">
          <div class="intake-step-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <h2 class="intake-step-title">How did you hear about us?</h2>
          <p class="intake-step-subtitle">This helps us serve the community better</p>
        </div>
        <div class="intake-surface-list">
          {REFERRAL_SOURCES.map(rs => (
            <button key={rs.id} type="button" class={`intake-surface-item${formData.referralSource === rs.id ? ' selected' : ''}`} onClick={() => {
              updateForm({ referralSource: rs.id });
              setTimeout(() => goNext(), 300);
            }}>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="color: var(--color-primary); flex-shrink: 0;">{icons[rs.icon]}</div>
                <h3>{rs.label}</h3>
              </div>
              <div class="intake-surface-radio" />
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
              <div class="intake-choice-icon">
                <img src={`${basePath}images/${pc.id === 'good' ? 'icon-pool-maintenance.svg' : 'icon-leaking.svg'}`} alt={pc.label} width="56" height="56" style="object-fit: contain;" />
              </div>
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
            <button key={opt.id} type="button" class={`gs-body-card${formData.serviceTypeTouched && formData.serviceType === opt.id ? ' selected' : ''}`} onClick={() => updateForm({ serviceType: opt.id, serviceTypeTouched: true })}>
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
          <button type="button" class="intake-cta-btn" data-intake-advance disabled={!formData.serviceTypeTouched || !formData.serviceType} onClick={goNext}>
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
     Progressive Pool Questions Page
     One page that renders all the post-contact pool questions with
     each next question revealed only after the prior selection is
     made. Out-of-flow branches (commercial, above-ground, repair-
     first, green pool, equipment, renovation) yield to their own
     redirect screens. The user can change any selection at any time;
     the rest of the questions stay visible.
     ══════════════════════════════════ */
  function renderProgressivePoolPage() {
    /* Loading state takes precedence: if the user just clicked a
       non-maintenance service we hold a brief logo-spin screen
       before the redirect content paints. */
    if (redirectLoading) return renderRedirectLoading();
    if (redirect === 'green_pool') return renderGreenPoolRedirect();
    if (redirect === 'equipment') return renderEquipmentRedirect();
    if (redirect === 'commercial') return renderCommercialForm();
    if (redirect === 'renovation') return renderRenovationRedirect();
    if (redirect === 'above_ground') return renderRedirectScreen(
      'We Appreciate Your Interest!',
      'Unfortunately, we only service in-ground pools at this time.',
      [
        { text: 'We can recommend above-ground specialists', detail: 'In your area' },
        { text: 'Considering converting to in-ground?', detail: 'We can help with that!' },
      ],
      '/services/',
      'Try Different Pool Type'
    );
    if (redirect === 'needs_repair') return renderRedirectScreen(
      'Let\'s Get Your Pool Fixed First',
      'We recommend getting any issues resolved before starting weekly maintenance.',
      [
        { text: '$150 residential service call', detail: '$185 for commercial' },
        { text: 'Most repairs completed same day', detail: 'Then we can start maintenance' },
      ],
      '/services/pool-equipment-repair/',
      'View Repair Services'
    );

    const onMaintenance = formData.serviceInterest === 'maintenance';
    const selectedTicketType = isTicketType(formData.serviceInterest) ? formData.serviceInterest : null;
    const ticketQualifierQuestions = selectedTicketType ? TICKET_QUALIFIER_CONFIG[selectedTicketType].questions : [];
    const ticketQualifiersAnswered = selectedTicketType
      ? ticketQualifierQuestions.every(question => !!ticketQualifiers[selectedTicketType][question.id])
      : false;
    const onCommercialMaintenance = onMaintenance && formData.customerType === 'commercial';
    // Non-maintenance commercial — equipment/green-pool/renovation
    // tickets for a commercial property. We surface a single extra
    // qualifier (property name) before the existing ticket questions.
    const onCommercialTicket = !!selectedTicketType && formData.customerType === 'commercial';
    const commercialFrequencyAnswered = commercialForm.closesForWinter !== null;
    const commercialCompanyAnswered = !!commercialForm.companyName.trim();
    // Reveal each follow-up after the prior is answered, regardless of
    // WHAT they answered. Filtering for out-of-service answers
    // (commercial, above-ground, needs-repair) happens on Continue, not
    // on selection — so the user can change any selection without being
    // hard-redirected mid-flow.
    // Property type now shows for EVERY service interest, not just
    // maintenance. For ticket flows (equipment/green-pool/renovation)
    // it gates the ticket qualifier questions below.
    const showProperty = !!formData.serviceInterest;
    const showCommercialFrequency = onCommercialMaintenance;
    const showCommercialCompany = showCommercialFrequency && commercialFrequencyAnswered;
    // For non-maintenance commercial, the company-name field is the
    // single extra qualifier we add — shown right after property type
    // and before the ticket qualifier questions.
    const showTicketPropertyName = onCommercialTicket;
    const ticketPropertyNameAnswered = !showTicketPropertyName || commercialCompanyAnswered;
    const showTicketQualifiers = !!selectedTicketType && !!formData.customerType && ticketPropertyNameAnswered;
    const showPoolType = showProperty && !!formData.customerType && !onCommercialMaintenance && onMaintenance;
    const showCondition = showPoolType && !!formData.isInground;
    const showBody = showCondition && !!formData.poolCondition;
    const allAnswered = onCommercialMaintenance
      ? commercialFrequencyAnswered && commercialCompanyAnswered
      : onMaintenance
      ? !!(showBody && formData.serviceTypeTouched && formData.serviceType)
      : !!(
          selectedTicketType
          && !!formData.customerType
          && ticketPropertyNameAnswered
          && ticketQualifiersAnswered
        );

    // Continue handler: check the deferred filters in order. If any
    // applies, swap to the corresponding redirect/sorry screen instead
    // of advancing to the next step.
    // Happy path (in-flow maintenance) flows: progressive → loader
    // → quote. Skip the old step-4 referral source for now — same
    // pattern as the non-maintenance routes use to transition into
    // their ticket-form view. The loader holds for 750ms, then we
    // jump straight to step 5 (renderQuoteDisplay), which now shows
    // a consolidated summary card on top.
    const handleContinue = async () => {
      if (selectedTicketType) {
        setRedirectLoading(selectedTicketType);
        window.setTimeout(() => {
          setRedirect(selectedTicketType);
          setRedirectLoading('');
        }, 750);
        return;
      }
      if (onCommercialMaintenance) { setRedirect('commercial'); return; }
      if (formData.isInground === 'above_ground') { setRedirect('above_ground'); return; }
      if (formData.poolCondition === 'needs_repair') { setRedirect('needs_repair'); return; }

      // Happy path → loader → submit lead → quote.
      // This is the moment of lead creation in the new flow. createLead
      // runs server-side dedup; if matches found it sets showDupCheck=true
      // and returns null (renderDupCheck takes over). If success, we
      // advance to step 5 (renderQuoteDisplay).
      setRedirectLoading('quote');
      const lead = await createLead();
      setRedirectLoading('');
      if (!lead) {
        // Either dedup_required (renderDupCheck will show) or error
        // (leadError displayed). Either way, stay on current step.
        return;
      }
      setCurrentStep(5);
    };

    const serviceIcons: Record<string, any> = {
      /* Recurring-maintenance icon: illustrated in-ground pool
         (clipboard + checklist + sparkling pool art) provided by
         the user. Loaded as a file, not inlined — the source SVG
         is ~27KB of gradients which is heavy as JSX. */
      waves: <img src={`${basePath}images/icon-recurring-maintenance.svg`} alt="" width="34" height="34" />,
      /* Green-pool icon switched from a generic stroked leaf SVG
         to the full-color illustrated icon (pool with ladder + life
         ring) — same artwork the user picked for this slot. PNG
         instead of inline SVG so the colors come through as
         designed; image-rendering rules in CSS handle the downscale. */
      leaf: <img src={`${basePath}images/icon-green-pool.png`} alt="" width="34" height="34" />,
      /* Equipment-issue icon: illustrated pool filter art provided
         by the user. */
      wrench: <img src={`${basePath}images/icon-equipment.svg`} alt="" width="34" height="34" />,
      /* Renovation icon: crossed wrench + hammer (flat illustrated)
         provided by the user. */
      hammer: <img src={`${basePath}images/icon-renovation.png`} alt="" width="34" height="34" />,
    };

    const infoIcon = (text: string) => (
      <span class="psf-q__info" tabIndex={0} aria-label={text} data-tooltip={text}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </span>
    );

    return (
      <div class="psf-progressive">
        {/* Q1: Service interest — always visible */}
        <div class="psf-q">
          <h3 class="psf-q__label">
            What can we help you with?
            {infoIcon("Select the service you're interested in")}
          </h3>
          <div class="gs-service-grid">
            {SERVICE_TYPES.map(svc => (
              <div class="psf-service-cell" key={svc.id}>
                <button
                  type="button"
                  class={`gs-service-card${formData.serviceInterest === svc.id ? ' selected' : ''}`}
                  onClick={() => {
                    updateForm({ serviceInterest: svc.id });
                    setRedirect('');
                    setRedirectLoading('');
                  }}
                  aria-label={svc.label}
                >
                  <div class="gs-service-card-icon">{serviceIcons[svc.icon]}</div>
                </button>
                <div class="psf-service-label">{svc.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Q2: Property type — now shown for EVERY service interest.
            For ticket flows (equipment/green-pool/renovation) it gates
            the qualifier questions below; for maintenance it gates the
            commercial-frequency or residential-pool branches as before. */}
        {showProperty && (
          <div class="psf-q">
            <h3 class="psf-q__label">
              What type of property?
              {infoIcon('This helps us provide the right service level')}
            </h3>
            <div class="intake-choice-grid">
              {CUSTOMER_TYPES.map(ct => (
                <button
                  key={ct.id}
                  type="button"
                  class={`intake-choice${formData.customerType === ct.id ? ' selected' : ''}`}
                  onClick={() => updateForm({ customerType: ct.id })}
                >
                  <div class="intake-choice-icon intake-choice-icon--emoji">{ct.id === 'residential' ? '🏠' : '🏢'}</div>
                  <h3>{ct.label}</h3>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* NEW: Commercial property name — single extra qualifier for
            non-maintenance commercial tickets (equipment / green-pool /
            renovation). Reuses commercialForm.companyName so the same
            field name flows through to the ticket description. */}
        {showTicketPropertyName && (
          <div class="psf-q">
            <h3 class="psf-q__label">
              What is the company or facility name?
              {infoIcon('This helps us prepare the dispatch record')}
            </h3>
            <div class="intake-field" style="margin-bottom: 0;">
              <input
                type="text"
                class="intake-input"
                value={commercialForm.companyName}
                onInput={(e: any) => setCommercialForm(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="e.g. Oceanview HOA, Hampton Inn Savannah"
              />
            </div>
          </div>
        )}

        {/* Ticket qualifier questions — for equipment / green-pool /
            renovation. Gated on property type being selected (and, for
            commercial, property name being filled). */}
        {showTicketQualifiers && ticketQualifierQuestions.map((question, index) => {
          const previousQuestion = ticketQualifierQuestions[index - 1];
          const shouldShow = index === 0 || !!ticketQualifiers[selectedTicketType][previousQuestion.id];
          if (!shouldShow) return null;

          return (
            <div class="psf-q psf-q--ticket-qualifier" key={`${selectedTicketType}-${question.id}`}>
              <h3 class="psf-q__label">{question.label}</h3>
              {renderTicketQualifierQuestion(selectedTicketType, question)}
            </div>
          );
        })}

        {/* Commercial Q3: service frequency */}
        {showCommercialFrequency && (
          <div class="psf-q">
            <h3 class="psf-q__label">
              How often does this pool need service?
              {infoIcon('2x per week is the minimum for commercial pools')}
            </h3>
            <div class="intake-choice-grid">
              {COMMERCIAL_FREQUENCY_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  class={`intake-choice${commercialForm.closesForWinter === false && commercialForm.summerFrequency === option.value ? ' selected' : ''}`}
                  onClick={() => {
                    setCommercialForm(prev => ({ ...prev, closesForWinter: false, summerFrequency: option.value, winterFrequency: option.value }));
                    window.setTimeout(() => {
                      const input = document.querySelector<HTMLInputElement>('[data-commercial-company-input]');
                      input?.focus();
                    }, 80);
                  }}
                >
                  <h3>{option.label}</h3>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Commercial Q4: company / facility name */}
        {showCommercialCompany && (
          <div class="psf-q">
            <h3 class="psf-q__label">
              What is the company or facility name?
              {infoIcon('This helps us prepare the commercial quote record')}
            </h3>
            <div class="intake-field" style="margin-bottom: 0;">
              <input
                data-commercial-company-input
                type="text"
                class="intake-input"
                value={commercialForm.companyName}
                onInput={(e: any) => setCommercialForm(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="e.g. Oceanview HOA, Hampton Inn Savannah"
              />
            </div>
          </div>
        )}

        {/* Q3: Pool type (in-ground / above-ground) */}
        {showPoolType && (
          <div class="psf-q">
            <h3 class="psf-q__label">
              In-ground or above-ground?
              {infoIcon('We currently service in-ground pools')}
            </h3>
            <div class="intake-choice-grid">
              {POOL_TYPE_OPTIONS.map(pt => (
                <button
                  key={pt.id}
                  type="button"
                  class={`intake-choice${formData.isInground === pt.id ? ' selected' : ''}`}
                  onClick={() => updateForm({ isInground: pt.id })}
                >
                  <div class="intake-choice-icon intake-choice-icon--emoji">{pt.id === 'inground' ? '🏊' : '🟦'}</div>
                  <h3>{pt.label}</h3>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Q4: Pool condition */}
        {showCondition && (
          <div class="psf-q">
            <h3 class="psf-q__label">
              What's the pool's current condition?
              {infoIcon('We want to make sure your pool is ready for maintenance')}
            </h3>
            <div class="intake-choice-grid">
              {POOL_CONDITIONS.map(pc => (
                <button
                  key={pc.id}
                  type="button"
                  class={`intake-choice${formData.poolCondition === pc.id ? ' selected' : ''}`}
                  onClick={() => updateForm({ poolCondition: pc.id })}
                >
                  <div class="intake-choice-icon intake-choice-icon--emoji">{pc.id === 'good' ? '✅' : '🛠️'}</div>
                  <h3>{pc.label}</h3>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Q5: Body type — required so the user explicitly chooses
            pool, spa, or pool+spa combo before the quote unlocks. */}
        {showBody && (
          <div class="psf-q">
            <h3 class="psf-q__label">
              What are we maintaining?
              {infoIcon('Pool, spa, or both — pricing adjusts accordingly')}
            </h3>
            <div class="intake-choice-grid intake-choice-grid--3">
              {SERVICE_BODY_OPTIONS.map(sb => (
                <button
                  key={sb.id}
                  type="button"
                  class={`intake-choice${formData.serviceTypeTouched && formData.serviceType === sb.id ? ' selected' : ''}`}
                  onClick={() => updateForm({ serviceType: sb.id, serviceTypeTouched: true })}
                >
                  <div class="intake-choice-icon intake-choice-icon--emoji">{sb.id === 'pool' ? '🏊' : sb.id === 'spa' ? '♨️' : '🌊'}</div>
                  <h3>{sb.label}</h3>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Continue button — only after all relevant questions answered */}
        {allAnswered && (
          <div class="intake-actions" style="margin-top: 1.5rem;">
            <button type="button" class="intake-cta-btn" data-intake-advance disabled={leadSubmitting} onClick={handleContinue}>
              {leadSubmitting ? 'Submitting…' : 'Continue'}
              {!leadSubmitting && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              )}
            </button>
            {/* Surface createLead failures inline. Without this the user
                clicks Continue, the API errors, and they're left staring
                at the same page with no feedback — looks like a glitch. */}
            {leadError && (
              <p style="color: #dc2626; font-size: 0.85rem; margin-top: 0.75rem;">{leadError}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════
     Final Step — Quote Display + Decision
     ══════════════════════════════════ */
  function renderQuoteDisplay() {
    /* Note: when quotePath is 'email' or 'text', the modal-level
       conditional renders the confirmation takeover instead — this
       function never sees that state. */

    /* Build the chip list for the consolidated summary card. We
       pull each pool detail from formData and look up its display
       label in the same constants used by the progressive page. */
    const ct = formData.customerType ? CUSTOMER_TYPES.find(c => c.id === formData.customerType) : null;
    const pt = formData.isInground ? POOL_TYPE_OPTIONS.find(p => p.id === formData.isInground) : null;
    const pc = formData.poolCondition ? POOL_CONDITIONS.find(p => p.id === formData.poolCondition) : null;
    const sb = formData.serviceType && formData.serviceType !== 'pool'
      ? SERVICE_BODY_OPTIONS.find(s => s.id === formData.serviceType)
      : null;
    const summaryChips: string[] = [
      ct?.label,
      pt?.label,
      pc?.label,
      sb?.label,
    ].filter(Boolean) as string[];

    // Main quote display with line-item breakdown
    return (
      <>
        {renderTicketSummary(
          'Recurring Pool Maintenance',
          'images/icon-recurring-maintenance.svg',
          /* Edit pencil jumps back to the progressive page so the
             user can change any of their pool answers. */
          () => setCurrentStep(3),
          summaryChips,
        )}

        <div class="intake-quote-content">
          {/* Quote = adapted watermelon-ui `QuotePricingSection`,
              repurposed for our Weekly ↔ Bi-Weekly frequency choice.
              The user already chose body type on the progressive
              page, so we pass `lockedPlanId` to hide the other plans.
              The toggle (top of the card) lets them flip between
              weekly + bi-weekly to compare. */}
          <div class="gs-quote-pricing">
            <QuotePricingSection
              title="Your maintenance plan"
              plans={(() => {
                /* All three body-type plans. Prices match the
                   existing SERVICE_BODY_OPTIONS constants — weekly
                   uses the base prices, bi-weekly applies the
                   surcharge structure used in calculatePrice. */
                const plans: PricingPlan[] = [
                  {
                    id: 'pool',
                    name: 'Pool',
                    description: 'Weekly chemistry, skimming, equipment check',
                    priceWeekly: '$50',
                    priceBiweekly: '$75',
                    features: [
                      { text: 'Green Free Guarantee', variant: 'green-guarantee', hasInfo: true },
                      { text: 'Complete water chemistry testing & balancing' },
                      { text: 'Pool surface skimming & debris removal' },
                      { text: 'Basket cleaning (skimmer & pump)' },
                      { text: 'Equipment inspection & monitoring' },
                      { text: 'Digital service report after every visit' },
                    ],
                  },
                  {
                    id: 'spa',
                    name: 'Spa',
                    description: 'Spa-only service: chemistry + cleaning',
                    priceWeekly: '$45',
                    priceBiweekly: '$70',
                    features: [
                      { text: 'Green Free Guarantee', variant: 'green-guarantee', hasInfo: true },
                      { text: 'Complete water chemistry testing & balancing' },
                      { text: 'Spa surface skimming & shell wipe-down' },
                      { text: 'Filter & cartridge inspection' },
                      { text: 'Digital service report after every visit' },
                    ],
                  },
                  {
                    id: 'combo',
                    name: 'Pool + Spa',
                    description: 'Both bodies, one weekly visit',
                    priceWeekly: '$60',
                    priceBiweekly: '$85',
                    features: [
                      { text: 'Green Free Guarantee', variant: 'green-guarantee', hasInfo: true },
                      { text: 'Complete water chemistry testing & balancing' },
                      { text: 'Pool + spa skimming & debris removal' },
                      { text: 'Basket cleaning (skimmer & pump)' },
                      { text: 'Equipment inspection & monitoring' },
                      { text: 'Digital service report after every visit' },
                    ],
                  },
                ];
                return plans;
              })()}
              lockedPlanId={
                formData.serviceType === 'pool_spa_combo' ? 'combo'
                : formData.serviceType === 'spa' ? 'spa'
                : 'pool'
              }
              initialCycle={formData.isBiweekly ? 'biweekly' : 'weekly'}
              chemicalCostData={chemCostData}
              footerText="Chemicals billed separately based on usage. Cancel anytime."
              buttonText="Get Started"
              onContinue={(_planId, cycle) => {
                /* Sync the toggle back into formData so downstream
                   submissions (lead creation, "Email Quote", etc.)
                   reflect the latest choice — then trigger the
                   existing get-started flow. */
                if (cycle === 'biweekly' && !formData.isBiweekly) updateForm({ isBiweekly: true });
                if (cycle === 'weekly' && formData.isBiweekly) updateForm({ isBiweekly: false });
                handleGetStartedNow();
              }}
            />
          </div>

          <div class="intake-quote-actions">
            {/* Primary "Get Started Now" CTA is rendered INSIDE the
                QuotePricingSection above; we just keep the
                secondary email/text actions here so the user can
                opt to receive the quote later instead of starting
                the lead flow immediately. */}
            {leadError && <p style="color: #dc2626; font-size: 0.85rem; margin-top: 0.5rem;">{leadError}</p>}
            <div class="intake-btn-row">
              <button
                type="button"
                class="intake-outline-btn"
                disabled={leadSubmitting || !!quoteSending}
                onClick={() => handleQuoteSend('email')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                {leadSubmitting
                  ? 'Saving...'
                  : quoteSending === 'email'
                    ? 'Sending...'
                    : 'Email Quote'}
              </button>
              <button
                type="button"
                class="intake-outline-btn"
                disabled={leadSubmitting || !!quoteSending}
                onClick={() => handleQuoteSend('sms')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {leadSubmitting
                  ? 'Saving...'
                  : quoteSending === 'sms'
                    ? 'Sending...'
                    : 'Text Quote'}
              </button>
            </div>
          </div>

          <p class="intake-quote-fine-print">No long-term contracts &bull; Cancel anytime &bull; Same-day service available</p>
        </div>
      </>
    );
  }

  /* ──────────────────────────────────────────────────────────────
     Brief "preparing your request" loading screen shown for ~750ms
     between the user picking a non-maintenance service and the
     ticket-form view rendering. Smooths what was previously an
     abrupt screen swap. The Perfect Pools logo sits in the centre
     with a spinning ring around it; a "Preparing your request..."
     label pulses below.
     ────────────────────────────────────────────────────────────── */
  function renderRedirectLoading() {
    // Label varies by what the user is being transitioned TO. For
    // the maintenance happy-path the next view is the quote, so
    // "Preparing your quote…" reads more accurately than the
    // generic "request" label used for ticket-form redirects.
    const label = redirectLoading === 'quote' ? 'Preparing your quote…' : 'Preparing your request…';
    return (
      <div class="gs-redirect-loading">
        <div class="gs-redirect-loading__logo-wrap">
          <img src={`${basePath}images/perfect-pools-logo.png`} alt="" class="gs-redirect-loading__logo" />
        </div>
        <p class="gs-redirect-loading__label">{label}</p>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────────
     Shared helper: consolidated summary card shown at the top of
     each non-maintenance ticket-form page (Equipment / Green Pool /
     Renovation). Includes the service the user picked + a flat
     row for their already-collected address + contact info, so
     we don't re-collect those fields in the form below. The edit
     pencil clears the redirect and dumps the user back into the
     service grid.
     ────────────────────────────────────────────────────────────── */
  /* Optional 4th arg `chips` adds a row of pill-shaped chips under
     the service title — used by the maintenance quote view to show
     property type / pool type / condition / body type at a glance.
     Optional 3rd arg `onEdit` overrides where the edit pencil jumps
     (defaults to resetting the ticket state). */
  function renderTicketSummary(svcLabel: string, svcIconPath: string, onEdit?: () => void, chips?: string[]) {
    const fullAddress = [
      formData.addressStreet,
      formData.addressCity,
      formData.addressState,
      formData.addressZip,
    ].filter(Boolean).join(', ').replace(/, ([A-Z]{2}), /, ', $1 ');
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    /* Contact pieces stay separate so we can render each with its
       own glyph (user / phone / email) inline. Falls back to a
       "tap to add" link if everything is missing. */
    const hasAnyContact = !!(fullName || formData.phone || formData.email);
    const addressText = fullAddress || null;

    return (
      <div class="gs-section-summary">
        <div class="gs-section-summary__header">
          <span class="gs-section-summary__header-label">Summary</span>
          <button type="button" class="gs-section-summary__edit" onClick={onEdit || resetTicketState} aria-label="Edit" title="Edit">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
          </button>
        </div>
        <div class="gs-section-summary__body">
          <div class="gs-section-summary__service">
            <div class="gs-section-summary__icon-box">
              <img src={`${basePath}${svcIconPath}`} alt="" />
            </div>
            <div class="gs-section-summary__service-body">
              <h3 class="gs-section-summary__title">{svcLabel}</h3>
              {chips && chips.length > 0 && (
                <div class="gs-section-summary__chips">
                  {chips.map((chip, i) => (
                    <span class="gs-section-summary__chip" key={i}>{chip}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {hasAnyContact ? (
            <div class="gs-section-summary__row gs-section-summary__row--contact">
              {fullName && (
                <span class="gs-section-summary__contact-piece">
                  <span class="gs-section-summary__row-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <span>{fullName}</span>
                </span>
              )}
              {formData.phone && (
                <span class="gs-section-summary__contact-piece">
                  <span class="gs-section-summary__row-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </span>
                  <span>{formData.phone}</span>
                </span>
              )}
              {formData.email && (
                <span class="gs-section-summary__contact-piece">
                  <span class="gs-section-summary__row-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </span>
                  <span>{formData.email}</span>
                </span>
              )}
            </div>
          ) : (
            <div class="gs-section-summary__row">
              <span class="gs-section-summary__row-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <button type="button" class="gs-section-summary__row-text gs-section-summary__row-text--missing" onClick={() => { setRedirect(''); setCurrentStep(2); }}>
                Add your contact info
              </button>
            </div>
          )}

          <div class="gs-section-summary__row">
            <span class="gs-section-summary__row-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </span>
            {addressText ? (
              <span class="gs-section-summary__row-text">{addressText}</span>
            ) : (
              <button type="button" class="gs-section-summary__row-text gs-section-summary__row-text--missing" onClick={() => { setRedirect(''); setCurrentStep(1); }}>
                Add your address
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderTicketQualifierQuestion(type: TicketType, question: TicketQualifierQuestion) {
    const answers = ticketQualifiers[type];

    return (
      <div class="intake-ticket-chip-grid" role="group" aria-label={question.label}>
        {question.options.map(option => {
          const isSelected = answers[question.id] === option.id;
          return (
            <button
              type="button"
              key={option.id}
              class={`intake-ticket-chip ${isSelected ? 'is-selected' : ''}`}
              aria-pressed={isSelected ? 'true' : 'false'}
              onClick={() => updateTicketQualifier(type, question.id, option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  /* ══════════════════════════════════
     P2-2 — Equipment Redirect (with ticket form)
     ══════════════════════════════════ */
  function renderEquipmentRedirect() {
    /* Success state is rendered by the modal-level confirmation
       takeover (see isFlowComplete branch) — this function only
       handles the input form now. */

    /* Layout: consolidated summary at top (service + address +
       contact in one card) + just a description textarea below.
       Name / phone / email are pulled from formData (already
       collected in Step 2) so we don't ask twice. */
    return (
      <>
        {renderTicketSummary('Equipment Issue', 'images/icon-equipment.svg')}

        <div class="intake-sorry-content">
          <div class="intake-ticket-form intake-ticket-form--inline">
            <div class="intake-form-grid">
              <div class="intake-field">
                <label class="intake-label">Describe your issue <span class="intake-label-optional">(optional)</span></label>
                <textarea class="intake-input intake-textarea" rows={4} value={ticketDescription} onInput={(e: any) => setTicketDescription(e.target.value)} placeholder="e.g. Pump is making a loud noise, filter pressure is high, heater won't turn on..." />
              </div>
            </div>

            {ticketError && <p class="intake-submit-error">{ticketError}</p>}

            <button type="button" class="intake-cta-btn" data-intake-advance style="width: 100%; margin-top: 0.75rem;" disabled={ticketSubmitting} onClick={() => submitTicket('equipment')}>
              {ticketSubmitting ? 'Submitting...' : 'Get a Call Back'}
            </button>
          </div>

          <div class="intake-sorry-help intake-sorry-help--blue" style="margin-top: 1.25rem;">
            <h3>What to expect:</h3>
            <ul>
              <li><strong>$150 residential service call</strong> — $185 for commercial</li>
              <li><strong>Most repairs completed same day</strong> — Parts ordered if needed</li>
            </ul>
          </div>

          <div class="intake-ticket-divider">
            <span>or call us directly</span>
          </div>

          <div class="intake-sorry-actions">
            <a href="tel:9124590160" class="intake-outline-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              (912) 459-0160
            </a>
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     P2-2 — Green Pool Redirect (with ticket form)
     ══════════════════════════════════ */
  function renderGreenPoolRedirect() {
    /* Success state lives in the modal-level confirmation takeover
       (isFlowComplete branch). */

    /* Same pattern as Equipment redirect — consolidated summary +
       just the description textarea (contact info comes from
       formData, populated in Step 2). */
    return (
      <>
        {renderTicketSummary('Green Pool Recovery', 'images/icon-green-pool.png')}

        <div class="intake-sorry-content">
          <div class="intake-ticket-form intake-ticket-form--inline">
            <div class="intake-form-grid">
              <div class="intake-field">
                <label class="intake-label">Tell us about your pool's condition <span class="intake-label-optional">(optional)</span></label>
                <textarea class="intake-input intake-textarea" rows={4} value={ticketDescription} onInput={(e: any) => setTicketDescription(e.target.value)} placeholder="e.g. Pool has been green for 2 weeks, pump is running but water isn't clearing..." />
              </div>
            </div>

            {ticketError && <p class="intake-submit-error">{ticketError}</p>}

            <button type="button" class="intake-cta-btn" data-intake-advance style="width: 100%; margin-top: 0.75rem;" disabled={ticketSubmitting} onClick={() => submitTicket('green_pool')}>
              {ticketSubmitting ? 'Submitting...' : 'Get a Call Back'}
            </button>
          </div>

          <div class="intake-sorry-help intake-sorry-help--blue" style="margin-top: 1.25rem;">
            <h3>What to expect:</h3>
            <ul>
              <li><strong>$50 green pool evaluation</strong> — $150 if equipment is also down</li>
              <li><strong>Typical recovery takes 3-7 days</strong> — Depending on severity</li>
            </ul>
          </div>

          <div class="intake-ticket-divider">
            <span>or call us directly</span>
          </div>

          <div class="intake-sorry-actions">
            <a href="tel:9124590160" class="intake-outline-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              (912) 459-0160
            </a>
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
     P2-2b — Renovation Redirect (with ticket form)
     Mirrors the Equipment / Green-pool redirects so all three non-
     maintenance services use the same compact summary-card +
     inline-ticket-form layout. Renovation is a partner referral
     (PSP), so the description prompt is about scope rather than
     a fault report.
     ══════════════════════════════════ */
  function renderRenovationRedirect() {
    /* Success state lives in the modal-level confirmation takeover
       (isFlowComplete branch). */

    return (
      <>
        {renderTicketSummary('Renovation', 'images/icon-renovation.png')}

        <div class="intake-sorry-content">
          <div class="intake-ticket-form intake-ticket-form--inline">
            <div class="intake-form-grid">
              <div class="intake-field">
                <label class="intake-label">Describe your project <span class="intake-label-optional">(optional)</span></label>
                <textarea class="intake-input intake-textarea" rows={4} value={ticketDescription} onInput={(e: any) => setTicketDescription(e.target.value)} placeholder="e.g. Replaster the pool, retile the spa, replace coping..." />
              </div>
            </div>

            {ticketError && <p class="intake-submit-error">{ticketError}</p>}

            <button type="button" class="intake-cta-btn" data-intake-advance style="width: 100%; margin-top: 0.75rem;" disabled={ticketSubmitting} onClick={() => submitTicket('renovation')}>
              {ticketSubmitting ? 'Submitting...' : 'Get a Call Back'}
            </button>
          </div>

          <div class="intake-sorry-help intake-sorry-help--blue" style="margin-top: 1.25rem;">
            <h3>What to expect:</h3>
            <ul>
              <li><strong>We partner with PSP for renovation projects</strong> — Custom quotes for replaster, retile, and full remodels</li>
              <li><strong>We'll connect you with the right team</strong> — Site visit scheduled within a few days</li>
            </ul>
          </div>

          <div class="intake-ticket-divider">
            <span>or call us directly</span>
          </div>

          <div class="intake-sorry-actions">
            <a href="tel:9124590160" class="intake-outline-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              (912) 459-0160
            </a>
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════
     P2-3 — Commercial Mini-Form
     ══════════════════════════════════ */
  function renderCommercialForm() {
    /* Success state lives in the modal-level confirmation takeover
       (isFlowComplete branch). */

    const commercialSummaryChips = [
      commercialForm.companyName.trim(),
      commercialForm.closesForWinter !== null ? getCommercialFrequencyLabel(commercialForm.summerFrequency) : '',
    ].filter((chip): chip is string => Boolean(chip));

    return (
      <>
        {renderTicketSummary(
          'Commercial Pool Service',
          'images/icon-recurring-maintenance.svg',
          () => { setRedirect(''); setCurrentStep(3); },
          commercialSummaryChips
        )}

        <div class="intake-sorry-content">
          <div class="intake-ticket-form intake-ticket-form--inline">
            <div class="intake-form-grid">
              <div class="intake-field">
                <label class="intake-label">Additional details <span class="intake-label-optional">(optional)</span></label>
                <textarea
                  class="intake-input intake-textarea"
                  rows={4}
                  value={commercialForm.commercialDescription}
                  onInput={(e: any) => setCommercialForm(prev => ({ ...prev, commercialDescription: e.target.value }))}
                  placeholder="Tell us about the facility, number of pools/spas, gate access, current service needs, or anything else helpful."
                />
              </div>
            </div>

            {commercialError && <p class="intake-submit-error">{commercialError}</p>}

            <button type="button" class="intake-cta-btn" data-intake-advance style="width: 100%; margin-top: 0.75rem;" disabled={commercialSubmitting} onClick={submitCommercialLead}>
              {commercialSubmitting ? 'Submitting...' : 'Request Commercial Quote'}
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
  const savedAddress = [
    formData.addressStreet,
    formData.addressCity,
    formData.addressState,
    formData.addressZip,
  ].filter(Boolean).join(', ').replace(/, ([A-Z]{2}), /, ', $1 ');

  useEffect(() => {
    if (!inputRef.current || !savedAddress || inputRef.current.value) return;
    inputRef.current.value = savedAddress;
  }, [savedAddress]);

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
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter your address to check coverage..."
            class="intake-search-input intake-search-input--with-icon"
            autocomplete="off"
            defaultValue={savedAddress}
            onInput={() => {
              if (!formData.areaResult && !formData.addressStreet) return;
              updateForm({
                areaResult: '',
                county: '',
                addressStreet: '',
                addressCity: '',
                addressState: 'GA',
                addressZip: '',
              });
            }}
          />
        </div>
      </div>

      {formData.areaResult === 'in-area' && (
        <div class="intake-area-result intake-area-result--success">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span><strong>Great news!</strong> Join {heatmapCount > 50 ? `${heatmapCount}+` : '500+'} customers who trust Perfect Pools.</span>
          <button class="intake-area-continue" data-intake-advance onClick={onContinue}>
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
