# Front door — yourwalk.au

**Status:** Holding phase (13 Sep 2026). Age landing + waitlist. Long explainer hidden.  
**Host:** `yourwalk.au` (ADR-012). `www.yourwalk.au` redirects here.  
**Planner:** `app.yourwalk.au` (already live).  
**Audience:** Press, partners, Casey officers, Nikki briefing media. Not a login. Not the resident planner.

Product name: **YourWalk** (one word). Australian English. WCAG 2.1 AA. No em dashes in copy.

## Job

Give someone who heard about YourWalk (including from The Age, 22 Sep 2026) a short, honest page. Primary action is **Get updates** (email via Google Form → private Sheet). Do not link to `app.yourwalk.au` in this phase. The long explainer stays in code (`FRONT_DOOR_PHASE`) and is hidden. No login.

YourGround’s public site is the nearest CrowdLab / XYX pattern (logo, partners, purpose, how to take part). YourWalk is a different product: Casey walking **conditions**, not crowdmapping “safe / unsafe” stories. Do not copy YourGround’s email signup, submission ask, or “feel safe” framing.

## Locked (do not reopen unless you say so)

- One Vercel project (`yourwalk`). Host-based routing: apex and `www` serve this page; `app.` serves today’s `/`.
- No Clerk. No accounts on the apex (ADR-004 lean; L1 later).
- No `@yourwalk.au` mail. Waitlist uses a Google Form that writes to a **private** Sheet (not a public spreadsheet of addresses).
- No planner links on the holding page.
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
- **Transition:** front-door tokens interpolate (~560ms ease) so chrome, cards, type, and CTA colour ease together. Hero screenshots crossfade (~480ms). Honour `prefers-reduced-motion` (no transition, state still switches).
- Plus Jakarta Sans throughout. No purple gradients, cream brochure looks, or neon glows (visual system prohibitions apply to this page too).

## Page sections

One scrolling page. Mobile first. Quiet Beta. Copy lives in `web/src/lib/frontDoorCopy.ts`. Problem / solution framing, not a “what it is not” list. Caveats stay woven into the scores section and footer.

Full-bleed section bands (tokens only) so the page is not one flat colour:

| Band | Day | Night |
|------|-----|-------|
| Hero, How, Timeline | `--yw-day-surface` | `--yw-night-surface` |
| Why, Partners, Media | white | `--yw-night-panel` |
| Scores | teal wash | deeper night wash |
| Close CTA | navy | blue |

### 1. Hero

- Header: mark + **YourWalk** + Day / Night switch only. No Updates / Partners nav. (Why / How / Scores / Media stay on the hidden explainer only.)
- Phone-framed planner screenshot that swaps with the Day / Night state (`web/public/front-door/planner-*.png`).
- No Casey eyebrow and no Connecting Grant line in the hero.
- Supporting line from the in-app About (do not invent a new slogan): **local residents** find walks that fit what matters (smoother footpaths, more shade, better-lit streets after dark). Not just the shortest way.
- Place line: First pilot is in the City of Casey. Leave your email and we will send updates as the project rolls out.
- Holding primary: **Get updates** (Google Form → private Sheet). No `app.yourwalk.au` link.

### 2. Why it exists (problem)

PRD problem, in public language: the same street can be two different walks (morning vs after dark, mobility, heat). Residents have not had a way to bring those conditions together. Council has not had a shared picture of where the network succeeds or fails.

### 3. Rank the walk (solution)

Casey planner ranks A to B or loop options from Council asset data and OpenStreetMap. Higher score = better walking conditions. Method is a CrowdLab and Monash University XYX Lab collaboration, accepted July 2026.

### 4. How it works

Three steps with short titles, bodies from the in-app About:

1. Streets are scored
2. You say what matters
3. Walks are ranked

Do not add observation-submission copy. Submissions are not this phase (N4 later).

### 5. How a walk is scored (plain-language methodology)

Two indexes, not one. Day = Accessibility 60% + Heat and shade 40%. Night = Accessibility 60% + Lighting after dark 40%. Overlays (toilets, dog bags) can show on the map and do not change the score. Scores describe conditions in the data; they are not a promise that a walk will feel safe. Specialists: `docs/VULNERABILITY_INDEX.md` v1.1 in the repository. Do not dump the full index or a graffiti/crime explainer.

### 6. Partners

**Who’s behind it**, then the collaboration line, then two logo cards. **Proudly supported by the City of Casey** sits below the cards, in type. Connecting Grant is not on the public holding page unless Council later requires it (then under the Casey credit only). **Casey logo is never used.**

Two compact logo cards (marks only; no name or legal-entity line under them). Monash University and XYX Lab sit side by side in one card:

- CrowdLab marketing lockup
- Monash University + XYX Lab

Do not split “delivery” vs “methodology” as if only XYX owns the method. It is a full collaboration. Files live in `web/public/brand/partners/`: CrowdLab mark from the marketing site lockup, official Monash University mark, official XYX Lab word (recolored black for the white well). Do not invent lockups. Casey stays type-only.

### 7. Timeline

Facts only. No invented launch dates.

| When | What |
|------|------|
| 3 Jul 2026 | Methodology v1.1 accepted with XYX Lab |
| 15 Jul 2026 | Phase C app build started |
| Jul–Aug 2026 | Hybrid routing and resident planner on Vercel |
| 4 Sep 2026 | Planner live at `app.yourwalk.au` (beta) |

Update this table when a public milestone actually happens. Do not promise Council-wide launch or multi-LGA.

### 8. Media

A press band (not a newsroom). Facts they can use, existing-contact line, privacy. Do not invent emails or a media kit PDF until we have one.

### 9. Footer

Holding: YourWalk · Pilot in the City of Casey · Get updates · scores describe walking conditions, not a safety guarantee. Explainer (hidden): also names `app.yourwalk.au` and that methodology lives in the repository.

## Metadata and sharing (first cut, lean)

The job is a page press and partners can share, so the share card ships with the page. Full SEO work is later; this is the floor:

- Title: `YourWalk: find your walk in Casey` (or similar; pilot framing, no slogan invention).
- Description: one sentence from the About copy, naming the City of Casey as the first pilot. No grant-speak. No safety language.
- Open Graph / Twitter card image: mark + wordmark on the day surface (or a day/night split), built from tokens. Not a raw screenshot with UI chrome.
- Canonical `https://yourwalk.au`, `robots.txt` allowing the apex, minimal sitemap.
- Unknown apex paths (for example `yourwalk.au/design`) return 404 or redirect to the front door; planner routes never serve on the apex host.

Out of scope for first cut: structured data beyond Organization basics, search console tuning, blog-style content.

## Copy sources (do not invent)

| Need | Use |
|------|-----|
| Purpose and how it works | In-app About (`ResidentApp` welcome) |
| Problem / solution | [`PRD.md`](PRD.md) problem statement (plain language, no invented stats) |
| Day / Night scores | [`VULNERABILITY_INDEX.md`](VULNERABILITY_INDEX.md) v1.1, UX wording only |
| Hosts | [`DECISIONS.md`](DECISIONS.md) ADR-012 |
| Visuals | [`RESIDENT_VISUAL_SYSTEM.md`](RESIDENT_VISUAL_SYSTEM.md) |
| Goals / non-goals | [`PRD.md`](PRD.md) (CEO-readable; no methodology rewrite) |
| Engagement channels | [`COMMS_AND_ENGAGEMENT.md`](COMMS_AND_ENGAGEMENT.md) (Council page, posters). This front door is the CrowdLab-owned public URL; it does not replace a Council CMS page |

## Acceptance criteria (when we build)

**Given** a journalist or partner opens `https://yourwalk.au`  
**When** the page loads  
**Then** they see YourWalk, Casey pilot, partners, and a **Get updates** form  
**And** there is no login and no link to `app.yourwalk.au`  
**And** copy does not promise safety or crime prediction  

**Given** they submit a valid email and the Form URL is set  
**When** the form posts  
**Then** the address lands in the linked private Sheet  

**Given** they open `https://www.yourwalk.au`  
**When** DNS and Vercel redirects are live  
**Then** they end on `https://yourwalk.au`  

**Given** the page is opened after Casey civil dusk  
**When** no control is touched  
**Then** the night look renders (night surfaces, blue CTA, night screenshot)  
**And** the header Day / Night switch swaps chrome, CTA colour, and hero screenshot together  
**And** with `prefers-reduced-motion` the switch still works without the transition  

## Out of scope (first cut)

- Clerk, accounts, Squarespace Email, `@yourwalk.au` mail
- Planner links on the holding page (restore later via `FRONT_DOOR_PHASE`)
- Council insights (`dashboard.yourwalk.au`)
- `/lab`
- Blog, newsroom, CMS
- Map embed or MapLibre
- Translations beyond Australian English
- QR artwork (COMMS posters later; they can point here or at `app.`)
- Shareable walk links (planner work, FLOW 02 OQ-4)

## Build notes (after you say go on the page)

1. Static route in the same Next app (`src/app/front-door/page.tsx`) plus host routing in `src/proxy.ts` (Next 16 renamed middleware to proxy): `yourwalk.au` / `www` → front door; `app.yourwalk.au` → `/`.
2. Do not attach the apex in Vercel until this page exists. Then add `yourwalk.au` + `www` and redirect www → apex. Squarespace: A `@` and CNAME `www` (not the Vercel preset that also points the planner at the apex).
3. Tokens and type from the visual system. CTA navy (day) / blue (night). Mark from `web/public/brand/yourwalk-mark.svg`.
4. Add Monash / XYX Lab / CrowdLab logo files to `web/public/brand/partners/` before placing marks. Casey stays type-only.
5. Day / Night state: reuse the planner's Casey civil twilight helper for the initial state; manual switch overrides for the session. Client-side only; no persistence, no tracking.
6. Motion honours `prefers-reduced-motion`.
7. Waitlist: Google Form → Responses → Link to Sheets (keep the Sheet private). Default viewform and email entry id live in `frontDoorCopy.ts`. Override with `NEXT_PUBLIC_WAITLIST_FORM_URL` / `NEXT_PUBLIC_WAITLIST_FORM_ENTRY` only if the Form is replaced.

## Open questions

| ID | Question | Options | Decide when |
|----|----------|---------|-------------|
| FD-1 | Exact press contact line | A. “Contact CrowdLab” with Anthony’s existing address. B. XYX media via Nikki only. C. Both, labelled. | Before first publish |
| FD-2 | Partner logos | **Decided 4 Sep 2026:** Casey never (type only; “Proudly supported by the City of Casey”). CrowdLab marketing lockup and one Monash University XYX Lab lockup in `web/public/brand/partners/`. | Decided |
| FD-3 | Council CMS | A. This URL is the public story. B. Casey page also exists and links here. | When Council comms ask |
| FD-4 | Analytics on the apex | A. None. B. Cookieless Vercel Web Analytics (soften privacy line). | Before first publish |
| FD-5 | Waitlist Google Form URL | **Decided 14 Sep 2026:** YourWalk updates Form (`Your email`, entry `520843463`). Get updates posts to that Form. Keep the linked Sheet private. | Decided |

Do not reopen the host table or add mail to answer these.

## Trace

ADR-012 · [`RESIDENT_UX_NEXT.md`](RESIDENT_UX_NEXT.md) · backlog X7 (apex DNS) / X8 (this page) · planner About
