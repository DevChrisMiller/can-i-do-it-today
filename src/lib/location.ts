export interface StoredLocation {
  lat: number;
  lon: number;
  city?: string;
  state?: string;
  zip?: string;
  source: "zip" | "browser";
}

const STORAGE_KEY = "canidoit.location.v1";

export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

export function loadLocation(): StoredLocation | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLocation;
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lon)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocation(location: StoredLocation): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  } catch {
    // quota or disabled storage — ignore
  }
}

export function clearLocation(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getBrowserLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation not available"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Location permission denied")),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 10_000 },
    );
  });
}
