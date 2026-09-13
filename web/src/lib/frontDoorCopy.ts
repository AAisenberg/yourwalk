/**
 * Public copy for yourwalk.au (docs/FRONT_DOOR.md).
 * Holding phase (Sep 2026): Age landing + waitlist. No planner links.
 * Long explainer copy stays below for when FRONT_DOOR_PHASE is "explainer".
 */

/** Holding = Age / waitlist page. Explainer = long page (hidden). */
export const FRONT_DOOR_PHASE: "holding" | "explainer" = "holding";

/**
 * Google Form that writes to a Sheet (Responses → Link to Sheets).
 * Viewform URL, not the raw spreadsheet (the sheet must stay private).
 */
export const WAITLIST_FORM_URL =
  process.env.NEXT_PUBLIC_WAITLIST_FORM_URL?.trim() ?? "";

/** Optional. Prefills the email question, e.g. "123456789". */
export const WAITLIST_FORM_ENTRY =
  process.env.NEXT_PUBLIC_WAITLIST_FORM_ENTRY?.trim() ?? "";

export const HERO = {
  title: "Find your walk",
  lead:
    "YourWalk helps local residents find walking routes that fit what matters: smoother footpaths, more shade on hot days, or better-lit streets after dark. Not just the shortest way.",
  holdingLead:
    "First pilot is in the City of Casey. Leave your email and we will send updates as the project rolls out.",
  primaryCta: "Get updates",
  aside: "Email only. No account.",
} as const;

export const PARTNERS = {
  id: "partners",
  title: "Who’s behind it",
  support: "Proudly supported by the City of Casey",
  lead:
    "YourWalk is a collaboration between CrowdLab and Monash University’s XYX Lab.",
  orgs: [
    {
      id: "crowdlab",
      name: "CrowdLab",
      role: "CrowdSpot Pty Ltd",
      src: "/brand/partners/crowdlab-mark.svg",
    },
    {
      id: "monash-xyx",
      name: "Monash University XYX Lab",
      role: "Monash University",
      src: "/brand/partners/monash-university.png",
      srcSecondary: "/brand/partners/xyx-lab.svg",
    },
  ],
} as const;

export const WAITLIST = {
  id: "updates",
  title: "Stay in the loop",
  body: "We will only use your email for YourWalk pilot updates. You can ask to be removed at any time.",
  emailLabel: "Email",
  emailPlaceholder: "you@example.com",
  submit: "Get updates",
  thanks: "Thanks. We will be in touch as the pilot rolls out.",
  missingForm:
    "Add NEXT_PUBLIC_WAITLIST_FORM_URL in web/.env.local (Google Form link).",
} as const;

export const FOOTER = {
  product: "YourWalk",
  pilot: "Pilot in the City of Casey",
  caveat: "Scores describe walking conditions. Not a safety guarantee.",
} as const;

// --- Explainer-only (unused while holding) ---

export const PLANNER_URL = "https://app.yourwalk.au";

export const EXPLAINER_HERO = {
  eyebrow: "Proudly supported by the City of Casey",
  primaryCta: "Find your walk",
  secondaryCta: "Why it exists",
  aside: "Free to use. No account, no sign-in.",
} as const;

export const EXPLAINER_FOOTER = {
  method: "Methodology lives in the project repository",
} as const;

export const EXPLAINER_PARTNERS = {
  supportNote: "A Connecting Grant pilot.",
} as const;

export const PROBLEM = {
  id: "why",
  title: "The same street can be two different walks",
  lead:
    "A walk that feels fine in the morning can be a different proposition after dark. A path that works for an able-bodied adult may not work with a pram, a wheelchair, or a child on a scooter. A pleasant spring street can be exposed and hot in summer.",
  body:
    "Residents in Casey have not had a simple way to bring those conditions together when they plan a walk. Council has not had a shared picture of where the walking network succeeds or fails across footpaths, shade, and lighting.",
  close:
    "YourWalk is the Casey pilot that starts to close that gap. It ranks walks from the conditions on the ground, then lets you choose.",
} as const;

export const SOLUTION = {
  title: "Rank the walk, not only the distance",
  body:
    "YourWalk scores Casey footpaths street by street from Council asset data and OpenStreetMap. You plan an A to B walk or a loop, set what matters most, and the planner ranks options for a day walk or a night walk.",
  proof:
    "A higher score means better walking conditions. The method is a collaboration between CrowdLab and Monash University’s XYX Lab, accepted for this pilot in July 2026.",
} as const;

export const HOW = {
  id: "how-it-works",
  title: "How it works",
  steps: [
    {
      title: "Streets are scored",
      body: "Casey footpaths are scored street by street from Council asset data and OpenStreetMap: surface, continuity, tree canopy, lighting and more.",
    },
    {
      title: "You say what matters",
      body: "Plan an A to B walk or a loop from home, set what matters most, and choose day or night walking.",
    },
    {
      title: "Walks are ranked",
      body: "YourWalk ranks the options. Scores describe conditions in the data, with more Council datasets on the way.",
    },
  ],
} as const;

export const SCORES = {
  id: "scores",
  title: "Day walks and night walks are scored differently",
  lead:
    "There is no single score for every hour. YourWalk uses two indexes so a lunchtime walk and an after-dark walk are judged on what actually changes.",
  day: {
    title: "Day walks",
    mix: "Footpath accessibility 60% · heat and shade 40%",
    body: "Heat, tree canopy, drinking fountains and seats sit with the daytime score. Accessibility is still the larger share: surface, width, continuity, gradient, and crossings.",
  },
  night: {
    title: "Night walks",
    mix: "Footpath accessibility 60% · lighting after dark 40%",
    body: "Street lighting sits with the night-time score. The same accessibility foundation still carries most of the weight, because a broken or missing path is a problem at any hour.",
  },
  shared:
    "Toilets and dog bag dispensers can show on the map when you ask for them. They do not change the score. Scores describe conditions in the data. They are not a promise that a walk will feel safe.",
  research:
    "The index covers tens of thousands of Casey footpath segments. Specialists can read the full method in the project repository, docs/VULNERABILITY_INDEX.md (v1.1).",
} as const;

export const TIMELINE = {
  id: "pilot",
  title: "The pilot so far",
  rows: [
    { when: "3 Jul 2026", what: "Methodology v1.1 accepted with Monash XYX Lab" },
    { when: "15 Jul 2026", what: "Phase C app build started" },
    { when: "Jul–Aug 2026", what: "Hybrid routing and resident planner on Vercel" },
    { when: "4 Sep 2026", what: "Planner live at app.yourwalk.au (beta)" },
  ],
} as const;

export const MEDIA = {
  id: "media",
  title: "For media",
  lead:
    "This page is the CrowdLab-owned public story. The planner people should try is at app.yourwalk.au. There is no login and no email list.",
  factsTitle: "Facts you can use",
  facts: [
    "Proudly supported by the City of Casey. A Connecting Grant pilot.",
    "A collaboration between CrowdLab and Monash University’s XYX Lab.",
    "Two scores: a Day Index and a Night Index (methodology v1.1).",
    "Higher score means better walking conditions. Not a safety guarantee.",
  ],
  contactTitle: "Contact",
  contact:
    "Reach CrowdLab or Monash University’s XYX Lab through your existing contacts.",
  privacyTitle: "Privacy",
  privacy:
    "Anonymous by default: no account, no sign-in, no tracking. If you use the locate button in the planner, your position stays on your device.",
} as const;
