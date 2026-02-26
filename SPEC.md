# Perfect Pools — Home Page Redesign Spec

## Project Overview
Replace the current Elementor-based home page on perfectpoolscleaning.com with a
modern, SEO-optimized standard WordPress page. The new page will be built as static
HTML/CSS first, previewed locally, then pushed to WordPress via the REST API using
the WordPress MCP connector.

## Technical Context
- **Site**: perfectpoolscleaning.com (WordPress + Astra theme)
- **Current home page**: Page ID 20731, built with Elementor (cannot be edited via API)
- **Strategy**: Create a NEW standard WordPress page, set it as the home page, then
  draft/delete the old Elementor page
- **Theme**: Astra (supports custom layouts, custom CSS, and hooks via API)
- **MCP Tools Available**: Full WordPress REST API via `claudeus-wp-mcp` connector
  (pages, menus, media, Astra settings, plugins, site settings)

## Design Direction
Research top-performing home service company websites (pool service, HVAC, plumbing,
landscaping) for modern design patterns. Target aesthetic:
- Clean, professional, high-trust
- Mobile-first responsive
- Strong hero with clear CTA
- Social proof prominent (reviews, badges)
- Fast-loading (minimal JS, no heavy frameworks)
- Use only Tailwind CSS via CDN or inline styles (no build step needed)

### Competitor Research (do this first)
Look at home pages for:
- ASP - America's Swimming Pool Company (aspoolco.com)
- Pinnacle Pool Service (pinnaclepools.com)
- Pool Scouts (poolscouts.com)
- Any top-ranking "pool service savannah ga" results

Note layout patterns, color schemes, CTAs, trust signals, and section ordering.

## Content (use exactly — fix typos as noted)

### Hero Section
- **Headline**: "Professional Pool Services"
- **Subtitle**: "Maintenance · Service · Retail"
- **Description**: "Trusted pool maintenance and service experts in Richmond Hill
  and the Greater Savannah area, offering cleaning, chemical service, and repairs
  backed by over 20 years of experience."
- **CTA Buttons**:
  - Call: (912) 459-0160
  - Sign Up: https://forms.jeffspoolspa.com/jeffspoolspaservice1/form/MaintenanceLeads/formperma/sZ_cHMy_F4pf-JTi8aCRtmGr78z4LJNGBj_w8_dtEIc

### Services Section
Title: "What We Offer: Comprehensive Pool Services"

| Service | Description | Price |
|---------|-------------|-------|
| Residential Pool Cleaning | Professional care that keeps your water clear so you can simply relax and enjoy | Starts From $50/visit |
| Commercial Pool Cleaning | Expert care to keep your pool up to health code standards | Contact for pricing |
| Green Pool Recovery | Specialized recovery programs for severe algae outbreaks | Starts From $85/visit |
| Residential Pool Inspections | Detailed inspections to give homebuyers peace of mind before you buy | Starts From $250 |
| Commercial Repair & Install | Professional service to minimize downtime and keep equipment running | Diagnosis visit from $185 |
| Residential Repair & Install | Expert repairs and installs for pumps, filters, heaters, and more | Diagnosis visit from $150 |

### About Section
Title: "Who We Are: Your Trusted Local Pool Experts"

Body: "With over 20 years serving Coastal Georgia, Perfect Pools has built a
reputation for reliability, safety, and professionalism. Our experienced team keeps
residential and commercial pools in Richmond Hill and the Greater Savannah area
sparkling, safe, and ready to enjoy — all backed by our commitment to quality service."

Features:
- CPO Certified Pool Technicians
- Advanced routing software for consistent, on-time service
- Trusted by homeowners & HOAs for 20+ years
- Authorized Installer for all major pool equipment manufacturers

### Trust Badges
- Fully Licensed
- Warranty Backed
- Transparent Pricing
- 20 Years Experience

### Projects Section
Title: "Our Work: Recent Projects"
Subtitle: "Take a look at some of our recent service projects. From green pool
cleanups to complete installations."

- Residential: Green Pool Drain & Clean
- Commercial: Sand Filter Install
- Residential: Automation System Upgrade
- Commercial: Heater Install

### Service Area
Title: "Our Service Area"
Embed Google Maps iframe centered on: 8989 Ford Ave, Richmond Hill, GA 31324

### Process Section
Title: "How Our Pool Maintenance Works"
1. **Get a Quote** — "Click the link to answer a few questions and get a quote
   sent to you instantly."
2. **Sign Up Online** — "Give us your preferred day of the week, start date,
   and any special requests."
3. **Enjoy Your Pool** — "Sit back and relax while an experienced professional
   regularly monitors and cleans your pool."

### Testimonials Section
Title: "What Our Customers Say"
Subtitle: "Don't just take our word for it."

Include all 4 Google reviews (all 5-star):
1. **Scott Lopez**: "Erin and Jackie of Perfect Pools have managed the maintenance
   of our pool, deck, and lanai for over 8 years, and they are a credit to their
   profession. The quality of work is always exceptional; Their professionalism and
   attention to detail are unmatched; Matthew, our pool technician, is highly skilled
   and efficient; Perfect Pools maintains exceptional communication: timely,
   transparent, team-focused, and courteous. Perfect Pools should be your first call
   for all your pool maintenance needs!"
2. **Skip Nygard**: "Perfect Pools takes care of our neighborhood pool, and they
   do a great job! Always clean, looks nice, no trash, etc. Every time the staff is
   at our pool, they're quick, professional, and don't interfere with families
   enjoying the pool. I've even seen them save an animal that got into the pool and
   stuck in one of the traps. They care for animals too! Overall, very impressed
   with the service, care, professionalism. Plus, one of the technicians looks
   exactly like Dustin Hoffman...how cool is that?! Dustin Hoffman at our pool!!
   Would recommend PP to anyone! Great job guys!"
3. **Shane Hawyard**: "Erin and her Team do a great job and take excellent care of
   our pool. I travel a lot and they always make sure my wife and kids have a clean
   and well balanced pool to enjoy. We are very grateful for their timely repairs
   and regular pool cleaning services."
4. **Josh Anderson**: "After dealing with other companies in the area, Perfect Pools
   is by far the most responsive, fairly priced, and experienced company. I had
   damage after one of the recent hurricanes and they came in quick to measure and
   replace my liner. They kept in constant communication and provided timely updates.
   Any issue they ran into during the process they were open about and provided a
   solution. Their team has years of experience that shows in their work."

CTA: "Read More Reviews" → https://g.page/r/CVrU0W_3-NRyEAE/review

### Final CTA Section
Title: "Ready to Get Started?"
Subtitle: "Get Your Free Pool Maintenance Quote Today"
Body: "Click below for a free online quote. We're here to help with all your pool needs."
- Phone: (912) 459-0160
- Button: "Get My Free Quote" → (same signup form URL as hero)

## Images
Use existing media from the WordPress media library. Fetch the media list via MCP
to get current URLs. Known images:
- Pool-Cleaning.jpg
- Green-Pool-SSI.jpg
- Testing-Again.jpg
- IMG_2959.jpeg
- Checking-over-equipment.jpg
- IMG_9258.jpg
- CLO-Marketing-Image.jpg
- IMG_2564.jpeg
- 5BBC94C2-F6F8-4CF0-88F7-F96D36576449_4_5005_c.jpeg

⚠️ SKIP this broken image: Better-Cleaning-Filters-scaled.jpg (broken thumbnail)
⚠️ SKIP this broken link: https://drive.google.com/file/d/174quPMYT-T5Zbu0rHxCxexHn4l-dUK8S/view

## SEO Requirements
- **Title tag**: "Pool Cleaning & Maintenance in Savannah & Richmond Hill GA | Perfect Pools"
- **Meta description**: "Professional pool cleaning, maintenance & repair in
  Savannah, Richmond Hill & Greater Savannah GA. CPO certified techs, 20+ years
  experience. Get a free quote today!"
- Use semantic HTML (h1, h2, h3 hierarchy)
- One H1 only (hero headline)
- Alt text on all images
- Schema.org LocalBusiness structured data (JSON-LD)
- Include location keywords naturally throughout copy

## Deployment Steps (after design is approved)
1. Fetch existing media library URLs via MCP
2. Create new WordPress page with the HTML content via MCP
3. Set the new page as the static front page via site settings
4. Update navigation menu to point to new page
5. Set old Elementor page (ID 20731) to draft
6. Draft unused WooCommerce pages (Shop, Cart, Checkout, My Account)
7. Deactivate Yoast SEO plugin (not needed — SEO handled in page markup)
8. Deactivate WooCommerce plugin (not in use)
9. Inject any additional SEO meta via Astra custom layouts if needed

## Constraints
- No JavaScript frameworks — vanilla HTML/CSS only (Tailwind CDN is OK)
- Must work within WordPress post_content (standard block editor compatible)
- All links must use the exact URLs specified above
- Phone number must be a clickable tel: link on mobile
- Page must score 90+ on mobile PageSpeed Insights
