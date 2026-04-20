import { getCached, setCached } from "./cache";
import type { Env } from "./index";

export interface GeocodeResult {
  zip: string;
  lat: number;
  lon: number;
  city: string;
  state: string;
}

interface ZippopotamResponse {
  "post code": string;
  country: string;
  places: Array<{
    "place name": string;
    "state abbreviation": string;
    latitude: string;
    longitude: string;
  }>;
}

const GEOCODE_TTL_SECONDS = 30 * 24 * 60 * 60;
const ZIP_RE = /^\d{5}$/;

export async function geocodeZip(
  zip: string,
  env: Env,
): Promise<GeocodeResult> {
  if (!ZIP_RE.test(zip)) {
    throw new Error("Zip must be a 5-digit US zip code");
  }

  const cacheKey = `geo:us:${zip}`;
  const cached = await getCached<GeocodeResult>(env, cacheKey);
  if (cached) return cached;

  const response = await fetch(`https://api.zippopotam.us/us/${zip}`, {
    headers: { Accept: "application/json" },
  });

  if (response.status === 404) {
    throw new Error(`No match for zip ${zip}`);
  }
  if (!response.ok) {
    throw new Error(`Geocode lookup failed: ${response.status}`);
  }

  const data = (await response.json()) as ZippopotamResponse;
  const place = data.places[0];
  if (!place) {
    throw new Error(`No place found for zip ${zip}`);
  }

  const result: GeocodeResult = {
    zip: data["post code"],
    lat: Number(place.latitude),
    lon: Number(place.longitude),
    city: place["place name"],
    state: place["state abbreviation"],
  };

  await setCached(env, cacheKey, result, GEOCODE_TTL_SECONDS);
  return result;
}
