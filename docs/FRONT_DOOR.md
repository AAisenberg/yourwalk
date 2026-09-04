# Front door — yourwalk.au

**Status:** Spec (lean) — 4 Sep 2026. Page not built.  
**Host:** `yourwalk.au` (ADR-012). `www.yourwalk.au` redirects here.  
**Planner:** `app.yourwalk.au` (already live).  
**Audience:** Press, partners, Casey officers, Nikki briefing media. Not a login. Not the resident planner.

Product name: **YourWalk** (one word). Australian English. WCAG 2.1 AA. No em dashes in copy.

## Job

Give someone who heard about YourWalk a short, honest page they can open and share. Primary action is **Find your walk** on `app.yourwalk.au`. The apex must not become a second copy of the planner and must not put a login in front of anyone.

YourGround’s public site is the nearest CrowdLab / XYX pattern (logo, partners, purpose, how to take part). YourWalk is a different product: Casey walking **conditions**, not crowdmapping “safe / unsafe” stories. Do not copy YourGround’s email signup, submission ask, or “feel safe” framing.

## Locked (do not reopen unless you say so)

- One Vercel project (`yourwalk`). Host-based routing: apex and `www` serve this page; `app.` serves today’s `/`.
- No Clerk. No accounts on the apex (ADR-004 lean; L1 later).
- No `@yourwalk.au` mail. Contact stays existing CrowdLab and Monash XYX Lab addresses.
- No `/lab`, no dashboard, no Mapbox on this page (ADR-002 still applies if a later sitting adds a decorative map; first cut is static).
- Visual system tokens only ([`RESIDENT_VISUAL_SYSTEM.md`](RESIDENT_VISUAL_SYSTEM.md)). No new brochure palette.
- Partner marks (Monash XYX Lab, CrowdLab) live here or in About. Not on the planner sheet.
- **Casey logo is never used, under any circumstances.** City of Casey is named in type only (decided 4 Sep 2026; closes FD-2 for Casey).

## Visual concept: Day / Night (decided 4 Sep 2026)

The front door plays on the product's signature idea: the same walk reads differently by day and after dark. The page itself switches between the two looks, aligned to the resident app tokens.

- **Two chrome states, not four.** Day surface (`--yw-day-surface`, navy CTA) and night surface (`--yw-night-surface` / `--yw-night-panel`, blue CTA), exactly per the visual system. Dawn and dusk exist only as Mapbox basemap `lightPreset` values in the planner; the front door has no map in the first cut, so it inherits the app rule that chrome has two states. If a later sitting adds a decorative map, the four basemap looks come with it (ADR-002 applies).
- **Auto from Casey civil twilight.** On load, the page picks Day or Night from the same ADR-009 civil twilight logic the planner uses. A visitor opening the link from an evening news story lands on the night look without touching anything.
- **Manual switch in the header,** mirroring the app's compact Day / Night control (same `MdWbSunny` / `MdNightlight` icons). The switch is the page's one interactive flourish and doubles as a live product demo.
- **Hero screenshot follows the state.** Day shows [`resident-day-plan.png`](screenshots/resident-ux/resident-day-plan.png) or [`resident-day-results.png`](screenshots/resident-ux/resident-day-results.png) in a phone frame; Night shows [`resident-night-plan.png`](screenshots/resident-ux/resident-night-plan.png). Real screenshots only; no invented UI.
- **Transition:** the app's ~200ms surface colour transition on chrome only. Honour `prefers-reduced-motion` (no transition, state still switches).
- Plus Jakarta Sans throughout. No purple gradients, cream brochure looks, or neon glows (visual system prohibitions apply to this page too).

## Page sections (first cut)

One scrolling page. Mobile first. Quiet Beta if we mention the planner is in pilot.

### 1. Hero

- Mark + **YourWalk** wordmark (navy on day surface, white on night surface).
- Day / Night switch in the header (see Visual concept above). Page look follows the state.
- Phone-framed planner screenshot that swaps with the Day / Night state.
- One line: City of Casey Connecting Grant pilot.
- Supporting line from the in-app About (do not invent a new slogan): residents find walks that fit what matters (smoother footpaths, more shade, better-lit streets after dark). Not just the shortest way.
- Primary button: **Find your walk** → `https://app.yourwalk.au`
- Secondary (text): How it works (anchor to section 3).

### 2. What this is / is not

**Is:** a Casey planner that ranks walks using Council asset data and OpenStreetMap. Day Index and Night Index (methodology v1.1). Higher score = better walking conditions (lower vulnerability).

**Is not:**

- A safety guarantee or crime prediction.
- Turn-by-turn navigation (Open in Maps later; their router wins).
- A login or account wall.
- Graffiti as crime data (environmental-order proxy only).

### 3. How it works

Reuse the three About bullets:

1. Casey footpaths are scored street by street: surface, continuity, tree canopy, lighting, and more.
2. Plan A to B or a loop, set what matters most, and YourWalk ranks options for day or night.
3. Scores describe conditions in the data. More Council datasets are on the way. They are not a safety guarantee.

Do not add observation-submission copy. Submissions are not this phase (N4 later).

### 4. Partners

Plain prose, then marks (decided 4 Sep 2026):

- City of Casey (Connecting Grant pilot): **name in type only. The Casey logo is never used.**
- CrowdLab (delivery; CrowdSpot Pty Ltd): logo available.
- Monash University XYX Lab (methodology): Monash and XYX Lab logos available.

Logo files are not yet in the repo; add to `web/public/brand/partners/` before build (SVG preferred, PNG fallback). Until a file lands, name the partner in type. Do not invent lockups. Partner marks must work on both day and night surfaces (supply or derive a light-surface and dark-surface variant; if only one exists, place marks on a neutral card).

### 5. Timeline

Facts only. No invented launch dates.

| When | What |
|------|------|
| 3 Jul 2026 | Methodology v1.1 accepted with XYX Lab |
| 15 Jul 2026 | Phase C app build started |
| Jul–Aug 2026 | Hybrid routing and resident planner on Vercel |
| 4 Sep 2026 | Planner live at `app.yourwalk.au` (beta) |

Update this table when a public milestone actually happens. Do not promise Council-wide launch or multi-LGA.

### 6. Privacy

Anonymous by default: no account, no sign-in, no tracking. Locate stays on the device. Detail stays in the planner About.

### 7. Contact

Press and partners: CrowdLab and Monash XYX Lab via existing addresses (Anthony / Nikki as the people they already use). Do not publish `people@yourwalk.au` or `yourwalk@casey.vic.gov.au` until those inboxes exist. COMMS still has support email TBD; this page does not invent one.

### 8. Footer

YourWalk · Casey pilot · links to `app.yourwalk.au` · methodology path for specialists (`docs/VULNERABILITY_INDEX.md` is repo-only; do not dump the full index on the page). Optional: “Not a safety guarantee.”

## Metadata and sharing (first cut, lean)

The job is a page press and partners can share, so the share card ships with the page. Full SEO work is later; this is the floor:

- Title: `YourWalk: find your walk in Casey` (or similar; pilot framing, no slogan invention).
- Description: one sentence from the About copy, naming the City of Casey Connecting Grant pilot. No safety language.
- Open Graph / Twitter card image: mark + wordmark on the day surface (or a day/night split), built from tokens. Not a raw screenshot with UI chrome.
- Canonical `https://yourwalk.au`, `robots.txt` allowing the apex, minimal sitemap.
- Unknown apex paths (for example `yourwalk.au/design`) return 404 or redirect to the front door; planner routes never serve on the apex host.

Out of scope for first cut: structured data beyond Organization basics, search console tuning, blog-style content.

## Copy sources (do not invent)

| Need | Use |
|------|-----|
| Purpose and how it works | In-app About (`ResidentApp` welcome) |
| Hosts | [`DECISIONS.md`](DECISIONS.md) ADR-012 |
| Visuals | [`RESIDENT_VISUAL_SYSTEM.md`](RESIDENT_VISUAL_SYSTEM.md) |
| Goals / non-goals | [`PRD.md`](PRD.md) (CEO-readable; no methodology rewrite) |
| Engagement channels | [`COMMS_AND_ENGAGEMENT.md`](COMMS_AND_ENGAGEMENT.md) (Council page, posters). This front door is the CrowdLab-owned public URL; it does not replace a Council CMS page |

## Acceptance criteria (when we build)

**Given** a journalist or partner opens `https://yourwalk.au`  
**When** the page loads  
**Then** they see YourWalk, Casey pilot, partners, and a **Find your walk** button to `app.yourwalk.au`  
**And** there is no login  
**And** copy does not promise safety or crime prediction  
**And** there is no email capture  

**Given** they tap **Find your walk**  
**When** they arrive on `app.yourwalk.au`  
**Then** they see today’s resident planner with no extra wall  

**Given** they open `https://www.yourwalk.au`  
**When** DNS and Vercel redirects are live  
**Then** they end on `https://yourwalk.au`  

**Given** the page is opened after Casey civil dusk  
**When** no control is touched  
**Then** the night look renders (night surfaces, blue CTA, night screenshot)  
**And** the header Day / Night switch swaps chrome, CTA colour, and hero screenshot together  
**And** with `prefers-reduced-motion` the switch still works without the transition  

## Out of scope (first cut)

- Clerk, accounts, newsletter, Squarespace Email
- Council insights (`dashboard.yourwalk.au`)
- `/lab`
- Blog, newsroom, CMS
- Map embed or MapLibre
- Translations beyond Australian English
- QR artwork (COMMS posters later; they can point here or at `app.`)
- Shareable walk links (planner work, FLOW 02 OQ-4)

## Build notes (after you say go on the page)

1. Static route in the same Next app (for example `src/app/front-door/page.tsx`) plus host middleware: `yourwalk.au` / `www` → front door; `app.yourwalk.au` → `/`.
2. Do not attach the apex in Vercel until this page exists. Then add `yourwalk.au` + `www` and redirect www → apex. Squarespace: A `@` and CNAME `www` (not the Vercel preset that also points the planner at the apex).
3. Tokens and type from the visual system. CTA navy (day) / blue (night). Mark from `web/public/brand/yourwalk-mark.svg`.
4. Add Monash / XYX Lab / CrowdLab logo files to `web/public/brand/partners/` before placing marks. Casey stays type-only.
5. Day / Night state: reuse the planner's Casey civil twilight helper for the initial state; manual switch overrides for the session. Client-side only; no persistence, no tracking.
6. Motion honours `prefers-reduced-motion`.

## Open questions

| ID | Question | Options | Decide when |
|----|----------|---------|-------------|
| FD-1 | Exact press contact line | A. “Contact CrowdLab” with Anthony’s existing address. B. XYX media via Nikki only. C. Both, labelled. | Before first publish |
| FD-2 | Partner logos | ~~A. Names only. B. Logos once we have files and permission.~~ **Decided 4 Sep 2026:** Casey never (type only); Monash, XYX Lab, CrowdLab logos once files land in `web/public/brand/partners/`. | Decided |
| FD-3 | Council CMS | A. This URL is the public story. B. Casey page also exists and links here. | When Council comms ask |
| FD-4 | Analytics on the apex | A. None (page copy says no tracking, literally true). B. Cookieless Vercel Web Analytics (anonymous, but soften the privacy line to “no cookies, no accounts, nothing identifies you”). | Before first publish; privacy copy and instrumentation must agree |

Do not reopen the host table or add mail to answer these.

## Trace

ADR-012 · [`RESIDENT_UX_NEXT.md`](RESIDENT_UX_NEXT.md) · backlog X7 (apex DNS) / X8 (this page) · planner About
