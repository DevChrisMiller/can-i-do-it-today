import { getCached, setCached } from "./cache";
import type { Env } from "./index";

// ---------------------------------------------------------------------------
// Public types (consumed by the rule engine)
// ---------------------------------------------------------------------------

export interface Location {
  city: string;
  state: string;
  lat: number;
  lon: number;
}

export interface NormalizedWeather {
  location: Location;
  current: CurrentConditions;
  forecast: ForecastSummary;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}

export interface CurrentConditions {
  temperature: number;        // °F
  humidity: number;           // 0–100
  windSpeed: number;          // mph
  dewPoint: number;           // °F
  precipProbability: number;  // 0–100
  description: string;
  isRaining: boolean;
}

export interface ForecastSummary {
  // Forward-looking (from hourly forecast)
  hoursUntilRain: number | null;
  overnightLow: number;
  peakTempNext24h: number;
  hasLightningNext24h: boolean;

  // Backward-looking (forecast API doesn't expose these — sensible defaults)
  hoursOfRainPast48h: number;
  recentMinOvernightLow: number;
  hoursSinceRain: number | null;
}

export interface HourlyForecast {
  startTime: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipProbability: number;
  dewPoint: number;
  shortForecast: string;
  isRaining: boolean;
}

export interface DailyForecast {
  date: string;
  dayLabel: string;
  high: number;
  low: number;
  maxPrecipProbability: number;
  averageHumidity: number;
  maxWindSpeed: number;
  minDewPointMargin: number;
  description: string;
  hasLightning: boolean;
}

// ---------------------------------------------------------------------------
// weather.gov API response shapes (only the fields we touch)
// ---------------------------------------------------------------------------

interface PointsResponse {
  properties: {
    forecast: string;
    forecastHourly: string;
    relativeLocation: {
      properties: {
        city: string;
        state: string;
      };
    };
  };
}

interface HourlyApiResponse {
  properties: {
    periods: HourlyApiPeriod[];
  };
}

interface HourlyApiPeriod {
  startTime: string;
  endTime: string;
  temperature: number;
  temperatureUnit: "F" | "C";
  probabilityOfPrecipitation?: { value: number | null };
  dewpoint?: { unitCode?: string; value: number | null };
  relativeHumidity?: { value: number | null };
  windSpeed: string;
  windDirection?: string;
  shortForecast: string;
}

interface PointsInfo {
  city: string;
  state: string;
  forecastUrl: string;
  forecastHourlyUrl: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = "https://api.weather.gov";
const POINTS_TTL_SECONDS = 24 * 60 * 60;
const MAX_FETCH_ATTEMPTS = 3;
const RAIN_PROB_THRESHOLD = 20;
const OVERNIGHT_WINDOW_START_HOUR = 4;
const OVERNIGHT_WINDOW_END_HOUR = 16;
const NEXT_24H_WINDOW = 24;

const RAIN_RE = /rain|shower|storm|drizzle|sleet|snow/i;
const LIGHTNING_RE = /thunder|t-storm|lightning/i;

// ---------------------------------------------------------------------------
// Fetch + retry
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string, userAgent: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": userAgent,
          Accept: "application/geo+json",
        },
      });
      if (response.status >= 500) {
        throw new Error(`weather.gov ${response.status} at ${url}`);
      }
      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `weather.gov ${response.status} at ${url}: ${body.slice(0, 160)}`,
        );
      }
      return (await response.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_FETCH_ATTEMPTS - 1) {
        await sleep(250 * 2 ** attempt);
      }
    }
  }
  throw new Error(
    `weather.gov fetch failed after ${MAX_FETCH_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parseWindSpeed(raw: string | undefined): number {
  if (!raw) return 0;
  // Matches numbers in strings like "8 mph" or "5 to 10 mph" (use the higher).
  const matches = raw.match(/\d+/g);
  if (!matches) return 0;
  return Math.max(...matches.map(Number));
}

function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

function resolveDewPoint(
  dp: HourlyApiPeriod["dewpoint"],
  tempF: number,
): number {
  const value = dp?.value;
  if (value == null) return tempF - 10; // conservative fallback
  if (dp?.unitCode?.includes("degC")) return celsiusToFahrenheit(value);
  return value;
}

function isRainingDesc(desc: string): boolean {
  return RAIN_RE.test(desc);
}

function hasLightningDesc(desc: string): boolean {
  return LIGHTNING_RE.test(desc);
}

// "2026-04-19T10:00:00-04:00" → "2026-04-19" (local to the forecast grid).
function dateKeyOf(isoTime: string): string {
  return isoTime.slice(0, 10);
}

function incrementDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function dayLabelOf(dateKey: string, today: string): string {
  if (dateKey === today) return "Today";
  if (dateKey === incrementDate(today)) return "Tomorrow";
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normalizeHourly(periods: HourlyApiPeriod[]): HourlyForecast[] {
  return periods.map((p) => {
    const temperature =
      p.temperatureUnit === "C"
        ? celsiusToFahrenheit(p.temperature)
        : p.temperature;
    return {
      startTime: p.startTime,
      temperature,
      humidity: p.relativeHumidity?.value ?? 0,
      windSpeed: parseWindSpeed(p.windSpeed),
      precipProbability: p.probabilityOfPrecipitation?.value ?? 0,
      dewPoint: resolveDewPoint(p.dewpoint, temperature),
      shortForecast: p.shortForecast,
      isRaining: isRainingDesc(p.shortForecast),
    };
  });
}

function buildCurrent(hourly: HourlyForecast[]): CurrentConditions {
  const first = hourly[0];
  if (!first) {
    throw new Error("weather.gov returned no hourly forecast periods");
  }
  return {
    temperature: first.temperature,
    humidity: first.humidity,
    windSpeed: first.windSpeed,
    dewPoint: first.dewPoint,
    precipProbability: first.precipProbability,
    description: first.shortForecast,
    isRaining: first.isRaining,
  };
}

function buildDaily(hourly: HourlyForecast[]): DailyForecast[] {
  if (hourly.length === 0) return [];

  const buckets = new Map<string, HourlyForecast[]>();
  for (const hour of hourly) {
    const key = dateKeyOf(hour.startTime);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(hour);
    else buckets.set(key, [hour]);
  }

  const today = dateKeyOf(hourly[0]!.startTime);
  const days: DailyForecast[] = [];

  for (const [date, hours] of buckets) {
    if (hours.length === 0) continue;
    const temps = hours.map((h) => h.temperature);
    const humidities = hours.map((h) => h.humidity);
    const winds = hours.map((h) => h.windSpeed);
    const precips = hours.map((h) => h.precipProbability);
    const margins = hours.map((h) => h.temperature - h.dewPoint);

    days.push({
      date,
      dayLabel: dayLabelOf(date, today),
      high: Math.max(...temps),
      low: Math.min(...temps),
      maxPrecipProbability: Math.max(...precips),
      averageHumidity: Math.round(
        humidities.reduce((a, b) => a + b, 0) / humidities.length,
      ),
      maxWindSpeed: Math.max(...winds),
      minDewPointMargin: Math.min(...margins),
      description: hours[Math.floor(hours.length / 2)]!.shortForecast,
      hasLightning: hours.some((h) => hasLightningDesc(h.shortForecast)),
    });
  }

  // Ensure chronological order — Map preserves insertion order, but be explicit.
  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}

function buildForecastSummary(
  hourly: HourlyForecast[],
): ForecastSummary {
  let hoursUntilRain: number | null = null;
  for (let i = 0; i < hourly.length; i++) {
    if ((hourly[i]!.precipProbability ?? 0) >= RAIN_PROB_THRESHOLD) {
      hoursUntilRain = i;
      break;
    }
  }

  const overnightSlice = hourly.slice(
    OVERNIGHT_WINDOW_START_HOUR,
    OVERNIGHT_WINDOW_END_HOUR,
  );
  const overnightLow = overnightSlice.length
    ? Math.min(...overnightSlice.map((h) => h.temperature))
    : hourly[0]?.temperature ?? 50;

  const next24 = hourly.slice(0, NEXT_24H_WINDOW);
  const peakTempNext24h = next24.length
    ? Math.max(...next24.map((h) => h.temperature))
    : hourly[0]?.temperature ?? 70;

  const hasLightningNext24h = next24.some((h) =>
    hasLightningDesc(h.shortForecast),
  );

  return {
    hoursUntilRain,
    overnightLow,
    peakTempNext24h,
    hasLightningNext24h,
    // Not reliably available from /forecast; sensible optimistic defaults.
    hoursOfRainPast48h: 0,
    recentMinOvernightLow: overnightLow,
    hoursSinceRain: null,
  };
}

// ---------------------------------------------------------------------------
// Points cache (grid mappings rarely change — cache for 24h)
// ---------------------------------------------------------------------------

async function fetchPointsInfo(
  lat: number,
  lon: number,
  userAgent: string,
  env: Env | undefined,
): Promise<PointsInfo> {
  const cacheKey = `points:${lat}:${lon}`;
  if (env) {
    const cached = await getCached<PointsInfo>(env, cacheKey);
    if (cached) return cached;
  }

  const data = await fetchJson<PointsResponse>(
    `${API_BASE}/points/${lat},${lon}`,
    userAgent,
  );

  const info: PointsInfo = {
    city: data.properties.relativeLocation.properties.city,
    state: data.properties.relativeLocation.properties.state,
    forecastUrl: data.properties.forecast,
    forecastHourlyUrl: data.properties.forecastHourly,
  };

  if (env) {
    await setCached(env, cacheKey, info, POINTS_TTL_SECONDS);
  }

  return info;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function fetchWeather(
  lat: number,
  lon: number,
  userAgent: string,
  env?: Env,
): Promise<NormalizedWeather> {
  const points = await fetchPointsInfo(lat, lon, userAgent, env);
  const hourlyData = await fetchJson<HourlyApiResponse>(
    points.forecastHourlyUrl,
    userAgent,
  );

  const hourly = normalizeHourly(hourlyData.properties.periods);
  const current = buildCurrent(hourly);
  const daily = buildDaily(hourly);
  const forecast = buildForecastSummary(hourly);

  return {
    location: { city: points.city, state: points.state, lat, lon },
    current,
    forecast,
    hourly,
    daily,
  };
}
