# can-i-do-it-today

Web app that tells you, at a glance, which outdoor projects are workable today based on the weather at your location. See [SPEC.md](SPEC.md) for the full product + technical spec.

## Stack

- **Frontend**: Astro 5 + Tailwind 4 + Preact islands
- **API**: Cloudflare Worker (weather.gov → rule engine → cached JSON)
- **Hosting**: Cloudflare Pages + Workers

## Layout

```
src/
  layouts/BaseLayout.astro
  pages/index.astro            # homepage (currently mock data)
  components/                  # WeatherSummary, FilterBar, ProjectCard, …
  lib/
    types.ts                   # shared frontend types
    mock-data.ts               # mock CheckResponse for dev
  styles/global.css            # Tailwind + theme tokens
worker/
  index.ts                     # /api/check entry
  weather.ts                   # weather.gov client (stub)
  cache.ts                     # KV + in-memory fallback
  rules.ts                     # rule engine (stub)
  projects.json                # project definitions
```

## Getting started

```bash
npm install
npm run dev          # Astro dev server at http://localhost:4321
npm run worker:dev   # Wrangler dev for the Worker
```

## Current state

Phase 1 skeleton. The homepage renders with hardcoded mock data so the layout is visible. Weather fetch, rule engine, and live API wiring are stubs — see the `TODO`s in `worker/`.
