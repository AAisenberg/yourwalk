# Path Picker: Digital Photo Comparison Game

**Status**: In Progress (Mockup Complete)  
**Target Event**: Casey Kids Carnival, Saturday 21 March 2026, 12:00–5:00pm  
**Location**: Old Cheese Factory, 34 Homestead Rd, Berwick  
**Related Project**: YourWalk

---

## Overview

Path Picker is a lightweight digital photo comparison game designed to capture community preferences about walking route features. Participants choose between pairs of path photos, revealing how Casey residents weigh trade-offs between lighting, accessibility, and shade/climate comfort.

The data collected will directly inform how YourWalk scores and ranks walking routes.

### Why "Path Picker"?

- Simple, memorable, action-oriented
- Works for all ages
- Clearly describes what you do
- Connects to walking/paths without being too technical

**Alternative names considered**: Which Path?, Walk This Way, Pick Your Path, Path Vote

---

## Objectives

### Primary Goals

1. **Capture preference data**: Understand how Casey residents weigh lighting vs accessibility vs shade when choosing walking routes
2. **Inform YourWalk scoring**: Use preference weights to calibrate route scoring algorithm
3. **Community engagement**: Demonstrate the YourWalk project at a public event, build awareness

### Secondary Goals

4. **Test engagement approach**: Validate that a quick digital game works for community input
5. **Collect baseline data**: Establish community preferences before YourWalk launches
6. **Partner visibility**: Demonstrate Monash/CrowdLab contribution to CCLL partners

### Success Metrics

| Metric | Target | Why it matters |
|--------|--------|----------------|
| Total sessions completed | 150-300 | Statistical power for preference analysis |
| Comparisons collected | 1,500-3,000 | Coverage across photo pairs |
| Completion rate | >80% | Game isn't too long or confusing |
| Avg session duration | 60-90 seconds | Quick enough for carnival flow |

---

## How It Works

### User Experience

1. **Welcome screen**: Brief intro, "Pick the path you'd rather walk!" 
2. **Comparison screen**: Two photos side by side with scenario context (icon + temperature), tap to choose
3. **Repeat**: 10 comparisons total, progress indicator visible
4. **Thank you screen**: Personalized preferences snapshot + optional info about YourWalk

### Scenario-Based Comparisons

Each comparison is shown with a **scenario context** - an icon and temperature displayed above the photos. This tells participants what conditions to imagine when choosing.

| Scenario | Icon | Temp | What it tests |
|----------|------|------|---------------|
| **Nighttime** | 🌙 | 15° | Lighting + Accessibility (shade irrelevant at night) |
| **Warm day** | ☀️ | 25-28° | Shade + Accessibility trade-offs (see Temperature Calibration below) |

Both photos in a pair share the same scenario context, ensuring participants compare path features (not time-of-day preferences).

**Why this works**:
- Lighting and shade are relevant at different times - this avoids conflating them
- No text needed - icons + temperature are universally understood, works for all ages
- Primes the right mindset - people immediately think "warm day" or "nighttime"
- Clean data - comparisons are apples-to-apples within each scenario

### Temperature Calibration

**Principle**: The displayed temperature should make the relevant attribute *matter* without making it so dominant that it overwhelms all other considerations.

**The problem with extreme temperatures**:
At 38°, shade becomes a survival concern - participants will almost always choose the shaded path regardless of surface quality, accessibility, or other factors. This doesn't reveal trade-off preferences; it just confirms people don't want to overheat.

**Solution**: Use neutral temperatures that don't bias toward shade or any weather-related factor:

| Temperature | When to use | Effect on choices |
|-------------|-------------|-------------------|
| 🌙 15° | Nighttime comparisons | Lighting matters, but not freezing - allows accessibility trade-offs |
| ☀️ 21° | **All daytime comparisons** | Pleasant day, weather is neutral - shade is nice but not a factor |

**Current default**: ☀️ 21° for all daytime comparisons. This removes weather/heat as a biasing factor entirely.

**Rationale**: At 21°, shade is pleasant but not necessary. Participants can focus on path quality, safety feel, and aesthetics without being pushed toward shaded paths by heat concerns.

**If we want to test shade importance specifically**: We could run a separate set of comparisons at higher temperatures (e.g., 28-32°) to understand how preferences shift when heat becomes a factor. But this would be a secondary analysis, not the main data collection.

**Adjustment log**:

| Date | Change | Rationale |
|------|--------|-----------|
| 2026-02-16 | Changed default from 38° to 25-28° | 38° makes shade dominant |
| 2026-02-16 | Changed default from 25-28° to 21° | Even 25-28° biases toward shade for accessibility trade-offs |
| | | |

### Core Mechanic

- **Forced choice**: Participant must pick one of two photos
- **Scenario context**: Icon + temperature shown above photos (same for both)
- **Random pairing**: Photos paired randomly within scenario type, constrained to ensure meaningful differences
- **No demographics**: Anonymous, no personal data collected
- **Quick**: ~60-90 seconds total

### What Makes It Work

- **Trade-off data**: When forced to choose between paths, preferences reveal relative importance of attributes
- **Scenario separation**: Night comparisons test lighting vs accessibility; warm day comparisons test shade vs accessibility
- **Statistical aggregation**: Hundreds of participants + random pairing = robust preference weights
- **No "right answer"**: Both options are plausible, revealing genuine preferences

### Uncontrolled Variables: Safety, Aesthetics, and Other Factors

**The challenge**: Participants don't know we're testing for shade, lighting, and accessibility. When they look at a photo, they see and respond to many factors beyond our target attributes:

| Uncontrolled Factor | What participants might notice |
|---------------------|-------------------------------|
| **Perceived safety (interpersonal)** | Isolation, sightlines, places to hide, "sketchy" feel |
| **Perceived safety (vehicles)** | Proximity to road, barriers, traffic visibility |
| **Aesthetics/maintenance** | Graffiti, litter, overgrown vegetation, general upkeep |
| **Familiarity** | Does this look like somewhere they'd normally walk? |
| **Welcoming feel** | Is this inviting? Would I want to be here? |

These factors could dominate choices even when we're trying to test shade vs accessibility.

**Our approach: Accept + Analyse**

1. **Accept that these factors will influence choices** - this reflects real-world decision-making
2. **Tag photos for perceived safety** in the photo register (add column: `safety_feel: safe / neutral / unsafe`)
3. **Control where possible** in photo selection - try to keep safety/aesthetics roughly equal when testing other attributes
4. **Analyse post-hoc** - check if "safe-looking" photos always win regardless of shade/accessibility

**What this might reveal**:
- If perceived safety explains more variance than shade/accessibility, that's important learning
- May suggest YourWalk needs "perceived safety" as a fourth consideration, or as a factor that influences the other three
- Validates that people's route choices are driven by more than just physical comfort

**For photo tagging**, add to the register:

| Column | Values | Description |
|--------|--------|-------------|
| `safety_feel` | safe / neutral / unsafe | Overall sense of interpersonal safety |
| `aesthetic_feel` | good / neutral / poor | General upkeep, welcoming appearance |

---

## Photo Strategy

### Revised Approach: Controlling for Uncontrolled Variables

Given that participants respond to multiple factors beyond our target attributes (safety, aesthetics, etc.), our photo strategy needs to:

1. **Tag all relevant attributes** - not just target attributes, but also safety and aesthetic feel
2. **Control where possible** - try to hold safety/aesthetics constant when testing other attributes
3. **Enable post-hoc analysis** - understand what's actually driving choices

### Scenario-Based Photo Sets

| Scenario | Primary Attributes | Also Tag | Temperature |
|----------|-------------------|----------|-------------|
| 🌙 **Nighttime** | Lighting + Accessibility | Safety feel, Aesthetic feel | 15° |
| ☀️ **Daytime** | Shade + Accessibility | Safety feel, Aesthetic feel | 21° (neutral) |

### Nighttime Scenario Photos (~10 photos)

For 🌙 15° comparisons. 

| # | Lighting | Accessibility | Safety Feel | Aesthetic Feel | What to look for |
|---|----------|---------------|-------------|----------------|------------------|
| N1 | Good | Good | Safe | Good | Well-lit, smooth path, open sightlines, well-maintained |
| N2 | Good | Good | Neutral | Neutral | Well-lit, smooth path, typical suburban |
| N3 | Good | Poor | Safe | Neutral | Well-lit but rough path, not isolated |
| N4 | Good | Poor | Neutral | Poor | Well-lit but rough path, less maintained |
| N5 | Moderate | Good | Safe | Good | Some lighting, smooth path, welcoming |
| N6 | Moderate | Moderate | Neutral | Neutral | Typical suburban path, okay lighting |
| N7 | Poor | Good | Unsafe | Neutral | Dark/isolated but smooth - underpass |
| N8 | Poor | Good | Neutral | Good | Dark but maintained, near houses |
| N9 | Poor | Poor | Unsafe | Poor | Dark, rough, isolated - worst case |
| N10 | Moderate | Poor | Neutral | Neutral | Some lighting, rough path |

**Goal**: Vary lighting and accessibility while trying to include different combinations of safety/aesthetic feel to understand their influence.

### Daytime Scenario Photos (~10 photos)

For ☀️ 21° comparisons (neutral temperature - shade is pleasant but not essential).

| # | Shade | Accessibility | Safety Feel | Aesthetic Feel | What to look for |
|---|-------|---------------|-------------|----------------|------------------|
| D1 | Good | Good | Safe | Good | Shady tree canopy, smooth path, well-maintained |
| D2 | Good | Good | Neutral | Neutral | Shady, smooth, typical suburban |
| D3 | Good | Poor | Safe | Good | Shady but rough - natural trail, park setting |
| D4 | Good | Poor | Neutral | Poor | Shady but rough, overgrown |
| D5 | Moderate | Good | Safe | Good | Patchy shade, smooth path, welcoming |
| D6 | Moderate | Moderate | Neutral | Neutral | Some trees, typical path |
| D7 | Poor | Good | Safe | Good | Exposed but smooth, near shops/houses |
| D8 | Poor | Good | Neutral | Neutral | Exposed, smooth, typical new estate |
| D9 | Poor | Poor | Unsafe | Poor | Exposed, rough, isolated - worst case |
| D10 | Moderate | Poor | Neutral | Neutral | Patchy shade, rough path |

**Goal**: Vary shade and accessibility while including different safety/aesthetic combinations.

### Key Design Principles

1. **Don't always pair "good" attributes together**: A shady path might feel unsafe (isolated trail). An exposed path might feel safe (near shops). This lets us disentangle the factors.

2. **Include counter-intuitive combinations**: 
   - Shady + Poor accessibility + Safe feel (nice park with rough trail)
   - Exposed + Good accessibility + Safe feel (new estate, smooth path, houses nearby)
   - Well-lit + Good accessibility + Unsafe feel (underpass with lights but isolated)

3. **Enable controlled comparisons**:
   - Compare photos with same safety/aesthetic feel but different shade → isolates shade preference
   - Compare photos with same shade but different safety feel → reveals safety importance

### Analysis Strategy

With this tagging, we can analyse:

| Question | Method |
|----------|--------|
| How much does shade matter? | Compare win rates for shade levels, controlling for safety/aesthetics |
| How much does accessibility matter? | Compare win rates for accessibility levels, controlling for other factors |
| Does safety trump everything? | Check if high-safety photos always win regardless of other attributes |
| What combination is most preferred? | Rank all photos by win rate, examine attribute patterns |

### Photo Requirements

**Technical**:
- Orientation: TBD (test on iPad first) - likely landscape or square
- Minimum 1200px on shortest side
- Similar framing across photos (path perspective, eye-level)
- No identifiable people or faces
- No distracting signage or text
- Format: JPG or PNG

**Content**:
- Real paths from Casey or visually similar areas
- Clear representation of attribute levels (obviously dark, obviously rough, etc.)
- Mix of residential, commercial, park settings
- Daytime photos with simulated/actual lighting variation for "poor lighting" shots

**Sourcing**:
- Primary: Google Street View screenshots (Nikki from XYZ Lab)
- Secondary: Council photo library (request pending)
- See `PATH_PICKER_PHOTO_BRIEF.md` for detailed sourcing instructions

### Photo Register

Photos are tracked in a Google Sheet (exported as CSV for the app):

| Column | Description |
|--------|-------------|
| filename | e.g., `night_01.jpg` or `hot_01.jpg` |
| scenario | `night` or `hot` |
| lighting | poor / moderate / good (for night photos) |
| shade | poor / moderate / good (for hot day photos) |
| accessibility | poor / moderate / good (for all photos) |
| location_hint | General area, e.g., "Berwick residential" |
| notes | Any additional context |

The app converts text values to numeric (poor=1, moderate=2, good=3) for the pairing algorithm. Photos are only paired within the same scenario type.

### Pairing Algorithm

Random pairing with constraints. Photos are only paired within the same scenario type.

**Session structure**: 
- 10 comparisons total per session
- ~5 nighttime scenario pairs (🌙 15°)
- ~5 hot day scenario pairs (☀️ 38°)
- Scenarios can be interleaved or grouped (TBD based on testing)

**Pairing logic**:
- Select scenario for this comparison
- Pick two photos from that scenario's pool
- Ensure at least one attribute differs meaningfully
- Avoid recently shown photos

---

## Data Model

### Photo Record (Configured Before Event)

```json
{
  "photo_id": "night_03",
  "filename": "night_03.jpg",
  "scenario": "night",
  "lighting": 1,
  "accessibility": 3,
  "location_hint": "Berwick underpass",
  "notes": "Dark underpass, smooth path"
}
```

```json
{
  "photo_id": "hot_05",
  "filename": "hot_05.jpg",
  "scenario": "hot",
  "shade": 2,
  "accessibility": 2,
  "location_hint": "Cranbourne residential",
  "notes": "Patchy shade, typical footpath"
}
```

Attribute scale: 1 = Poor, 2 = Moderate, 3 = Good

Note: Night photos have `lighting` + `accessibility`. Hot day photos have `shade` + `accessibility`.

### Session Record (One Per Participant)

```json
{
  "session_id": "sess_abc123xyz",
  "device_id": "ipad_01",
  "started_at": "2026-03-21T14:30:00.000Z",
  "completed_at": "2026-03-21T14:31:23.000Z",
  "comparisons_shown": 10,
  "comparisons_completed": 10,
  "synced": false
}
```

### Comparison Record (One Per Choice)

```json
{
  "comparison_id": "cmp_def456",
  "session_id": "sess_abc123xyz",
  "scenario": "night",
  "photo_left": "night_03",
  "photo_right": "night_07",
  "chosen": "left",
  "response_time_ms": 1450,
  "comparison_index": 3,
  "timestamp": "2026-03-21T14:30:45.123Z"
}
```

### Data Volume Estimates

| Data Type | Per Session | 200 Sessions | Storage |
|-----------|-------------|--------------|---------|
| Session record | 1 | 200 | ~50 KB |
| Comparison records | 10 | 2,000 | ~400 KB |
| **Total** | - | - | **~500 KB** |

LocalStorage/IndexedDB can easily handle this (5MB+ available).

---

## Technical Architecture

### Approach: Progressive Web App (PWA)

**Why PWA**:
- Works offline (essential - no guaranteed WiFi at venue)
- No App Store approval needed
- Runs in Safari on iPad
- Single codebase, easy deployment
- Can "Add to Home Screen" for app-like experience

### Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | React or vanilla JS | Simple UI, fast to build |
| Styling | Tailwind CSS or vanilla CSS | Quick styling, responsive |
| Local Storage | IndexedDB (via Dexie.js) | Reliable offline storage |
| Remote Sync | TBD (Firebase, Supabase, or local-only) | See open questions |
| Hosting | Vercel (CrowdLab account) | Consistent with other projects |
| PWA | Service Worker + manifest | Offline capability |

### Offline-First Design

```
┌─────────────────────────────────────────────────────┐
│                      iPad                           │
│  ┌───────────────────────────────────────────────┐  │
│  │              Path Picker PWA                  │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │           UI Components                 │  │  │
│  │  │  (Welcome, Comparison, Thank You)       │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                     │                         │  │
│  │                     ▼                         │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │         Local Data Layer                │  │  │
│  │  │  (IndexedDB via Dexie.js)               │  │  │
│  │  │  - Sessions                             │  │  │
│  │  │  - Comparisons                          │  │  │
│  │  │  - Sync queue                           │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                     │                         │  │
│  │                     ▼ (when online)           │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │           Sync Service                  │  │  │
│  │  │  (Background sync to Firebase)          │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼ (WiFi available)
┌─────────────────────────────────────────────────────┐
│              Firebase Firestore                     │
│  - sessions collection                              │
│  - comparisons collection                           │
└─────────────────────────────────────────────────────┘
```

### Key Offline Patterns

**Pre-caching (before event)**:
- All photos cached via Service Worker
- App shell (HTML, CSS, JS) cached
- Photo metadata cached

**During event (offline)**:
- All comparisons saved to IndexedDB immediately
- No network requests attempted
- App functions fully offline

**After event (online)**:
- Sync button or auto-sync uploads all data
- Mark records as synced to prevent duplicates
- Manual JSON export as backup

### Service Worker Strategy

```javascript
// Cache all assets on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('path-picker-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/app.js',
        '/styles.css',
        '/photos/path_001.jpg',
        '/photos/path_002.jpg',
        // ... all photos
      ]);
    })
  );
});

// Serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

---

## User Interface

### Screen Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Welcome   │ ──▶ │ Comparison  │ ──▶ │  Thank You  │
│   Screen    │     │   Screen    │     │   Screen    │
└─────────────┘     │  (×10)      │     └─────────────┘
                    └─────────────┘
```

### Welcome Screen

```
┌─────────────────────────────────────┐
│                                     │
│         🚶 Path Picker 🚶          │
│                                     │
│    Which path would you walk?       │
│                                     │
│    You'll see 10 pairs of paths.    │
│    Tap the one you'd prefer!        │
│                                     │
│        ┌───────────────┐            │
│        │    Start!     │            │
│        └───────────────┘            │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### Comparison Screen

Nighttime scenario (🌙 15°):

```
┌─────────────────────────────────────┐
│                                     │
│            🌙  15°                  │
│                                     │
│  ┌─────────────┐ ┌─────────────┐   │
│  │             │ │             │   │
│  │   Photo A   │ │   Photo B   │   │
│  │             │ │             │   │
│  │             │ │             │   │
│  │    [tap]    │ │    [tap]    │   │
│  └─────────────┘ └─────────────┘   │
│                                     │
│          ● ● ● ○ ○ ○ ○ ○ ○ ○       │
│                                     │
└─────────────────────────────────────┘
```

Hot day scenario (☀️ 38°):

```
┌─────────────────────────────────────┐
│                                     │
│            ☀️  38°                  │
│                                     │
│  ┌─────────────┐ ┌─────────────┐   │
│  │             │ │             │   │
│  │   Photo A   │ │   Photo B   │   │
│  │             │ │             │   │
│  │             │ │             │   │
│  │    [tap]    │ │    [tap]    │   │
│  └─────────────┘ └─────────────┘   │
│                                     │
│          ● ● ● ○ ○ ○ ○ ○ ○ ○       │
│                                     │
└─────────────────────────────────────┘
```

The icon + temperature context tells participants what conditions to imagine. No text needed - universally understood.

### Thank You Screen with Preferences Snapshot

After completing 10 comparisons, participants see a personalized summary of their preferences based on their choices.

```
┌─────────────────────────────────────┐
│              ✓ Thanks!              │
│                                     │
│   Here's what your picks tell us:   │
│                                     │
│   ┌───────────────────────────────┐ │
│   │   Your Path Preferences       │ │
│   │                               │ │
│   │   🌳 You prefer tree-lined    │ │
│   │      paths                    │ │
│   │                               │ │
│   │   ✨ Well-maintained paths    │ │
│   │      matter to you            │ │
│   │                               │ │
│   │   👀 You like paths with      │ │
│   │      good sightlines          │ │
│   │                               │ │
│   └───────────────────────────────┘ │
│                                     │
│   Your choices help us build better │
│   walking routes for Casey.         │
│                                     │
│    ┌─────────────────────────┐      │
│    │  Learn about YourWalk   │      │
│    └─────────────────────────┘      │
│        ┌───────────────┐            │
│        │   Play Again  │            │
│        └───────────────┘            │
└─────────────────────────────────────┘
```

### Preferences Calculation

Based on the participant's 10 choices, calculate preference scores for each attribute:

**Method**:
1. For each comparison, note which photo was chosen
2. Look up the attributes of chosen vs not-chosen photo
3. Tally: how often did they choose the "better" option for each attribute?

**Example calculation**:
```
Shade: Chose higher shade 7/10 times → 70% → "You prefer shaded paths"
Accessibility: Chose better surface 8/10 times → 80% → "Smooth paths matter to you"
Safety feel: Chose safer-feeling 9/10 times → 90% → "You like paths with good sightlines"
```

**Messaging thresholds**:

| Score | Message Type |
|-------|--------------|
| 70%+ | Strong preference: "You prefer [X]" |
| 50-69% | Moderate: "You tend to like [X]" |
| <50% | Opposite or flexible: "You're flexible about [X]" |

**Possible preference messages** (show 2-3 per participant):

| Attribute | High Score Message | Icon |
|-----------|-------------------|------|
| Shade | "You prefer tree-lined paths" | 🌳 |
| Accessibility | "Smooth paths matter to you" | 🛤️ |
| Safety feel | "You like paths with good sightlines" | 👀 |
| Aesthetic feel | "Well-maintained paths matter to you" | ✨ |
| Lighting (night) | "You prefer well-lit routes" | 💡 |

**Why this adds value**:
- Immediate gratification for participants ("I got something out of this!")
- Feels like a personality quiz, not just data collection
- Encourages engagement and completion
- May encourage "Play Again" to compare with friends/family

### Visual Design Notes

- Large touch targets (minimum 48px)
- High contrast for outdoor visibility
- Simple, playful but not childish (works for all ages)
- YourWalk branding subtle but present
- Progress indicator always visible
- Responsive: works on iPad (primary) and phones (secondary)

---

## Analysis Plan

### Primary Analysis: Preference Weights by Scenario

**Method**: Bradley-Terry model or simple win-rate analysis, segmented by scenario

**Nighttime scenario analysis** (🌙 15°):
- How much does lighting matter vs accessibility?
- Win rates for good/moderate/poor lighting
- Win rates for good/moderate/poor accessibility

**Hot day scenario analysis** (☀️ 38°):
- How much does shade matter vs accessibility?
- Win rates for good/moderate/poor shade
- Win rates for good/moderate/poor accessibility

**Combined insights**:
```
Example output (normalized weights):

Nighttime context:
- Lighting:      60
- Accessibility: 40

Hot day context:
- Shade:         55
- Accessibility: 45
```

Interpretation: In both contexts, the comfort/safety factor (lighting or shade) matters more than accessibility, but not overwhelmingly so.

### Secondary Analysis: Trade-off Patterns

**Questions to answer**:
1. In nighttime context: When lighting vs accessibility conflict, which wins? By how much?
2. In hot day context: When shade vs accessibility conflict, which wins? By how much?
3. Is accessibility weighted similarly across both contexts?
4. Are there threshold effects? (e.g., poor lighting is especially avoided, but moderate vs good doesn't matter much)

### Data Processing Steps

1. Export comparison data from Firebase
2. Calculate win-rate per photo
3. Calculate win-rate by attribute level
4. Run Bradley-Terry model (optional, for sophisticated weighting)
5. Generate summary statistics and visualizations
6. Document insights and recommendations for YourWalk scoring

### Tools

- Python (pandas, scipy) for analysis
- Or simple spreadsheet analysis for basic win-rates
- Visualization: matplotlib, or Google Sheets charts

---

## Event Operations

### Equipment Needed

| Item | Quantity | Notes |
|------|----------|-------|
| iPad | 2-3 | Pre-loaded with app, charged |
| iPad stands | 2-3 | Stable display on table |
| Portable chargers | 2-3 | Backup power |
| Signage | 1-2 | "Path Picker" branding, brief instructions |
| QR code to YourWalk info | 1 | For interested participants |

### Setup Checklist (Before Event)

- [ ] App deployed and tested
- [ ] Photos finalized and loaded
- [ ] PWA cached on each iPad (test offline mode)
- [ ] Device IDs configured (ipad_01, ipad_02, etc.)
- [ ] Backup JSON export tested
- [ ] Signage printed
- [ ] Chargers packed
- [ ] Brief facilitator notes prepared

### At Event

- [ ] Set up table with iPads on stands
- [ ] Verify app works offline
- [ ] Brief any helpers on how to reset between participants
- [ ] Monitor for issues throughout day
- [ ] Track approximate participant count

### After Event

- [ ] Connect to WiFi and sync data
- [ ] Verify data uploaded to Firebase
- [ ] Export backup JSON from each iPad
- [ ] Check total sessions/comparisons collected
- [ ] Note any issues or observations

---

## Timeline

### Weeks Before Event

| Week | Date Range | Tasks |
|------|------------|-------|
| 6 | Feb 10-16 | Finalize planning doc, confirm approach |
| 5 | Feb 17-23 | Source/take photos, finalize photo set |
| 4 | Feb 24 - Mar 2 | Build app (core functionality) |
| 3 | Mar 3-9 | Complete app, test offline mode |
| 2 | Mar 10-16 | Load on iPads, end-to-end testing |
| 1 | Mar 17-20 | Final checks, prep equipment |
| Event | Mar 21 | Casey Kids Carnival |
| Post | Mar 22-28 | Sync data, run analysis, document findings |

### Development Effort Estimate

| Task | Effort |
|------|--------|
| Photo sourcing and tagging | 4-6 hours |
| App UI (3 screens) | 4-6 hours |
| Pairing logic | 2 hours |
| Local storage (IndexedDB) | 2-3 hours |
| PWA/Service Worker | 2-3 hours |
| Firebase sync | 2-3 hours |
| Testing and polish | 4-6 hours |
| **Total** | **~20-30 hours** |

---

## Decisions Made

| Decision | Choice | Notes |
|----------|--------|-------|
| Photo sourcing | Council photos received + Street View (Nikki from XYZ Lab) for gaps | [Casey Google Drive](https://drive.google.com/drive/folders/1EDSPo6bUfLLtugOI6Dju_Cy6gBcw1gry) - mostly daytime/positive, Nikki fills gaps |
| Hosting | Vercel (CrowdLab account) | Consistent with other CrowdLab projects |
| Photo naming | Sequential (`night_01.jpg`, `hot_01.jpg`) + Google Sheet register | Simpler workflow for Nikki |
| Photo orientation | Landscape | Tested in mockup, works well side-by-side on iPad |
| Data storage | TBD | Options: Firebase, Supabase, or local-only with manual export |
| Branding | Casey Kids Carnival 2026 + partner credits | Monash XYX Lab, CrowdLab, City of Casey on thank you screen |
| iPad availability | To be sourced | 2-3 iPads needed |

## Progress

### Completed
- [x] Planning documentation
- [x] Scenario-based approach defined (🌙 15° and ☀️ 38°)
- [x] Photo brief for Nikki
- [x] Casey photos received (Google Drive)
- [x] Static mockup completed (`/path-picker-mockup/`)
- [x] Mockup tested with real Casey photos (hot day scenario)

### In Progress
- [ ] Review Casey photos and categorize by scenario/attributes
- [ ] Identify gaps for Nikki to fill via Street View
- [ ] Source iPads for event

### To Do
- [ ] Build functional PWA with pairing logic
- [ ] Implement offline data storage
- [ ] End-to-end testing on iPad
- [ ] Final photo set loaded
- [ ] Event prep (signage, chargers, etc.)

## Open Questions

### To Resolve Before Build

1. **Photo orientation**: Landscape vs portrait vs square - test on iPad first
2. **Data storage approach**: Firebase, Supabase, or local-only with JSON export?
3. **Branding**: How prominent should YourWalk/Monash/CrowdLab branding be?

### To Confirm with Natasha/Council

1. Table location: Indoor (building) or outdoor (marquee)? Affects screen visibility.
2. Power access: Can we plug in chargers?
3. WiFi: Confirm no reliable WiFi (assume none, design for offline)
4. Other CCLL partners: Any coordination needed?

### Future Considerations

1. **Reuse**: Could this run at other events or online?
2. **Extended version**: Add optional "why did you choose?" follow-up?
3. **Location-specific**: Tag photos with actual locations, map back to real paths?
4. **Integration**: Feed preference data directly into YourWalk scoring algorithm?

---

## Appendix: Analysis Methods

### Bradley-Terry Model (Overview)

The Bradley-Terry model estimates the "strength" of each item based on pairwise comparisons. For Path Picker:

- Each photo gets a strength score
- Probability of A beating B = strength(A) / (strength(A) + strength(B))
- Model fitted using maximum likelihood estimation

**Advantages**:
- Handles incomplete comparisons (not every pair tested)
- Produces relative strength scores
- Well-established statistical method

**Python implementation**: `choix` library or custom implementation

### Simple Win-Rate Analysis

For each attribute level:
1. Calculate win-rate for photos with that attribute
2. Compare across levels

Example:
```
Shade = Good:   Win rate 62%
Shade = Moderate: Win rate 51%
Shade = Poor:   Win rate 38%
```

Interpretation: Photos with good shade win more often → shade is valued.

### Attribute Trade-off Analysis

Filter to comparisons where only one attribute differs:
1. Lighting differs, accessibility and shade equal → Who wins?
2. Accessibility differs, lighting and shade equal → Who wins?
3. Shade differs, lighting and accessibility equal → Who wins?

This isolates the effect of each attribute.

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-10 | - | Initial planning document |
| 2026-02-10 | - | Added decisions: Vercel hosting, photo register workflow, Nikki sourcing photos |
| 2026-02-10 | - | Revised to scenario-based approach: night (🌙 15°) and hot day (☀️ 38°) contexts |
| 2026-02-16 | - | Static mockup completed (`/path-picker-mockup/`), Casey photos received via Google Drive |
| 2026-02-16 | - | Temperature calibration: changed daytime default from 38° to 21° (neutral) |
| 2026-02-16 | - | Added "Uncontrolled Variables" section: safety_feel and aesthetic_feel tagging |
| 2026-02-16 | - | Revised photo matrices to include safety/aesthetic feel columns and counter-intuitive combinations |
| 2026-02-16 | - | Added personalized preferences snapshot on thank you screen |