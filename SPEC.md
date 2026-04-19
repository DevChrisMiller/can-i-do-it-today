# CanIDoIt.today — Project Specification

## What This Is

CanIDoIt.today is a free website that answers one question: **"Can I do this outdoor project today?"**

A user enters their zip code (or allows geolocation), and the site shows a dashboard of 45+ outdoor home projects — each with a green/yellow/red indicator based on current and forecasted weather conditions. No login. No app install. Just instant, actionable answers.

No product like this currently exists. People currently Google "can I pour concrete today" or "is it too hot to stain my deck" and land on long blog posts that they then have to cross-reference with a separate weather app. We collapse that into a single glance.

---

## Tech Stack

- **Frontend**: Astro (static-first, SEO-optimized, island architecture)
- **Styling**: Tailwind CSS (no component library — custom design)
- **Interactive islands**: Small Preact or React components for the weather-fetching parts
- **API / Backend**: Cloudflare Workers (weather fetching, caching, rule engine)
- **Weather data source**: weather.gov API (free, no key required — `https://api.weather.gov`)
- **Caching**: Cloudflare KV or in-memory cache in the Worker (30-minute TTL keyed by rounded lat/lon)
- **Database**: None at launch
- **Hosting**: Cloudflare Pages (frontend) + Cloudflare Workers (API)
- **Domain**: canidoit.today

Total infrastructure cost: $0 (all free tiers).

---

## Architecture Overview

```
User loads page
    → Browser gets location (geolocation API or zip code input)
    → Frontend calls API: GET /api/check?lat=40.79&lon=-81.37
    → Cloudflare Worker:
        1. Check cache for this lat/lon (rounded to 2 decimal places)
        2. If miss: fetch forecast from api.weather.gov
        3. Run all 45 project rules against the forecast data
        4. Cache results (30 min TTL)
        5. Return JSON with all project statuses
    → Frontend renders the dashboard
```

### Weather.gov API Flow

The weather.gov API is a two-step process:

1. **Get the forecast office/grid**: `GET https://api.weather.gov/points/{lat},{lon}`
   - Returns a `forecast` URL and `forecastHourly` URL
2. **Get the forecast**: `GET {forecastHourly URL}`
   - Returns hourly forecast data including: temperature, humidity (relativeHumidity), wind speed, precipitation probability, dew point, weather description (rain/snow/etc.)

Also fetch the standard forecast endpoint for the 7-day narrative forecast.

**Important**: weather.gov requires a User-Agent header identifying your app. Use `User-Agent: (canidoit.today, contact@canidoit.today)`.

---

## API Design

### `GET /api/check?lat={lat}&lon={lon}`

Returns all projects with their current status.

```json
{
  "location": {
    "city": "Canton",
    "state": "OH",
    "lat": 40.79,
    "lon": -81.37
  },
  "current": {
    "temperature": 72,
    "humidity": 45,
    "windSpeed": 8,
    "precipProbability": 0,
    "dewPoint": 52,
    "description": "Partly Cloudy"
  },
  "projects": [
    {
      "id": "pour-concrete",
      "name": "Pour Concrete",
      "category": "concrete",
      "status": "green",
      "statusLabel": "Good to go",
      "reason": "72°F with no rain expected for 24+ hours",
      "details": {
        "temperature": { "current": 72, "min": 50, "max": 90, "status": "green" },
        "rain": { "hoursUntilRain": 36, "required": 24, "status": "green" },
        "humidity": { "current": 45, "max": 80, "status": "green" },
        "overnightLow": { "forecast": 55, "min": 40, "status": "green" }
      },
      "bestWindow": "Today through tomorrow afternoon",
      "nextGoodDay": null
    },
    {
      "id": "stain-deck-oil",
      "name": "Stain Deck (Oil-Based)",
      "category": "painting",
      "status": "yellow",
      "statusLabel": "Proceed with caution",
      "reason": "Temperature OK but humidity rising — finish by 2 PM",
      "details": { ... },
      "bestWindow": "This morning before noon",
      "nextGoodDay": "Thursday"
    }
  ],
  "fetchedAt": "2026-04-18T10:30:00Z",
  "cacheExpiresAt": "2026-04-18T11:00:00Z"
}
```

### `GET /api/check?lat={lat}&lon={lon}&project={projectId}`

Returns detailed info for a single project (used for SEO pages).

---

## Project Rules Engine

Each project is a rule set that evaluates weather conditions. The rules live as a JSON config file in the Worker codebase.

### Rule Structure

```javascript
{
  id: "pour-concrete",
  name: "Pour Concrete",
  category: "concrete",
  icon: "🧱", // or use a simple icon system
  description: "Pouring a concrete slab, sidewalk, patio, or driveway",
  rules: {
    temperature: { min: 50, max: 90, unit: "F" },
    overnightLow: { min: 40 },        // must not freeze overnight
    precipProbability: { max: 20 },     // % chance in next N hours
    precipFreeHours: { min: 24 },       // hours of no rain needed after start
    humidity: { max: 80 },
    windSpeed: { max: 25 }              // mph
  },
  statusLogic: {
    green: "All conditions met",
    yellow: "Temperature between 40-50 OR overnight low between 32-40 OR rain possible in 18-24hrs",
    red: "Temperature below 40 OR above 95 OR rain within 12hrs OR freezing overnight"
  },
  tips: [
    "Pour in early morning to allow full day of curing",
    "Keep concrete above 50°F for 48 hours after pouring",
    "Use curing blankets if overnight temps drop near freezing"
  ],
  seoContent: "Concrete cures best between 50°F and 90°F. The chemical reaction (hydration) that strengthens concrete slows significantly below 50°F and is nearly non-existent below 40°F. Rain within the first 4-8 hours can damage the surface, and freezing before initial cure (24 hours) can reduce strength by up to 50%."
}
```

### Status Evaluation Logic

For each project:
1. Check each rule against current + forecast data
2. Each individual rule gets green/yellow/red
3. Overall status = worst individual status (any red = red overall)
4. Generate a human-readable reason string
5. Calculate "best window" by scanning the hourly forecast for the next period where all rules are green
6. If current status is red, find the "next good day"

### Complete Project List

Here are all 45 projects with their weather rules:

#### Concrete & Masonry
1. **Pour Concrete** — Temp 50-90°F, no rain 24hrs, humidity <80%, wind <25mph, overnight low >40°F
2. **Pour Footings/Foundation** — Same as concrete but overnight low >50°F for 48hrs
3. **Lay Brick/Block** — Temp >40°F, no rain 24hrs, no freezing 24hrs
4. **Repoint Mortar** — Temp 40-90°F, no rain 24hrs, avoid direct sun in extreme heat
5. **Apply Stucco** — Temp 40-90°F, no rain 48hrs, humidity <80%
6. **Seal Concrete/Driveway** — Temp 50-90°F, no rain 24hrs, surface must be dry

#### Painting & Staining
7. **Exterior Paint (Latex)** — Temp 50-85°F, humidity <85%, no rain 4-6hrs, dew point 5°F+ below air temp
8. **Exterior Paint (Oil-Based)** — Temp 40-90°F, no rain 24hrs, humidity <80%
9. **Stain Deck (Oil-Based)** — Temp 50-90°F, no rain 24-48hrs, no freezing overnight, humidity 30-70%
10. **Stain Deck (Water-Based)** — Temp 50-80°F, no rain 24hrs, humidity 40-70%
11. **Stain/Seal Fence** — Temp 50-90°F, no rain 24-48hrs, no freezing overnight
12. **Paint Outdoor Furniture** — Temp 50-85°F, humidity <80%, no rain 4hrs
13. **Apply Exterior Caulk** — Temp 40-80°F, no rain 24hrs, surface dry
14. **Paint/Epoxy Garage Floor** — Temp 55-90°F, humidity <80%, concrete must be dry

#### Roofing
15. **Install Asphalt Shingles** — Temp 40-85°F, no rain, wind <25mph
16. **Apply Roof Sealant** — Temp 50-90°F, no rain 24hrs, no dew overnight
17. **Install Metal Roofing** — Temp >32°F, no rain, wind <30mph
18. **Patch/Tar Roof** — Temp 40-85°F, no rain 24hrs

#### Landscaping & Lawn
19. **Seed Lawn (Cool-Season)** — Soil/air temp 60-75°F, light rain helpful, no heavy rain, no drought
20. **Seed Lawn (Warm-Season)** — Soil/air temp 75-90°F, consistent moisture needed
21. **Lay Sod** — Air temp 55-70°F, ground not frozen, no extreme heat
22. **Apply Fertilizer** — Temp 55-85°F, no heavy rain 24hrs, no drought
23. **Apply Herbicide** — Temp 60-85°F, no rain 4-6hrs, wind <10mph
24. **Apply Pesticide** — Temp 60-85°F, no rain 4-6hrs, wind <10mph
25. **Plant Trees/Shrubs** — Temp >35°F, ground not frozen, no extreme heat
26. **Mulch Garden Beds** — Temp >32°F, no high wind, soil not waterlogged
27. **Aerate Lawn** — Soil moist (not frozen/dry), temp 50-80°F

#### Outdoor Construction
28. **Install Wood Fence** — Temp >40°F (for post concrete), no rain during assembly
29. **Build Deck Structure** — Temp >32°F, no active rain, no extreme wind
30. **Install Composite Decking** — Temp >40°F, no rain for fastening
31. **Outdoor Wood Gluing** — Temp 50-80°F, humidity 40-60%, no rain

#### Paving & Asphalt
32. **Seal Asphalt Driveway** — Temp >50°F for 24hrs, no rain 24-48hrs, no overnight freezing, humidity <90%
33. **Asphalt Paving** — Temp >50°F, no rain, ground not frozen
34. **Lay Pavers** — Ground not frozen, no active rain

#### Automotive & Spray
35. **Wash & Wax Car** — Temp 50-80°F, no direct sun, no rain, wind <15mph
36. **Spray Paint (Outdoor)** — Temp 50-90°F, humidity <65%, wind <15mph, no rain

#### Garden
37. **Transplant Seedlings** — No frost risk 2 weeks, temp 50-75°F, overcast preferred
38. **Spray Fungicide** — Temp 60-85°F, no rain 4-6hrs, wind <10mph
39. **Prune Trees/Shrubs** — Temp >32°F, no wet conditions (disease spread risk)
40. **Start Garden Bed / Till** — Soil not waterlogged or frozen, temp >40°F

#### Miscellaneous
41. **Power Wash House/Deck** — Temp >40°F, no freezing 24hrs, no rain
42. **Clean Gutters** — No rain, no lightning, wind <20mph
43. **Install Outdoor Lighting** — No rain, temp >32°F
44. **Resurface Pool** — Temp 50-80°F, no rain 72hrs, no freezing
45. **Set Fence Posts (Concrete)** — Temp 40-85°F, no rain 24hrs, no freezing overnight

---

## Frontend Design

### Design Direction

**Aesthetic**: Clean, utilitarian, slightly industrial — like a well-designed weather app crossed with a job site tool. Not playful, not corporate. Trustworthy and functional. Think of the confidence you feel reading a well-designed gauge or instrument panel.

**Color System**:
- Background: Warm off-white or very light warm gray
- Cards: White with subtle shadow
- Status green: A confident, natural green (not neon) — like `#22c55e` or similar
- Status yellow: Warm amber — like `#f59e0b`
- Status red: Clear but not alarming red — like `#ef4444`
- Text: Near-black `#1a1a1a` for primary, medium gray for secondary
- Accent: A single brand color for the header/logo — consider a deep blue-gray or warm slate

**Typography**: Use a distinctive but readable sans-serif. Something with character but not distracting. Pair a slightly heavier/wider font for headings with a clean body font. Load from Google Fonts.

**Mobile-first**: Design for 375px width first. The primary user is standing in their garage on a Saturday morning looking at their phone.

### Page Structure

#### Homepage (`/`)

```
┌─────────────────────────────┐
│  CanIDoIt.today             │
│  📍 Canton, OH  [Change]    │
│  72°F · Partly Cloudy       │
│  Humidity 45% · Wind 8mph   │
│  No rain for 36 hours       │
├─────────────────────────────┤
│  🔍 Search projects...      │
│  [All] [Concrete] [Paint]   │
│  [Lawn] [Roofing] [More ▾]  │
├─────────────────────────────┤
│  ── GOOD TO GO ──           │
│                             │
│  🟢 Pour Concrete           │
│     72°F, dry for 36hrs     │
│                             │
│  🟢 Exterior Paint (Latex)  │
│     Great conditions today  │
│                             │
│  🟢 Seal Driveway           │
│     Warm and dry until Wed  │
│                             │
│  ── USE CAUTION ──          │
│                             │
│  🟡 Stain Deck (Oil)        │
│     Humidity rising — do AM │
│                             │
│  ── NOT TODAY ──             │
│                             │
│  🔴 Spray Paint (Outdoor)   │
│     Wind 18mph, need <15    │
│                             │
│  🔴 Apply Herbicide         │
│     Wind too high for spray │
│                             │
└─────────────────────────────┘
```

**Key behaviors**:
- Cards sorted: green first, then yellow, then red
- Each card is compact (2 lines max) in collapsed state
- Tapping a card expands it to show full weather breakdown, tips, and product links
- Search bar filters cards in real-time as you type
- Category chips filter by category
- Location auto-detects on first visit, stored in localStorage for return visits
- Skeleton loading state while weather API is called

#### Expanded Card (when tapped)

```
┌─────────────────────────────┐
│  🟢 Pour Concrete        ▲  │
│  Good to go                 │
├─────────────────────────────┤
│                             │
│  Temperature     72°F  ✅   │
│  Need: 50-90°F              │
│                             │
│  Rain Forecast   None  ✅   │
│  Need: 24hrs dry            │
│                             │
│  Humidity        45%   ✅   │
│  Need: Under 80%            │
│                             │
│  Overnight Low   55°F  ✅   │
│  Need: Above 40°F           │
│                             │
│  Wind            8mph  ✅   │
│  Need: Under 25mph          │
│                             │
│  BEST WINDOW                │
│  Today through tomorrow PM  │
│                             │
│  💡 Tips                    │
│  Pour early morning for     │
│  full day of curing time.   │
│                             │
│  🛒 What You'll Need        │
│  [Concrete Mix] [Forms]     │
│  [Finishing Tools] [Blanket]│
│                             │
└─────────────────────────────┘
```

#### Project SEO Pages (`/projects/{project-id}/{city-state}`)

Example: `/projects/pour-concrete/canton-oh`

These are pre-generated static pages with:
- Title: "Can I Pour Concrete Today in Canton, OH?"
- Meta description: "Check today's weather conditions for pouring concrete in Canton, OH. Live temperature, humidity, wind, and rain forecast checked against concrete curing requirements."
- Static SEO content section explaining the weather rules for this project (indexable by Google)
- Live weather widget (Preact island) showing current status
- 7-day outlook showing which days are good for this project
- Product recommendations
- Links to other projects in the same city
- Links to same project in nearby cities

Generate these pages for the top 200 US cities × 45 projects = 9,000 pages.

**City list**: Use the top 200 US cities by population. Generate the slug as `{city-slug}-{state-abbreviation}` (e.g., `canton-oh`, `los-angeles-ca`).

---

## SEO Strategy

### Technical SEO
- All pages are static HTML (Astro default)
- Each page has unique `<title>` and `<meta name="description">`
- Structured data (JSON-LD) for each page: FAQPage schema or HowTo schema
- Sitemap.xml generated at build time with all 9,000+ pages
- robots.txt allowing all crawlers
- Clean URL structure with no query parameters for indexed pages
- Fast load times (<1s) — target 95+ Lighthouse performance score
- Open Graph and Twitter card meta tags for social sharing

### Content SEO
- Each project SEO page includes 200-400 words of static, indexable content explaining the weather requirements
- FAQ section on each page ("What temperature is too cold to pour concrete?", etc.)
- Internal linking between related projects and nearby cities
- Blog section (future) for seasonal content ("Best weekend projects for spring in the Midwest")

### Target Keywords (examples)
- "can I pour concrete today"
- "is it too cold to stain my deck"
- "weather for painting outside"
- "can I seal my driveway today"
- "best weather for [project]"
- "is today a good day to [project]"

---

## Monetization (Phase 2+)

### Affiliate Links
Each project has associated products. When a card is expanded, show a "What You'll Need" section with affiliate links.

Affiliate programs to set up:
- Amazon Associates (broad product selection, 3-4% commission)
- Home Depot affiliate program (5-8% on many categories)
- Lowe's affiliate program

Example products per project:
- **Pour Concrete**: concrete mix, forms, finishing trowel set, curing blankets, wheelbarrow
- **Stain Deck**: deck stain (Cabot, TWP, Thompson's), brushes/rollers, painter's tape, deck cleaner, brightener
- **Exterior Paint**: paint (Behr, Benjamin Moore), brushes, rollers, drop cloths, painter's tape, ladder

### Ads (Phase 3 — after 5k+ daily users)
- Single ad placement below the project list or between sections
- Use Google AdSense initially, migrate to Mediavine/AdThrive at 50k+ monthly sessions
- Never pop-ups, never interstitials, never auto-playing video

### Contractor Referrals (Phase 3+)
- When status is red for extended periods or project is complex, offer "Hire a Pro" link
- Partner with Angi, Thumbtack, or similar for referral fees ($5-15 per lead)

---

## Development Phases

### Phase 1: MVP (Launch Target)
- [ ] Astro project setup with Tailwind
- [ ] Cloudflare Worker with weather.gov integration and caching
- [ ] Rule engine with all 45 projects
- [ ] Homepage with location input, category filters, search
- [ ] Card list with green/yellow/red status, sorted by status
- [ ] Expandable card detail view
- [ ] Mobile-responsive design (mobile-first)
- [ ] Geolocation auto-detect with zip code fallback
- [ ] Basic error handling (weather API down, location not found)
- [ ] Deploy to Cloudflare Pages + Workers

### Phase 2: SEO & Growth
- [ ] Generate static SEO pages for top 200 cities × 45 projects
- [ ] Sitemap.xml generation
- [ ] Structured data (JSON-LD) on all pages
- [ ] Open Graph / social sharing meta
- [ ] "Share this result" button (generates shareable link)
- [ ] 7-day forecast view per project
- [ ] "Best window this week" feature
- [ ] Google Search Console setup and monitoring

### Phase 3: Monetization
- [ ] Affiliate product recommendations per project
- [ ] "What You'll Need" expanded card section
- [ ] Single tasteful ad placement
- [ ] Analytics (Plausible or similar privacy-focused)
- [ ] Track most popular projects for sort optimization

### Phase 4: Features
- [ ] "Notify me when it's good" — email or push notification when a project goes green
- [ ] Contractor referral links for complex projects
- [ ] User favorites (localStorage — no login needed)
- [ ] PWA support for home screen install
- [ ] Blog / seasonal content

---

## File Structure (Suggested)

```
canidoit-today/
├── astro.config.mjs
├── tailwind.config.mjs
├── package.json
├── public/
│   ├── favicon.svg
│   ├── robots.txt
│   └── icons/              # Project category icons
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro           # Homepage
│   │   └── projects/
│   │       └── [project]/
│   │           └── [city].astro  # SEO pages (generated)
│   ├── components/
│   │   ├── LocationInput.tsx     # Preact island - zip/geolocation
│   │   ├── ProjectDashboard.tsx  # Preact island - main card list
│   │   ├── ProjectCard.tsx       # Individual project card
│   │   ├── ProjectCardExpanded.tsx
│   │   ├── CategoryFilter.tsx
│   │   ├── SearchBar.tsx
│   │   ├── WeatherSummary.tsx
│   │   └── StatusBadge.tsx
│   ├── lib/
│   │   ├── projects.ts           # Project definitions and rules
│   │   ├── types.ts              # TypeScript types
│   │   └── cities.ts             # Top 200 US cities data
│   └── styles/
│       └── global.css
├── worker/
│   ├── index.ts                  # Cloudflare Worker entry
│   ├── weather.ts                # weather.gov API client
│   ├── cache.ts                  # Caching logic
│   ├── rules.ts                  # Rule evaluation engine
│   └── projects.json             # Project rule definitions
└── README.md
```

---

## Key Technical Notes

### Weather.gov API Quirks
- Rate limited (loosely) — cache aggressively
- Requires User-Agent header
- Points endpoint occasionally returns 500s — implement retry with backoff
- Hourly forecast gives up to 156 hours (6.5 days) of data
- Temperature is in the unit specified (usually Fahrenheit for US locations)
- Wind speed is a string like "8 mph" — parse the number out

### Geolocation → Zip Code
- Use the browser's Geolocation API for auto-detect
- For zip code input, use a free geocoding service or a static zip-to-lat/lon lookup table
- Census Bureau has free zip code centroid data

### Caching Strategy
- Round lat/lon to 2 decimal places for cache keys (~1km precision)
- 30-minute TTL on weather data
- Cache the processed results (after rule evaluation), not just raw weather data
- If weather.gov is down, serve stale cache with a "data may be outdated" warning

### Status Determination Logic
```
For each rule in project:
  if value is within ideal range → GREEN
  if value is in marginal range → YELLOW  
  if value is outside acceptable range → RED

Overall status = worst(all individual rule statuses)

If overall GREEN: "Good to go"
If overall YELLOW: "Proceed with caution" + reason for caution
If overall RED: "Not recommended today" + primary reason + next good day
```

### Handling "Hours of Dry Weather Needed"
Some projects need X hours of no rain AFTER you start. Scan the hourly forecast from current hour forward. Count consecutive hours where precipProbability < 20%. If that count >= required hours, the rain rule is green.

---

## Design Inspiration & Anti-Patterns

### DO
- Make status colors the dominant visual element — scannable at a glance
- Keep cards compact in collapsed state (users scan, not read)
- Show the ONE most important reason for each status
- Make the location bar sticky so users always know where they're looking at
- Use skeleton loading states while data loads
- Make the search/filter feel instant (client-side filtering)

### DON'T
- Don't use a hamburger menu — everything should be visible
- Don't require any signup, login, or account creation — ever
- Don't add a cookie banner if possible (don't use tracking cookies)
- Don't auto-play any media
- Don't show tooltips on mobile (they don't work)
- Don't add a chatbot or popup of any kind
- Don't use a loading spinner — use skeleton screens instead

---

## Success Metrics

- **Primary**: Daily returning users (bookmark rate)
- **Secondary**: Organic search traffic to SEO pages  
- **Tertiary**: Affiliate link click-through rate

The north star is: does someone check this site every Saturday morning before starting their weekend project? If yes, we've won.
