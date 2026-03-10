export interface Chemical {
  id: string;
  name: string;
  scientificName: string;
  price: string;
  category: string;
  badge?: string;
  timing?: string;
  description: string;
  verdict: string;
  whatItDoes: string;
  whenYouWillSeeThis: {
    frequency: string;
    explanation: string;
  };
  benefits: string[];
  whatIfWeSkipIt: string;
  pricing: {
    model: "per-use" | "left-on-site";
    perUseDetails?: {
      unit: string;
      billingIncrement: number;
      pricePerUnit: number;
      calculatorFormula?: {
        divider: number;
        roundTo: number;
      };
    };
    leftOnSiteDetails?: {
      unit: string;
      pricePerRestock: number;
      typicalDuration: string;
    };
  };
  faqs: Array<{ question: string; answer: string }>;
  alternatives?: Array<{ id: string; name: string; description: string }>;
}

export const chemicals: Record<string, Chemical> = {
  "liquid-chlorine": {
    id: "liquid-chlorine",
    name: "Liquid Chlorine",
    scientificName: "Sodium Hypochlorite — 12.5% concentration",
    price: "$8.50 per gallon",
    category: "Sanitizers",
    badge: "Most Used",
    timing: "Weekly",
    description: "The workhorse of pool sanitation. Fast-acting and effective for routine maintenance and shock treatments.",
    verdict: "The purest, fastest way to bring your chlorine back into range.",
    whatItDoes: "Kills bacteria, oxidizes organic waste, and restores your free chlorine level after a week of sun, bathers, and debris have burned through it. We add it when your water test shows chlorine has dropped below the target range — which for most pools is most visits.",
    whenYouWillSeeThis: {
      frequency: "Most visits",
      explanation: "Most pools lose measurable chlorine every day. UV alone destroys unprotected chlorine within hours of sunrise. This is our most routine addition — seeing it on your bill means your system is working exactly as it should."
    },
    benefits: [
      "Fast acting — works on contact, no dissolve time",
      "Pure — adds nothing to your water except chlorine",
      "Precise — we dose exactly what your water test calls for",
      "Professional strength — 12.5% concentration, unavailable at retail"
    ],
    whatIfWeSkipIt: "Chlorine below 1 ppm leaves bacteria and algae with no active sanitizer to contend with. In coastal Georgia heat, algae can establish within 24-48 hours. A routine addition costs a fraction of what a treatment visit runs once it takes hold.",
    pricing: {
      model: "per-use",
      perUseDetails: { unit: "gallon", billingIncrement: 0.5, pricePerUnit: 8.50, calculatorFormula: { divider: 46800, roundTo: 0.5 } }
    },
    faqs: [
      { question: "Is this the same as bleach?", answer: "Chemically yes — both are sodium hypochlorite. Household bleach is 3-6% concentration and often contains additives that cause foaming. What we carry is 12.5% pure pool-grade chlorine from a commercial distributor." },
      { question: "My pool has a salt cell — why do you still add this?", answer: "Salt cells generate chlorine continuously but can't react to a sudden demand spike — heavy rain, a pool party, high heat. Liquid chlorine is how we make fast corrections when your cell alone isn't enough to hold the range." },
      { question: "Why does the amount vary visit to visit?", answer: "Because your pool's chlorine demand isn't constant. Rain, heat, and bather load all affect how fast chlorine burns through. We test first and add exactly what the reading tells us — some weeks that's a quart, some weeks it's more." },
      { question: "Is it safe to swim after you add it?", answer: "Yes. Liquid chlorine disperses quickly and we add it at the end of the visit so circulation distributes it before anyone gets in." }
    ],
    alternatives: [
      { id: "cal-hypo-shock", name: "Cal-Hypo Shock", description: "A solid-form alternative for heavy oxidation events. Delivers a higher concentration dose but adds calcium to your water over time." }
    ]
  },
  "cal-hypo-shock": {
    id: "cal-hypo-shock",
    name: "Cal Hypo Shock",
    scientificName: "Calcium Hypochlorite — 68% available chlorine",
    price: "$6.99 per lb",
    category: "Sanitizers",
    badge: "As Needed",
    description: "High-strength granular shock for heavy bather loads or algae prevention. Won't raise cyanuric acid levels.",
    verdict: "The heavy hitter for when your pool needs a hard reset.",
    whatItDoes: "Delivers a concentrated dose of chlorine in solid form to oxidize combined chlorine (chloramines), kill resistant bacteria, and reset water clarity after heavy use.",
    whenYouWillSeeThis: {
      frequency: "As needed — typically every 2-4 weeks",
      explanation: "Cal Hypo appears after pool parties, heavy rain events, or when combined chlorine builds up and creates that chlorine smell. It's not routine maintenance — it's strategic oxidation when conditions call for it."
    },
    benefits: [
      "High concentration — 68% available chlorine vs 12.5% in liquid",
      "Stable — won't add cyanuric acid to your water over time",
      "Powerful oxidation — clears chloramines and organic waste fast",
      "Long shelf life — doesn't degrade in storage like liquid"
    ],
    whatIfWeSkipIt: "Without periodic shock treatment, combined chlorine accumulates, creating that strong chlorine smell and reducing sanitizer effectiveness. Water stays cloudy longer, and you're more likely to fight persistent algae or bacteria.",
    pricing: {
      model: "per-use",
      perUseDetails: { unit: "pound", billingIncrement: 0.5, pricePerUnit: 6.99, calculatorFormula: { divider: 75000, roundTo: 0.5 } }
    },
    faqs: [
      { question: "Why not just use more liquid chlorine?", answer: "Cal Hypo's higher concentration makes it better for shock treatments. It also doesn't add stabilizer (cyanuric acid), which can build up over time." },
      { question: "Can I swim right after?", answer: "Wait 8-12 hours after shock treatment. Your tech will note this on the service report." },
      { question: "Will this damage my pool surfaces?", answer: "No, when dissolved properly. We pre-dissolve Cal Hypo in a bucket before adding it to prevent any undissolved granules from settling." },
      { question: "How is this different from dichlor shock?", answer: "Cal Hypo doesn't add cyanuric acid (stabilizer) to your water, while dichlor does. For most Georgia pools with outdoor exposure, we prefer Cal Hypo to avoid over-stabilization." }
    ],
    alternatives: [
      { id: "liquid-chlorine", name: "Liquid Chlorine", description: "The routine maintenance alternative. Use liquid chlorine for weekly adjustments and reserve Cal Hypo for true shock events." }
    ]
  },
  "chlorine-free-oxidizer": {
    id: "chlorine-free-oxidizer",
    name: "Chlorine-Free Oxidizer",
    scientificName: "Potassium Monopersulfate",
    price: "$12.99 per lb",
    category: "Sanitizers",
    description: "Clears organic contaminants without affecting chlorine levels. Safe for swimming immediately after application.",
    verdict: "The workhorse that cleans without waiting.",
    whatItDoes: "Oxidizes organic waste — sweat, oils, lotions — without consuming chlorine or requiring a swim delay. This is how we clear cloudy water or handle post-party cleanup when chlorine levels are already good.",
    whenYouWillSeeThis: {
      frequency: "As needed — typically after heavy use",
      explanation: "You'll see this after pool parties, when bather load is high, or when water looks dull despite good chlorine readings."
    },
    benefits: [
      "Swim immediately — no wait time required",
      "Chlorine-neutral — doesn't consume or add chlorine",
      "Fast-acting — clears organics in hours, not days",
      "No chlorine smell — eliminates cause of strong pool smell"
    ],
    whatIfWeSkipIt: "Organic contaminants build up, making water look dull and feel oily. Combined chlorine increases, creating that strong 'chlorine' smell (which is actually chloramines, not chlorine).",
    pricing: {
      model: "per-use",
      perUseDetails: { unit: "pound", billingIncrement: 0.5, pricePerUnit: 12.99, calculatorFormula: { divider: 80000, roundTo: 0.5 } }
    },
    faqs: [
      { question: "Why not just use chlorine?", answer: "Chlorine is a sanitizer first, oxidizer second. When you need oxidation but already have good chlorine levels, chlorine-free oxidizer handles organics without forcing a swim delay." },
      { question: "Can I really swim immediately?", answer: "Yes. Unlike chlorine-based shock, this won't raise sanitizer levels to unsafe ranges." },
      { question: "Will this clear green water?", answer: "No. Green water means algae, which requires chlorine to kill. This handles organic contamination — oils, lotions, proteins — not living organisms." },
      { question: "How often should I use this?", answer: "Only when needed. If you use your pool heavily or host parties, you might see it weekly. Low-use pools might go months between treatments." }
    ]
  },
  "muriatic-acid": {
    id: "muriatic-acid",
    name: "Muriatic Acid",
    scientificName: "Hydrochloric Acid — 31.45% concentration",
    price: "$9.99 per gallon",
    category: "Balancers",
    badge: "Essential",
    timing: "Weekly",
    description: "Lowers pH and total alkalinity. Critical for chlorine effectiveness and preventing scale buildup.",
    verdict: "The tool that makes every other chemical in your pool actually work.",
    whatItDoes: "Lowers pH and total alkalinity to keep your water chemistry in the effective range. When pH drifts high — which happens naturally with chlorine addition and Georgia's mineral-heavy water — acid brings it back down so your sanitizer can do its job.",
    whenYouWillSeeThis: {
      frequency: "Most visits",
      explanation: "Georgia's fill water tends alkaline, and liquid chlorine raises pH with every addition. Without regular acid dosing, pH climbs above 7.8 where chlorine effectiveness drops by 50% or more."
    },
    benefits: [
      "Fast-acting — pH drops within minutes of circulation",
      "Dual purpose — lowers both pH and total alkalinity as needed",
      "Cost-effective — the most economical way to control pH drift",
      "Precise dosing — we add exactly what your test reading requires"
    ],
    whatIfWeSkipIt: "High pH makes chlorine lazy — at 8.0 pH, only 20% of your chlorine is active. You'll burn through sanitizer without getting sanitation. Scale forms on tiles and equipment.",
    pricing: {
      model: "per-use",
      perUseDetails: { unit: "fluid ounce", billingIncrement: 4, pricePerUnit: 0.078, calculatorFormula: { divider: 8600, roundTo: 4 } }
    },
    faqs: [
      { question: "Is acid safe?", answer: "Yes, when handled properly. We dilute it in your pool water where it neutralizes quickly. It's safe to swim 30 minutes after addition." },
      { question: "Why do I need it so often?", answer: "Because liquid chlorine, bather load, and Georgia's naturally alkaline water all push pH upward. Weekly acid additions aren't fixing a problem — they're maintaining balance." },
      { question: "Can you add too much?", answer: "Yes. Low pH is corrosive to equipment and uncomfortable to swim in. That's why we test first and dose precisely." },
      { question: "What's the difference between lowering pH and lowering alkalinity?", answer: "Same chemical, different strategy. Small doses lower pH with minimal alkalinity impact. Larger doses over time bring down alkalinity." }
    ]
  },
  "soda-ash": {
    id: "soda-ash",
    name: "Soda Ash",
    scientificName: "Sodium Carbonate",
    price: "$19.99 per 10 lbs",
    category: "Balancers",
    description: "Raises pH quickly without significantly affecting total alkalinity.",
    verdict: "The fast pH rescue for when rain or over-correction drops it too low.",
    whatItDoes: "Raises pH rapidly when acidic conditions threaten equipment and comfort. Heavy rain, aggressive acid dosing, or certain fill water sources can drop pH into corrosive territory — soda ash brings it back to safe range quickly.",
    whenYouWillSeeThis: {
      frequency: "Occasionally — a few times per season",
      explanation: "You'll see soda ash after heavy rainfall events or if acid dosing drops pH below 7.2. Not routine, but essential when needed."
    },
    benefits: [
      "Rapid pH increase — raises pH without waiting days",
      "Minimal alkalinity impact — won't throw TA out of range",
      "Dissolves quickly — no residue or clouding",
      "Equipment protection — prevents corrosion from acidic water"
    ],
    whatIfWeSkipIt: "Low pH corrodes metal fixtures, etches plaster, dissolves grout, and causes eye/skin irritation. Left uncorrected, low pH causes thousands in equipment and surface damage.",
    pricing: {
      model: "left-on-site",
      leftOnSiteDetails: { unit: "10-pound container", pricePerRestock: 19.99, typicalDuration: "3-6 months" }
    },
    faqs: [
      { question: "Why not just use less acid?", answer: "Because pH naturally drifts high in most pools. We're constantly balancing upward pressure from chlorine against downward correction from acid. Soda ash is for when that balance tips too far." },
      { question: "How is this different from baking soda?", answer: "Soda ash raises pH with minimal alkalinity change. Sodium bicarbonate (baking soda) raises both. We choose the tool based on what your water test shows." },
      { question: "Will this make my water cloudy?", answer: "Not when dosed correctly. We add soda ash in small increments and let circulation distribute it." },
      { question: "Can I just skip it and wait for pH to come back up naturally?", answer: "You could, but every hour at low pH is causing damage — to your equipment, your surfaces, and your comfort." }
    ]
  },
  "sodium-bicarbonate": {
    id: "sodium-bicarbonate",
    name: "Sodium Bicarbonate",
    scientificName: "Alkalinity Increaser — Baking Soda",
    price: "$24.99 per 10 lbs",
    category: "Balancers",
    badge: "Coastal Essential",
    description: "Raises total alkalinity to buffer pH changes. Especially important in Georgia's variable rainfall.",
    verdict: "The shock absorber that keeps pH from bouncing all over the place.",
    whatItDoes: "Raises total alkalinity to create a buffer that resists pH swings. Without adequate alkalinity, pH becomes unstable — every rain, every chemical addition causes wild fluctuations. Proper alkalinity makes pH manageable.",
    whenYouWillSeeThis: {
      frequency: "Several times per season",
      explanation: "Alkalinity drops from heavy rainfall, acid overuse, or certain fill water types. You'll see this when testing shows TA below 80 ppm."
    },
    benefits: [
      "pH stabilization — prevents wild pH swings",
      "Protects equipment — stable pH means less corrosion and scale",
      "Reduces chemical use — stable pH means less acid/base corrections",
      "Same as baking soda — you're paying for bulk pricing and accurate dosing"
    ],
    whatIfWeSkipIt: "Low alkalinity makes pH impossible to stabilize. You'll see pH swing from 7.2 to 8.0 in days, requiring constant acid additions that drop alkalinity further.",
    pricing: {
      model: "left-on-site",
      leftOnSiteDetails: { unit: "10-pound container", pricePerRestock: 24.99, typicalDuration: "2-4 months" }
    },
    faqs: [
      { question: "Is this just baking soda?", answer: "Yes, same chemical. We buy in bulk and dose accurately based on your water test. You're welcome to supply your own — just let your tech know." },
      { question: "Why does alkalinity drop?", answer: "Heavy rain dilutes it. Muriatic acid lowers it over time. Some fill water is naturally low. In Georgia's climate, alkalinity maintenance is ongoing." },
      { question: "Can't I just add more soda ash instead?", answer: "Soda ash raises pH faster than alkalinity. Sodium bicarbonate raises alkalinity with minimal pH impact. Different tools for different problems." },
      { question: "How long does it take to work?", answer: "Alkalinity rises within 24 hours of addition. We typically verify the adjustment on the next visit." }
    ]
  },
  "cyanuric-acid": {
    id: "cyanuric-acid",
    name: "Cyanuric Acid",
    scientificName: "Stabilizer — Conditioner",
    price: "$34.99 per 7 lbs",
    category: "Balancers",
    description: "Protects chlorine from UV degradation. Critical in outdoor pools but requires careful monitoring.",
    verdict: "The sunscreen for your chlorine — prevents UV from destroying it in hours.",
    whatItDoes: "Bonds with chlorine to shield it from UV degradation. Without stabilizer, Georgia sun destroys chlorine in 2-3 hours. With proper CYA (30-50 ppm), chlorine lasts days instead of hours.",
    whenYouWillSeeThis: {
      frequency: "Rarely — once or twice per season",
      explanation: "Cyanuric acid doesn't degrade or evaporate — it only leaves through water loss. You'll see this after significant dilution from heavy rain, splash-out, or a partial drain."
    },
    benefits: [
      "Massive chlorine savings — reduces consumption by 60-70%",
      "Long-lasting — doesn't break down or evaporate",
      "Universal compatibility — works with all chlorine types",
      "Outdoor essential — outdoor pools can't maintain chlorine without it"
    ],
    whatIfWeSkipIt: "Without stabilizer, chlorine costs skyrocket as UV burns through it in hours. In summer, you'd need 3-4x as much chlorine.",
    pricing: {
      model: "left-on-site",
      leftOnSiteDetails: { unit: "7-pound container", pricePerRestock: 34.99, typicalDuration: "6-12 months" }
    },
    faqs: [
      { question: "Can you have too much stabilizer?", answer: "Yes. Above 80 ppm, chlorine becomes 'locked' — chemically present but too sluggish to sanitize effectively. That's why we test regularly." },
      { question: "How do you fix over-stabilization?", answer: "Partial drain and refill. CYA doesn't break down, so the only fix is dilution." },
      { question: "Do I need this if I have a salt system?", answer: "Yes. Salt cells generate chlorine, but UV still destroys it without stabilizer." },
      { question: "Why is this so expensive compared to other chemicals?", answer: "Because it lasts 6-12 months and saves you hundreds in chlorine costs. One $35 addition prevents $300+ in extra chlorine consumption." }
    ]
  },
  "calcium-chloride": {
    id: "calcium-chloride",
    name: "Calcium Chloride",
    scientificName: "Calcium Hardness Increaser",
    price: "$27.99 per 10 lbs",
    category: "Balancers",
    description: "Prevents corrosive water conditions that can damage plaster, grout, and equipment.",
    verdict: "The shield that stops soft water from eating your pool's surfaces.",
    whatItDoes: "Raises calcium hardness to prevent aggressive water from dissolving calcium out of plaster, grout, and tile. Soft water is chemically hungry — it will pull calcium from wherever it can find it.",
    whenYouWillSeeThis: {
      frequency: "Varies by location — monthly to rarely",
      explanation: "Depends entirely on your fill water source. Some areas have naturally hard water and never need this. Others with soft well water need regular additions."
    },
    benefits: [
      "Surface protection — prevents etching and pitting of plaster",
      "Equipment longevity — reduces corrosion of heat exchangers and metal fittings",
      "Grout preservation — keeps tile grout from dissolving prematurely",
      "Cost-effective prevention — pennies now vs thousands in resurfacing later"
    ],
    whatIfWeSkipIt: "Soft water etches plaster, creates a rough surface texture, dissolves grout between tiles, and corrodes metal fixtures. By year two you're looking at expensive repairs that calcium chloride would have prevented.",
    pricing: {
      model: "left-on-site",
      leftOnSiteDetails: { unit: "10-pound container", pricePerRestock: 27.99, typicalDuration: "3-6 months" }
    },
    faqs: [
      { question: "How do I know if I need this?", answer: "We test calcium hardness at every visit. Ideal range is 200-400 ppm. Below 200, we add calcium chloride." },
      { question: "What if calcium gets too high?", answer: "Above 400 ppm, you risk scaling. High calcium requires dilution through partial drain and refill." },
      { question: "Will this make my water cloudy?", answer: "Not when added correctly. We dissolve it in a bucket before adding to avoid localized supersaturation." },
      { question: "Do saltwater pools need this?", answer: "Yes. Salt cells don't add calcium. If your fill water is soft, you'll need calcium chloride regardless of sanitation method." }
    ]
  },
  "no-mor-problems": {
    id: "no-mor-problems",
    name: "No Mor Problems",
    scientificName: "Polyquat Algaecide — 60% concentration",
    price: "$16.99 per qt",
    category: "Preventative Care",
    badge: "Professional Grade",
    timing: "Weekly",
    description: "Non-foaming, broad-spectrum algae prevention. Compatible with all sanitizer types.",
    verdict: "Prevention that costs pennies compared to curing an algae outbreak.",
    whatItDoes: "Creates a barrier that prevents algae spores from attaching to pool surfaces and establishing colonies. Chlorine kills algae, but algaecide prevents it from ever getting started.",
    whenYouWillSeeThis: {
      frequency: "Weekly during service visits",
      explanation: "Algaecide is preventive maintenance, not reactive treatment. Small weekly doses keep algae from ever establishing. You'll see it on every service bill during algae season (April-October)."
    },
    benefits: [
      "Non-foaming — won't create surface foam or bubbles",
      "Chlorine-compatible — works alongside all sanitizer types",
      "Cost-effective prevention — $3-5/visit vs $100+ treatment visit",
      "Professional strength — 60% concentration vs 10-30% retail products"
    ],
    whatIfWeSkipIt: "One algae outbreak requires shock treatments, extra brushing, filter cleaning, and possibly multiple visits — easily $150-300 in labor and chemicals. Weekly algaecide costs $15-20/month.",
    pricing: {
      model: "per-use",
      perUseDetails: { unit: "fluid ounce", billingIncrement: 2, pricePerUnit: 0.53, calculatorFormula: { divider: 2500, roundTo: 2 } }
    },
    faqs: [
      { question: "Doesn't chlorine kill algae?", answer: "Yes, but algae can establish faster than chlorine can kill it in warm conditions. Algaecide is a second line of defense." },
      { question: "Can I skip this to save money?", answer: "You can, but one algae outbreak typically costs more than a full season of weekly prevention." },
      { question: "Why does this need to be added weekly?", answer: "Algaecide breaks down over time from sun exposure and oxidation. Weekly dosing maintains a protective concentration." },
      { question: "Will this hurt my pool or equipment?", answer: "No. Polyquat algaecides are non-staining, non-foaming, and compatible with all surfaces and equipment." }
    ]
  },
  "phosphate-remover": {
    id: "phosphate-remover",
    name: "Phosphate Remover",
    scientificName: "Lanthanum Compound",
    price: "$24.99 per qt",
    category: "Preventative Care",
    badge: "Coastal Defense",
    description: "Removes phosphates from fertilizer runoff and organic debris. Starves algae of nutrients.",
    verdict: "Removes the fertilizer so your pool doesn't turn into a garden.",
    whatItDoes: "Binds to phosphates and precipitates them out so your filter can remove them. Phosphates are nutrients that fuel algae growth — they enter through fertilizer runoff, pollen, leaves, and some tap water.",
    whenYouWillSeeThis: {
      frequency: "Monthly during growing season",
      explanation: "Phosphate levels spike in spring/summer when landscaping fertilizer washes into pools from rain."
    },
    benefits: [
      "Algae prevention — removes nutrients algae need to thrive",
      "Reduces chlorine demand — less algae means less oxidation work",
      "Targets root cause — treats the source, not just symptoms",
      "Safe for all surfaces — won't stain or damage pool materials"
    ],
    whatIfWeSkipIt: "High phosphates make algae persistent and aggressive. You'll fight recurring algae blooms despite good chlorine levels and wonder why your pool won't stay clear.",
    pricing: {
      model: "per-use",
      perUseDetails: { unit: "fluid ounce", billingIncrement: 4, pricePerUnit: 0.78, calculatorFormula: { divider: 1650, roundTo: 4 } }
    },
    faqs: [
      { question: "What are phosphates and where do they come from?", answer: "Phosphates are nutrients found in fertilizers, detergents, and organic matter. They enter pools through fertilizer runoff, leaves, pollen, and sometimes tap water." },
      { question: "Will this make my water cloudy?", answer: "Temporarily. As the product binds to phosphates, you may see cloudiness for 24-48 hours while your filter removes the precipitated material." },
      { question: "Can't I just add more chlorine instead?", answer: "Chlorine kills algae, but doesn't remove the nutrients that help it grow. Phosphate removal addresses the cause." },
      { question: "How do you know if I need this?", answer: "We test phosphate levels with a meter. Above 500 ppb, we recommend treatment." }
    ]
  },
  "enzyme-treatment": {
    id: "enzyme-treatment",
    name: "Enzyme Treatment",
    scientificName: "Natural Pool Enzymes",
    price: "$18.99 per qt",
    category: "Preventative Care",
    description: "Breaks down oils, lotions, and organic waste. Reduces scum line and filter load.",
    verdict: "The natural cleaner that digests what your filter can't catch.",
    whatItDoes: "Contains natural enzymes that break down non-living organic waste — sunscreen, body oils, lotions, pollen, pet dander. These organics create scum lines, make water feel slick, and load up your filter.",
    whenYouWillSeeThis: {
      frequency: "Weekly during heavy use",
      explanation: "You'll see enzymes during swim season, especially if your pool gets heavy use or you have trees nearby."
    },
    benefits: [
      "Natural solution — enzymes are proteins, not harsh chemicals",
      "Reduces scum buildup — digests oils before they form waterline rings",
      "Extends filter life — less organic load means less filter clogging",
      "Swim-safe immediately — no wait time or chemical additions"
    ],
    whatIfWeSkipIt: "Scum lines build up at the waterline, water feels slightly oily or slick, filter clogs faster requiring more frequent cleaning. Not dangerous — just unpleasant.",
    pricing: {
      model: "per-use",
      perUseDetails: { unit: "fluid ounce", billingIncrement: 2, pricePerUnit: 0.59, calculatorFormula: { divider: 2500, roundTo: 2 } }
    },
    faqs: [
      { question: "Are enzymes safe?", answer: "Completely. Enzymes are natural proteins that break down organic matter. They're non-toxic, biodegradable, and safe for swimmers, pets, and the environment." },
      { question: "How are enzymes different from oxidizers?", answer: "Oxidizers chemically blast organics. Enzymes naturally digest them over time. Oxidizers are for quick heavy-duty cleaning. Enzymes are for continuous low-level maintenance." },
      { question: "Do I really need this?", answer: "Need? No. Benefit from? If you use your pool frequently, have trees nearby, or fight scum line buildup — yes." },
      { question: "Will this affect my other chemistry?", answer: "No. Enzymes work independently of chlorine, pH, and other chemicals." }
    ]
  },
  "clarifier": {
    id: "clarifier",
    name: "Clarifier",
    scientificName: "Polymer Coagulant",
    price: "$14.99 per qt",
    category: "Preventative Care",
    description: "Coagulates fine particles for filter removal. Creates crystal-clear water in 24-48 hours.",
    verdict: "Makes the invisible visible so your filter can remove it.",
    whatItDoes: "Binds microscopic particles together into clusters large enough for your filter to catch. Dust, pollen, algae spores, and other fine particles are too small to filter — they pass right through. Clarifier coagulates them into filterable size.",
    whenYouWillSeeThis: {
      frequency: "As needed — typically monthly",
      explanation: "You'll see clarifier when water looks dull or hazy despite good chemistry. Common after wind storms, pollen season, or when fine dust enters the pool."
    },
    benefits: [
      "Fast results — noticeable improvement in 24-48 hours",
      "Filter-friendly — helps filter work more efficiently",
      "Chemical-free solution — doesn't alter water balance",
      "Safe for all surfaces — no staining or surface reactions"
    ],
    whatIfWeSkipIt: "Water stays dull and lackluster instead of sparkling clear. No safety issue — just aesthetic.",
    pricing: {
      model: "per-use",
      perUseDetails: { unit: "fluid ounce", billingIncrement: 2, pricePerUnit: 0.47, calculatorFormula: { divider: 3300, roundTo: 2 } }
    },
    faqs: [
      { question: "Why not just shock the pool instead?", answer: "Shock treats organic contamination and bacteria. Clarifier handles mechanical cloudiness — dust, pollen, fine particles. Different problems need different solutions." },
      { question: "How long until I see results?", answer: "24-48 hours as particles coagulate and filter removes them. Run your filter continuously during this period for best results." },
      { question: "Can you use too much clarifier?", answer: "Yes. Over-application makes water cloudy instead of clear. That's why we dose based on pool volume and condition." },
      { question: "Will this fix green water?", answer: "No. Green water is algae, which requires chlorine to kill. Clarifier handles fine particles, not living organisms." }
    ]
  }
};

export const sanitizerIds = ["liquid-chlorine", "cal-hypo-shock", "chlorine-free-oxidizer"];
export const balancerIds = ["muriatic-acid", "soda-ash", "sodium-bicarbonate", "cyanuric-acid", "calcium-chloride"];
export const preventativeIds = ["no-mor-problems", "phosphate-remover", "enzyme-treatment", "clarifier"];

export function getAllChemicals(): Chemical[] {
  return Object.values(chemicals);
}

export function getChemical(id: string): Chemical | undefined {
  return chemicals[id];
}
