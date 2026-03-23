# Perfect Pools — Lead-to-Customer Pipeline Architecture (v2)

## 1. Design Principles

- **Capture early, enrich progressively**: Write to `leads` the moment we have contact info — even if they bounce.
- **Stage before committing**: Onboarding holds all data until a human confirms it's ready. Production tables (`service_schedules`, `maintenance_customers`) only get written when onboarding is complete.
- **Humans confirm matches**: Duplicate detection flags potential matches, but a team member must confirm before linking. No auto-matching.
- **Preserve history**: Onboarding records are never deleted. Leads are never deleted. Every state transition is timestamped.
- **Idempotent upserts**: If a lead resubmits or an internal user picks up a partial lead, we upsert on email/phone — never create duplicates in the leads table.

---

## 2. Supabase Table Design

### Existing Tables (no structural changes)

| Table | Role in Pipeline |
|---|---|
| `Customers` (8,743 rows) | Master customer record. New record created at conversion. `is_maintenance` flag set when onboarding completes. |
| `card_vault` | Encrypted card storage. Entry created at conversion via existing RSA/AES flow. |
| `card_collection_requests` | Tokenized card collection links (48hr expiry). May be used for the form's payment step. |
| `customer_identifiers` | Multi-source customer resolution. Used during duplicate detection. |
| `customer_match_queue` | Existing matching pipeline. Duplicate flags route here for manual review. |
| `vault_config` | RSA key storage for card encryption. No changes needed. |

**Not in v1 scope** (existing, will integrate later):
| `service_addresses` | Physical service locations. Future: created when onboarding completes. |
| `service_address_history` | Tracks customer↔address relationships over time. |
| `service_schedules` | Active/inactive/paused/cancelled service records. Future: created when onboarding completes. |

### New Table: `leads`

Top of funnel. Everyone who starts the form (captured at Step 2 — contact info).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Auto-updated via trigger |
| `status` | text | `new` → `quoted` → `converted` → `lost` → `disqualified` |
| `source` | text | `website`, `phone`, `referral`, `internal` |
| **Contact Info (Step 2)** | | |
| `first_name` | text | |
| `last_name` | text | |
| `email` | text | |
| `phone` | text | |
| `address_street` | text | |
| `address_city` | text | |
| `address_state` | text | Default `GA` |
| `address_zip` | text | |
| **Service Selection (Step 1)** | | |
| `service_interest` | text | Always `maintenance` for leads in this table — non-maintenance selections don't create leads |
| **Qualifying Filters (Steps 4-7)** | | |
| `customer_type` | text | `residential`, `commercial` |
| `pool_size` | text | `small`, `medium`, `large` |
| `pool_condition` | text | `good`, `needs_repair` |
| `is_inground` | boolean | |
| `disqualified` | boolean | Default `false` |
| `disqualify_reason` | text | Nullable — which redirect they hit (large pool, above ground, needs repair, commercial) |
| **Pricing (Step 8)** | | |
| `service_type` | text | `pool`, `spa`, `pool_spa_combo` |
| `has_extra_body` | boolean | Default `false` — fountain, water feature, etc. |
| `is_biweekly` | boolean | Default `false` — only available Sept–Feb |
| `quoted_per_visit` | numeric(10,2) | Per-visit rate shown to customer |
| `quoted_monthly` | numeric(10,2) | Monthly rate shown to customer |
| **Lead Context (Step 9)** | | |
| `lead_context` | text | `new_owner`, `switching`, `diy_previously` |
| **Duplicate Detection (Step 3b)** | | |
| `is_existing_customer` | boolean | Default `false` — set to `true` if customer confirms "Yes, that's me" |
| `duplicate_suspected` | boolean | Default `false` — set if potential match found |
| `matched_customer_id` | bigint (FK → Customers.id) | Nullable — the existing customer record we think matches |
| `duplicate_resolution` | text | Nullable: `confirmed_yes`, `confirmed_no`, `not_sure` — customer's self-identification |
| **Form State** | | |
| `contact_preference` | text | `email`, `text`, `both` |
| `form_completed_at` | timestamptz | Null until they see their quote |
| `converted_at` | timestamptz | Null until payment collected |
| `customer_id` | bigint (FK → Customers.id) | Set when "Yes that's me" (existing) or at conversion (new) |
| `resume_token` | text | Crypto-random string for form resume link |
| `resume_token_expires_at` | timestamptz | Token creation + 30 days |
| `notes` | text | Internal notes (for call-in context) |
| | | `-- future: assigned_to, last_contacted_at` |

**Key indexes**: `(email)`, `(phone)`, `(status)`, `(created_at)`, `(resume_token)`

**Unique constraint**: Composite on `(email, address_street)` to prevent true duplicate leads while allowing same person at different addresses or different people at same address with different emails.

**RLS Policy**: 
- Anon role: `INSERT` limited columns (contact info, qualifying answers, pricing selections). `SELECT` own lead via resume_token for form resume. `UPDATE` own lead via resume_token (to add pool details, advance through form).
- Authenticated role: Full CRUD.

### New Table: `onboarding`

Created when a lead converts (payment collected). Stages all service data until a human confirms and activates. Pool info fields are nullable — customer can skip most of them (except dogs, payment, start date).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `lead_id` | uuid (FK → leads.id) | Links back to original lead |
| `customer_id` | bigint (FK → Customers.id) | Links to Customer record created at conversion |
| `created_at` | timestamptz | = conversion timestamp |
| `status` | text | `pending_review` → `confirmed` → `route_assigned` → `complete` |
| **Pricing (from lead)** | | |
| `monthly_rate` | numeric(10,2) | From quoted_monthly |
| `per_visit_rate` | numeric(10,2) | From quoted_per_visit |
| `service_type` | text | `pool`, `spa`, `pool_spa_combo` |
| `has_extra_body` | boolean | From lead |
| `is_biweekly` | boolean | From lead |
| **Pool Info (Step 11 — mostly optional)** | | |
| `is_screened_in` | boolean | Nullable |
| `chlorination_system` | text | Nullable: `salt_cell`, `tablet_feeder` |
| `filter_type` | text | Nullable: `sand`, `cartridge` |
| `vegetation_level` | text | Nullable: `high`, `medium`, `low` |
| `has_auto_cleaner` | boolean | Nullable |
| `access_instructions` | text | Nullable — gate codes, key location |
| `has_dogs` | boolean | **Required** — tech safety |
| `special_instructions` | text | Nullable — free text |
| `preferred_start_date` | date | Nullable — default ASAP |
| `service_day_preference` | text | Nullable — customer's preferred day |
| **Duplicate Detection** | | |
| `duplicate_suspected` | boolean | Default `false` |
| `matched_customer_id` | bigint (FK → Customers.id) | Nullable — potential existing customer match |
| `duplicate_resolved` | boolean | Default `false` — team has reviewed the match |
| `duplicate_resolution` | text | Nullable: `confirmed_match`, `new_customer`, `dismissed` |
| **Route Assignment (internal)** | | |
| `assigned_route` | text | Nullable — filled by team |
| `assigned_tech` | text | Nullable — filled by team |
| `first_service_date` | date | Nullable — scheduled after route assignment |
| `completed_at` | timestamptz | When onboarding finished |
| `notes` | text | Internal onboarding notes |

**Key indexes**: `(status)`, `(customer_id)`, `(duplicate_suspected)`

### New Table: `maintenance_customers`

Complete historical record of every customer who has ever been on recurring maintenance service. Status field distinguishes active from cancelled/paused. This is what billing, heatmap, and route planning query against. If a cancelled customer reactivates, we update the existing row and flip status back to `active` rather than creating a new one.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `customer_id` | bigint (FK → Customers.id) | Unique — one maintenance record per customer, ever |
| `onboarding_id` | uuid (FK → onboarding.id) | Links back to onboarding record for audit |
| `created_at` | timestamptz | When they first became a maintenance customer |
| `status` | text | `active`, `paused`, `cancelled` |
| `status_changed_at` | timestamptz | Last status change |
| **Pricing** | | |
| `monthly_rate` | numeric(10,2) | |
| `per_visit_rate` | numeric(10,2) | |
| `service_type` | text | `pool`, `spa`, `pool_spa_combo` |
| `has_extra_body` | boolean | |
| `is_biweekly` | boolean | Can change seasonally |
| **Pool Info** | | |
| `is_screened_in` | boolean | Nullable |
| `chlorination_system` | text | `salt_cell`, `tablet_feeder` |
| `filter_type` | text | `sand`, `cartridge` |
| `vegetation_level` | text | `high`, `medium`, `low` |
| `has_auto_cleaner` | boolean | |
| `access_instructions` | text | |
| `has_dogs` | boolean | |
| `special_instructions` | text | |
| **Assignment** | | |
| `service_day` | text | Assigned day (may differ from customer preference) |
| `assigned_route` | text | |
| `assigned_tech` | text | |
| `first_service_date` | date | |
| **Lifecycle** | | |
| `cancelled_at` | timestamptz | Nullable |
| `cancel_reason` | text | Nullable |
| `reactivated_at` | timestamptz | Nullable — set when a cancelled customer comes back |
| `notes` | text | |

**Key indexes**: `(customer_id)` unique, `(status)`, `(assigned_route)`, `(assigned_tech)`

**Unique constraint**: `(customer_id)` — one maintenance record per customer. Reactivations update the existing row (flip status, set `reactivated_at`, update rate/details as needed).

---

## 3. Lead Lifecycle State Machine

```
                    ┌──────────────────────────────┐
                    │                              │
   Form Start ──→ [NEW] ──→ [QUOTED] ──→ [CONVERTED]
                    │            │              │
                    │            │         Creates:
                    │            ▼         - Customers record
                    │         [LOST]       - card_vault entry
                    │      (30-day         - onboarding record
                    │       timeout            │
                    │       or manual)         ▼
                    ▼                    ONBOARDING
              [DISQUALIFIED]         [pending_review]
           (above-ground,                  │
            broken equipment,         dup check + team review
            out of area)                   │
                                    [confirmed]
                                           │
                                      route + tech assigned
                                           │
                                    [route_assigned]
                                           │
                                    first service scheduled
                                           │
                                      [complete]
                                           │
                                    Creates:
                                    - maintenance_customers (or reactivates existing)
                                    - Customers.is_maintenance = true
```

---

## 4. Duplicate Detection Flow

Duplicate detection happens in TWO stages: first on the form (customer self-identifies), then at conversion (team reviews any remaining flags during onboarding).

### Stage 1: Form-Level Check (Step 3b — after contact info captured)

```
Contact info submitted
    ↓
Normalize address (strip apt/unit, standardize abbreviations)
Check against:
  service_addresses.normalized_address (address match only — not email/phone)
    ↓
┌─ No match found
│   → Continue normally, no duplicate step shown
│
└─ Address match found (one or more accounts tied to this property)
    → Show Step 3b: "It looks like we've done work at this property before."
    → Display redacted account info (full first name, last initial, last 4 of phone — e.g., "Carter S. — ***-0160")
    → If multiple accounts at address, show all as options
        ↓
    ┌─ "Yes, that's me" (selects which account)
    │   → Link lead to matched customer_id
    │   → Show redacted contact info on file (e.g., "Carter S. — ***-0160")
    │   → Ask: "Would you like to update your contact info?"
    │       ├─ "No, my info is the same" → proceed with existing
    │       └─ "Yes, update" → show fresh fields, full overwrite on Customers record
    │   → If matched customer is active maintenance:
    │       → Soft block: "Active service exists at this address. Call (912) 459-0160."
    │   → If matched customer is inactive/cancelled:
    │       → Continue as reactivation — form proceeds normally
    │
    ├─ "No, I'm a new customer"
    │   → Set duplicate_resolution = 'confirmed_no'
    │   → Continue as new customer
    │
    └─ "Not sure"
        → Set duplicate_suspected = true, matched_customer_id on lead
        → Continue as new customer
        → Flagged for team review during onboarding
```

### Stage 2: Onboarding Review (internal — after conversion)

For leads where `duplicate_suspected = true` (customer said "Not sure") OR where no match was found at form time but team spots a duplicate manually:

```
Onboarding queue shows flagged records
    ↓
Team reviews match side-by-side
    ↓
┌─ Team confirms match
│   → Link onboarding.customer_id to existing customer
│   → Delete tentative Customers record if one was created
│   → Set onboarding.duplicate_resolution = 'confirmed_match'
│   → Continue onboarding
│
├─ Team says "new customer"
│   → Keep new Customers record
│   → Set onboarding.duplicate_resolution = 'new_customer'
│   → Continue onboarding
│
└─ Team dismisses (false positive)
    → Keep new Customers record
    → Set onboarding.duplicate_resolution = 'dismissed'
    → Continue onboarding
```

---

## 5. Customer-Facing Form Flow (Multi-Step, Single Page)

The form lives as a Preact island component on the Astro site at `/get-started`. One continuous flow, no page reloads. Steps branch based on answers — non-maintenance paths redirect to appropriate pages. **No lead is captured until the customer selects Recurring Pool Maintenance and passes the service area check.**

### Step 1: What Can We Help You With? (Service Type Branch)

| Selection | Action |
|---|---|
| **Recurring Pool Maintenance** | Continue to Step 2 |
| **Green Pool Recovery** | Redirect page: call to schedule site visit ($50 green pool quote / $150 if equipment also down). Link to green pool page. |
| **Equipment Issue** | Redirect page: call to schedule site visit ($150 residential / $185 commercial). Link to service & repair page. |
| **Renovation** | Redirect page: call PSP (renovation partner). Link to renovation page. |

- **→ Non-maintenance selections**: No lead captured. Form shows redirect page with phone number and relevant link. No database writes.
- **→ Recurring Pool Maintenance**: Continue.

### Step 2: Service Area Check
- Address/zip entry against service area data
- **→ If outside area**: Friendly message, no further steps, no lead captured
- **→ If inside area**: Continue
- *(This step already exists and is finalized)*

### Step 3: Contact Info
- First name, last name
- Email, phone
- Service address (pre-filled from step 2 if entered there)
- **→ On completing this step: INSERT into `leads` with status = `new`, `service_interest` = `maintenance`**
- **→ Run duplicate check**: Query `Customers` + `service_addresses` matching on normalized address, email, and/or phone.
- This is the early capture point. Every lead in the table has already self-selected into maintenance AND is in the service area.

### Step 3b: Existing Customer Check (only shown if address match detected)

After contact info is submitted, run a background check matching the normalized address against `service_addresses`. If a match is found, show the customer a prompt with heavily redacted info from accounts tied to that address:

**"It looks like we've done work at this property before."**

Displays redacted account info, e.g.: *"Carter S. — Phone: ***-0160"*

(Shows full first name, last initial, and last 4 digits of phone number)

| Selection | Action |
|---|---|
| **Yes, that's me** | Link lead to matched `customer_id`. Show contact info update prompt (see below). If matched customer has active maintenance, soft block: "There's already active service at this address. Call (912) 459-0160." If inactive/cancelled, continue as reactivation. |
| **No, I'm a new customer** | Proceed as new. `duplicate_resolution = 'confirmed_no'`. |
| **Not sure** | Proceed as new, flag lead: `duplicate_suspected = true`, `matched_customer_id` set. Team reviews during onboarding. |

**Contact Info Update (after "Yes, that's me"):**

Show redacted version of what's on file: *"Carter S. — Phone: ***-0160 / Email: c****@g****.com"*

| Selection | Action |
|---|---|
| **"No, my info is the same"** | Proceed with existing contact info from Customers record |
| **"Yes, update my info"** | Show fresh fields: first name, last name, email, phone. Customer fills out all fields — full overwrite on the Customers record. Lead record also updated with new contact info. |

- **→ Match on address only** — not email or phone (different family members may have different contact info at the same address)
- **→ Redacted info only** — first initial + last initial, service date range. Never show full name, email, phone, or financial details to the person on the form.
- **→ Multiple accounts at same address**: If more than one customer is tied to the address, show all as redacted options and let them pick which one (or "none of these").
- **→ If "Yes"**: UPDATE lead with `customer_id = matched_customer_id`, `is_existing_customer = true`.
- **→ If "No" or "Not sure"**: Continue to Step 4.

### Step 4: Customer Type

| Selection | Action |
|---|---|
| **Residential** | Continue to Step 5 |
| **Commercial** | Redirect page: call to schedule free site visit for custom quote |

- **→ UPDATE lead: `customer_type` = `residential` or `commercial`**

### Step 5: Pool Size

| Selection | Action |
|---|---|
| **Small** | Continue |
| **Medium** | Continue |
| **Large** | Redirect to existing large pool page |

- **→ UPDATE lead: `pool_size` = `small`, `medium`, or `large`**

### Step 6: Pool Condition

| Selection | Action |
|---|---|
| **All equipment functioning and water blue** | Continue |
| **Something wrong** (cloudy water, leak, pump down, etc.) | Redirect to equipment issue page — get diagnosis and repairs done before maintenance pickup |

- **→ UPDATE lead: `pool_condition` = `good` or `needs_repair`**

### Step 7: Pool Type

| Selection | Action |
|---|---|
| **In-ground** | Continue |
| **Above ground** | Redirect to existing above-ground page |

- **→ UPDATE lead: `is_inground` = true/false**

### Step 8: Service Bodies (Quote Calculator)
- Service type (select one): Pool ($50/visit) / Spa ($45/visit) / Pool + Spa Combo ($60/visit)
- Additional body of water? (single checkbox): +$10/visit — e.g. fountain
- Service frequency (shown Sept–Feb only): Weekly / Bi-weekly (+$25/visit surcharge)
- **→ Calculate quote using formula, display per-visit and monthly rate prominently**
- **→ UPDATE lead: status = `quoted`, pricing fields set, `form_completed_at` = now()**

### Step 9: Lead Context
- How did you hear about us / what's your situation? (select one):
  - New pool owner
  - Switching from another company
  - Used to do it themselves
- **→ UPDATE lead: `lead_context`**

### Step 10: Quote Page (Decision Point)
Display the quote prominently. Two paths:

**Option A: "Get Started Now"** (primary CTA)
→ Continues to Step 11 (pool info + payment)

**Option B: "Send Me the Details"** (secondary CTA)
→ Quick preference picker: Email, Text, or Both
→ Confirmation: "We'll be in touch within 24 hours!"
→ Updates lead `contact_preference`
→ Triggers Windmill `lead_follow_up` flow

**Resume Link Behavior** (when lead clicks link from email/SMS):
→ URL: `https://perfectpoolscleaning.com/get-started?token=<resume_token>`
→ Validates token + checks 30-day expiry
→ If valid: pre-fills all fields, shows quote, displays ONLY "Get Started Now" (no second "Send Details")
→ If expired: friendly message with option to start a new quote

### Step 11: Pool Information (only if "Get Started Now")

All fields optional EXCEPT payment, start date preference, and dogs (marked with *).

- Is your pool screened in? (Y/N)
- Chlorination system: Salt cell / Tablet feeder
- Filter type: Sand / Cartridge
- Vegetation level around pool: High (tree over pool) / Medium (surrounding plants) / Low (nothing around it)
- Automatic cleaner: Yes / No
- Gate codes / access instructions
- Dogs? * (Y/N — required for tech safety)
- Special instructions (free text)
- Preferred start date * (optional: ASAP default)
- Preferred service day (optional)

### Step 12: Payment (only if "Get Started Now")
- Card collection form (existing encrypted token flow → QBO Payments via card_vault)
- Monthly rate displayed clearly (from quote)
- Terms acceptance checkbox
- **→ On successful token capture: Store encrypted payment token via card_vault, UPDATE lead status = `converted`, CREATE Customers record (or link to existing if customer confirmed match at Step 3b), CREATE onboarding record (with duplicate flags carried over from lead if applicable)**
- Charging happens later via QBO Payments API (Windmill) after onboarding complete

### Step 13: Confirmation
- "You're all set! We'll contact you within 48 hours to schedule your first service."
- Summary of what they submitted
- Phone number for questions

---

## 6. Internal Form (`/internal` — Password-Gated)

Lives in the same Astro repo at `perfectpoolscleaning.com/internal`. Protected by a simple shared password gate (password stored as `INTERNAL_PASSWORD` env var in Vercel, session cookie so you only enter it once per browser session).

Shares components with the customer form but with additional capabilities:

### Lead Lookup
- Search by name, email, phone, or address
- Shows lead status, what they've already filled out, and when they submitted
- Filterable by status (`new`, `quoted` — actionable leads)

### Lead Detail / Continuation
- All fields from the customer form, pre-filled with whatever the lead already entered
- Editable — internal user can correct address, update contact info, add notes
- Can advance through the same steps the customer would:
  - If lead is `new`: Qualify them and generate quote
  - If lead is `quoted`: Fill in pool details and collect payment (via QBO Payments manual entry)
- "Convert" button that creates Customer + onboarding records
- "Mark as Lost" button with reason field

### Onboarding Queue
- Shows all onboarding records by status
- **Pending Review** tab: Records with `duplicate_suspected = true`
  - Shows matched customer details side-by-side with new submission
  - Buttons: "Confirm Match" / "New Customer" / "Dismiss"
- **Confirmed** tab: Duplicate resolved, ready for route assignment
  - Assign route, assign tech, schedule first service date
- **Route Assigned** tab: Ready to activate
  - "Activate" button → creates `maintenance_customers` record (or reactivates existing), sets `Customers.is_maintenance = true`, marks onboarding complete

---

## 7. Automation Layer (Windmill)

### Flow 1: `lead_follow_up`
- **Trigger**: Webhook from Supabase (on lead status change to `quoted` with `contact_preference` set)
- **Steps**:
  1. Generate resume token: `crypto.randomUUID()` (32+ char random string)
  2. Write to lead: `UPDATE leads SET resume_token = '...', resume_token_expires_at = now() + interval '30 days' WHERE id = lead_id`
  3. Build resume URL: `https://perfectpoolscleaning.com/get-started?token={resume_token}`
  4. Send quote email (Gmail API) and/or SMS (RingCentral) with: personalized quote amount, resume link, phone number
- **Channels**: Based on `contact_preference` — email, text, or both

### Flow 2: `lead_stale_check` (scheduled, daily)
- **Trigger**: Cron, runs daily
- **Action**: Find leads where `status = 'quoted'` AND `updated_at < now() - interval '7 days'`
- **Action**: Send a follow-up reminder (email/text)
- **Action**: If `updated_at < now() - interval '30 days'`, auto-mark as `lost`

### Flow 3: `onboarding_to_maintenance`
- **Trigger**: Called from internal form when "Activate" button pressed (or webhook from Supabase on `onboarding.status` change to `complete`)
- **Steps**:
  1. Pull finalized data from onboarding record
  2. Check if `maintenance_customers` record exists for this `customer_id`
     - If exists (reactivation): Update existing row — flip status to `active`, set `reactivated_at = now()`, update rate/pool details as needed
     - If new: Create `maintenance_customers` record from onboarding data
  3. Set `Customers.is_maintenance = true`
  4. Set `onboarding.status = 'complete'`, `onboarding.completed_at = now()`
  5. Trigger downstream automations (update heatmap data, etc.)

---

## 8. Data Flow Diagram

```
WEBSITE FORM                 SUPABASE                          WINDMILL              INTERNAL FORM
─────────────                ────────                          ────────              ─────────────

Step 1: Contact ──INSERT──→ leads (status: new)                                    
                                                                                   Lead Lookup
Step 2: Qualify ──UPDATE──→ leads (disqualified?)                                  Search / Filter
                                                                                   
Step 3: Quote   ──UPDATE──→ leads (status: quoted)  ──webhook──→ lead_follow_up   
                             + dup pre-check                     (email + SMS      
                                                                  + resume link)   
  ┌─ "Send Details" UPDATE→ contact_preference set                                 
  │                                                                                
  └─ "Get Started" → Steps 4-5                                                     
                                                                                   
Step 5: Payment ──UPDATE──→ leads (status: converted)                              
                 ──INSERT──→ Customers (new record)                                
                 ──INSERT──→ card_vault (encrypted)                                
                 ──INSERT──→ onboarding (pending_review)                           
                             + duplicate detection                                 
                                                                                   
                                                                              Onboarding Queue
                                                                              ┌─ Review duplicates
                                                                              ├─ Assign route/tech
                                                                              └─ Activate
                                                                                     │
                             onboarding (complete)  ←──────────────────────────── "Activate"
                                     │                                               │
                                     ├──→ maintenance_customers (created/reactivated) │
                                     └──→ Customers.is_maintenance = true    ────→ via Windmill
                                                                              onboarding_to_
                                                                              maintenance
```

---

## 9. Security & RLS Considerations

- **Anon role** (website form): Can `INSERT` into leads (limited columns only — no `status`, `notes`, `converted_at`, `customer_id`). Can `SELECT` and `UPDATE` their own lead via `resume_token` match for form resume.
- **Authenticated role** (internal form): Full CRUD on leads, onboarding, maintenance_customers. Read access to Customers, service_schedules, service_addresses.
- **Payment tokens**: Card data is encrypted and tokenized via existing card_vault RSA/AES flow. Raw card numbers never persist in the database.
- **Resume links**: Crypto-random token, 30-day expiry, validated against `leads.resume_token`. Not a JWT — contains no data, just a lookup key.
- **Internal form password**: Stored as `INTERNAL_PASSWORD` env var in Vercel. Validated against a session cookie (httpOnly, secure, SameSite=Strict). Not a substitute for real auth long-term, but fine for v1 with a small team.

---

## 10. Implementation Priority

### Phase 1: Database
1. Create `leads` table with RLS policies + updated_at trigger
2. Create `onboarding` table
3. Create `maintenance_customers` table
4. Add Supabase webhook for lead status changes → Windmill

### Phase 2: Customer-Facing Form
5. Build multi-step Preact island form component on Astro site (`/get-started`)
6. Wire up Supabase inserts/updates at each form step
7. Implement quote calculation logic (formula TBD)
8. Implement card collection via existing card_vault flow
9. Implement duplicate pre-check (active maintenance soft block)

### Phase 3: Communication & Follow-up
10. Build Windmill `lead_follow_up` flow (email via Gmail API + SMS via RingCentral + resume token generation)
11. Build Windmill `lead_stale_check` daily cron
12. Email/SMS templates

### Phase 4: Internal Form
13. Build `/internal` password gate
14. Build lead lookup + search
15. Build lead detail / continuation form
16. Build onboarding queue with duplicate review UI
17. Build route/tech assignment + activation flow

### Phase 5: Activation Automation
18. Build Windmill `onboarding_to_maintenance` flow
19. Wire up maintenance_customers creation (or reactivation for returning customers)
20. Trigger downstream automations (heatmap update, etc.)

### Phase 6: Polish
21. Form analytics (drop-off tracking per step)
22. Reporting dashboard (leads by source, conversion rate, avg time to convert)
23. Stripe/QBO webhook handling for failed payments
24. A/B test CTA placement

---

## 11. Key Architecture Decision: Pool Details After Quote

Pool details (filter type, salt vs tablet, access instructions) are collected AFTER the quote, not before.

Reasoning:
1. **Conversion psychology**: Fewer fields before the "reward" (price) = higher completion rate.
2. **Not needed for pricing**: Quote is purely body count. Pool details add friction with zero pricing value.
3. **Intent signal**: Willingness to fill out details after seeing the price demonstrates commitment.
4. **Call-in efficiency**: When someone calls after a quote, staff pulls up the lead and walks through pool details. Clean separation.

---

## 12. Pricing Formula

### Form Input
- **Service type** (select one): Pool, Spa, Pool + Spa Combo
- **Additional body of water** (single checkbox): e.g. fountain — +$10/visit
- **Service frequency** (seasonal):
  - March–August: Weekly only (no choice shown)
  - September–February: Weekly or Bi-weekly (+$25/visit surcharge)

### Base Pricing (per visit)

| Service Type | Per Visit |
|---|---|
| Pool | $50 |
| Spa | $45 |
| Pool + Spa Combo | $60 |
| Additional body (fountain) | +$10 |
| Bi-weekly surcharge (Sept–Feb only) | +$25 |

### Monthly Calculation

```
per_visit = base_price[service_type]
          + (has_extra_body ? 10 : 0)
          + (is_biweekly ? 25 : 0)

visits_per_month = is_biweekly ? 2 : 4

monthly_rate = per_visit × visits_per_month
```

### Example Quotes

| Scenario | Season | Per Visit | Monthly |
|---|---|---|---|
| Pool only | Summer (weekly) | $50 | $200 |
| Pool + Spa combo | Summer (weekly) | $60 | $240 |
| Pool + Spa + fountain | Summer (weekly) | $70 | $280 |
| Pool only, bi-weekly | Winter | $75 | $150 |
| Pool + Spa combo, bi-weekly | Winter | $85 | $170 |
| Pool + Spa + fountain, bi-weekly | Winter | $95 | $190 |

### Notes
- Pricing assumes 4 visits/month for weekly (some months may have 5 based on calendar)
- Up to 30,000 gallons
- Bi-weekly service requires homeowner to manage chemicals between visits

### Leads Table Storage
- `service_type`: `pool`, `spa`, `pool_spa_combo`
- `has_extra_body`: boolean
- `is_biweekly`: boolean (only true Sept–Feb)
- `quoted_per_visit`: numeric — the per-visit rate shown to customer
- `quoted_monthly`: numeric — the monthly rate shown to customer

---

## 13. Open Items

- [x] ~~Quoting formula~~ — **DONE** (see Section 12)
- [x] ~~Form flow from Carter~~ — **DONE** (see Section 5 — 13-step flow with branching)
- [ ] **Email/SMS templates**: Quote delivery, follow-up reminder, resume link messaging
- [ ] **Heatmap integration**: Ensure new maintenance_customers records trigger heatmap data update via existing Windmill flow
- [ ] **Card vault integration**: Confirm the form's payment step can use the existing `card_collection_requests` + `card_vault` flow or needs adaptation
