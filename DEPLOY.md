# Deploy

Two pieces ship separately:

- **Pages** serves the static Astro build (`dist/`). Auto-deploys on push to `main`.
- **Worker** serves `canidoit.today/api/*`. Deployed via `wrangler` (manually or via GitHub Actions).

## One-time setup

1. Buy `canidoit.today` via Cloudflare Registrar (or point DNS to Cloudflare).
2. `npx wrangler login`
3. Create the KV namespace and paste the returned id into `wrangler.toml`:
   ```
   npx wrangler kv namespace create WEATHER_CACHE
   ```
4. Deploy the worker the first time:
   ```
   npx wrangler deploy
   ```
5. In the Cloudflare dashboard, connect Pages to the GitHub repo:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
6. Attach `canidoit.today` as a custom domain on the Pages project.
7. Turn on Web Analytics for the Pages site and paste the token into `src/layouts/BaseLayout.astro` (replaces `REPLACE_WITH_CF_ANALYTICS_TOKEN`).

## Day-to-day

- Push to `main` → Pages rebuilds and deploys the site.
- Change anything under `worker/` → GitHub Actions runs `wrangler deploy` (see `.github/workflows/deploy-worker.yml`).
- Manual worker deploy: `npm run worker:deploy`.
- Local dev: `npm run dev` (site) and `npm run worker:dev` (worker, port 8787). Vite proxies `/api` to the worker.

## GitHub Actions secrets

The worker deploy workflow needs:

- `CLOUDFLARE_API_TOKEN` — create at dash.cloudflare.com → My Profile → API Tokens, with the **Edit Cloudflare Workers** template.
- `CLOUDFLARE_ACCOUNT_ID` — from the right sidebar of any zone overview.
