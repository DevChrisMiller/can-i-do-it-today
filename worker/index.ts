import { fetchWeather } from "./weather";
import { getCached, setCached } from "./cache";
import { evaluateProjects } from "./rules";

export interface Env {
  WEATHER_CACHE?: KVNamespace;
  USER_AGENT: string;
}

const CACHE_TTL_SECONDS = 30 * 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
      ...corsHeaders,
    },
  });
}

function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true });
    }

    if (url.pathname !== "/api/check") {
      return json({ error: "Not found" }, 404);
    }

    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    const projectFilter = url.searchParams.get("project");

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return json({ error: "lat and lon query params are required" }, 400);
    }

    const cacheKey = `v1:${roundCoord(lat)}:${roundCoord(lon)}`;

    const cached = await getCached(env, cacheKey);
    if (cached) {
      return json(filterProject(cached, projectFilter));
    }

    try {
      const weather = await fetchWeather(roundCoord(lat), roundCoord(lon), env.USER_AGENT);
      const result = {
        ...weather,
        projects: evaluateProjects(weather),
        fetchedAt: new Date().toISOString(),
        cacheExpiresAt: new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString(),
      };

      await setCached(env, cacheKey, result, CACHE_TTL_SECONDS);
      return json(filterProject(result, projectFilter));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return json({ error: "Failed to fetch weather", detail: message }, 502);
    }
  },
};

function filterProject<T extends { projects: Array<{ id: string }> }>(
  result: T,
  projectId: string | null,
): T {
  if (!projectId) return result;
  return {
    ...result,
    projects: result.projects.filter((p) => p.id === projectId),
  };
}
