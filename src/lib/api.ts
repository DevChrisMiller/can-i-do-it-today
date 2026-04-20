import type { CheckResponse } from "./types";

export interface GeocodeResult {
  zip: string;
  lat: number;
  lon: number;
  city: string;
  state: string;
}

interface ApiError {
  error: string;
  detail?: string;
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = (await response.json()) as ApiError;
      if (body.error) message = body.error;
      if (body.detail) message += ` — ${body.detail}`;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export function getCheck(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<CheckResponse> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
  });
  return request<CheckResponse>(`/api/check?${params}`, signal);
}

export function geocodeZip(
  zip: string,
  signal?: AbortSignal,
): Promise<GeocodeResult> {
  const params = new URLSearchParams({ zip });
  return request<GeocodeResult>(`/api/geocode?${params}`, signal);
}
