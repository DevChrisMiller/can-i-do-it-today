import { getCached, setCached } from "./cache";
import type { Env } from "./index";

export interface LocationName {
  city: string;
  state: string;
}

interface BigDataCloudResponse {
  city?: string;
  locality?: string;
  principalSubdivisionCode?: string;
  principalSubdivision?: string;
  countryCode?: string;
}

const TTL_SECONDS = 7 * 24 * 60 * 60;

export async function fetchLocationName(
  lat: number,
  lon: number,
  env: Env,
): Promise<LocationName> {
  const cacheKey = `rev-geo:${lat}:${lon}`;
  const cached = await getCached<LocationName>(env, cacheKey);
  if (cached) return cached;

  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    // Don't fail the whole request over a missing label.
    return { city: "Your location", state: "" };
  }

  const data = (await response.json()) as BigDataCloudResponse;
  const city = data.city || data.locality || "Your location";
  const state = extractStateCode(data.principalSubdivisionCode) ||
    data.principalSubdivision ||
    "";

  const result: LocationName = { city, state };
  await setCached(env, cacheKey, result, TTL_SECONDS);
  return result;
}

// "US-GA" → "GA"
function extractStateCode(code: string | undefined): string | null {
  if (!code) return null;
  const parts = code.split("-");
  return parts[1] ?? null;
}
