import { fetchLocationName } from "./reverse-geocode";
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
  hoursUntilRain: number | null;
  overnightLow: number;
  peakTempNext24h: number;
  hasLightningNext24h: boolean;

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
// Open-Meteo response shapes
// ---------------------------------------------------------------------------

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    dew_point_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    dew_point_2m: number[];
    precipitation: number[];
    precipitation_probability: (number | null)[];
    weather_code: number[];
    wind_speed_10m: number[];
    cape: (number | null)[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: (number | null)[];
    wind_speed_10m_max: number[];
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_URL = "https://api.open-meteo.com/v1/forecast";
const MAX_FETCH_ATTEMPTS = 3;
const RAIN_PROB_THRESHOLD = 20;
const WET_HOUR_INCHES = 0.01;
const NEXT_24H_WINDOW = 24;
const PAST_WINDOW = 48;

const RAIN_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const LIGHTNING_CODES = new Set([95, 96, 99]);
const CAPE_LIGHTNING_THRESHOLD = 2000; // J/kg, a generous "thunderstorm-supporting" level

// WMO weather code → short description
const WEATHER_CODE_TEXT: Record<number, string> = {
  0: "Clear",
  1: "Mostly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  56: "Freezing Drizzle",
  57: "Freezing Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  66: "Freezing Rain",
  67: "Freezing Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  77: "Snow Grains",
  80: "Rain Showers",
  81: "Rain Showers",
  82: "Heavy Showers",
  85: "Snow Showers",
  86: "Snow Showers",
  95: "Thunderstorms",
  96: "Thunderstorms with Hail",
  99: "Thunderstorms with Hail",
};

// ---------------------------------------------------------------------------
// Fetch + retry
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOpenMeteo(
  lat: number,
  lon: number,
): Promise<OpenMeteoResponse> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current:
      "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,weather_code,wind_speed_10m",
    hourly:
      "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,cape",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    past_days: "2",
    forecast_days: "7",
  });

  const url = `${API_URL}?${params}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (response.status >= 500) {
        throw new Error(`open-meteo ${response.status}`);
      }
      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `open-meteo ${response.status}: ${body.slice(0, 160)}`,
        );
      }
      return (await response.json()) as OpenMeteoResponse;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_FETCH_ATTEMPTS - 1) {
        await sleep(250 * 2 ** attempt);
      }
    }
  }
  throw new Error(
    `open-meteo fetch failed after ${MAX_FETCH_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function describeCode(code: number): string {
  return WEATHER_CODE_TEXT[code] ?? "Unknown";
}

function isPrecipCode(code: number): boolean {
  return RAIN_CODES.has(code) || SNOW_CODES.has(code);
}

function hourIsRaining(code: number, precipInches: number): boolean {
  if (isPrecipCode(code)) return true;
  return precipInches >= WET_HOUR_INCHES;
}

function hourHasLightning(code: number, cape: number | null): boolean {
  if (LIGHTNING_CODES.has(code)) return true;
  return (cape ?? 0) >= CAPE_LIGHTNING_THRESHOLD;
}

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
// Normalization
// ---------------------------------------------------------------------------

function findNowIndex(
  hourlyTimes: string[],
  currentTime: string,
): number {
  const exact = hourlyTimes.indexOf(currentTime);
  if (exact >= 0) return exact;
  // Fallback: first hourly entry that is >= current time.
  for (let i = 0; i < hourlyTimes.length; i++) {
    if (hourlyTimes[i]! >= currentTime) return i;
  }
  return hourlyTimes.length - 1;
}

function buildHourlyForecastSlice(
  data: OpenMeteoResponse,
  nowIndex: number,
): HourlyForecast[] {
  const h = data.hourly;
  const out: HourlyForecast[] = [];
  for (let i = nowIndex; i < h.time.length; i++) {
    const code = h.weather_code[i]!;
    out.push({
      startTime: h.time[i]!,
      temperature: h.temperature_2m[i]!,
      humidity: Math.round(h.relative_humidity_2m[i]!),
      windSpeed: Math.round(h.wind_speed_10m[i]!),
      precipProbability: h.precipitation_probability[i] ?? 0,
      dewPoint: h.dew_point_2m[i]!,
      shortForecast: describeCode(code),
      isRaining: hourIsRaining(code, h.precipitation[i] ?? 0),
    });
  }
  return out;
}

function buildCurrent(
  data: OpenMeteoResponse,
  nowIndex: number,
): CurrentConditions {
  const c = data.current;
  const hourlyProb = data.hourly.precipitation_probability[nowIndex] ?? 0;
  return {
    temperature: c.temperature_2m,
    humidity: Math.round(c.relative_humidity_2m),
    windSpeed: Math.round(c.wind_speed_10m),
    dewPoint: c.dew_point_2m,
    precipProbability: hourlyProb,
    description: describeCode(c.weather_code),
    isRaining: hourIsRaining(c.weather_code, c.precipitation),
  };
}

function buildDaily(
  data: OpenMeteoResponse,
  todayKey: string,
  hourlyForecastSlice: HourlyForecast[],
): DailyForecast[] {
  const d = data.daily;
  // Bucket the *forecast* hourly (from now forward) by day so we can compute
  // average humidity and min dew-point margin per day.
  const hoursByDay = new Map<string, HourlyForecast[]>();
  for (const hour of hourlyForecastSlice) {
    const key = dateKeyOf(hour.startTime);
    const bucket = hoursByDay.get(key);
    if (bucket) bucket.push(hour);
    else hoursByDay.set(key, [hour]);
  }

  const days: DailyForecast[] = [];
  for (let i = 0; i < d.time.length; i++) {
    const dateKey = d.time[i]!;
    if (dateKey < todayKey) continue; // skip past_days entries
    const bucket = hoursByDay.get(dateKey) ?? [];
    const humidities = bucket.map((h) => h.humidity);
    const margins = bucket.map((h) => h.temperature - h.dewPoint);
    const hasLightning = bucket.some((h) =>
      LIGHTNING_CODES.has(codeFromDescription(h.shortForecast)),
    ) || checkDailyLightning(data, i);

    days.push({
      date: dateKey,
      dayLabel: dayLabelOf(dateKey, todayKey),
      high: d.temperature_2m_max[i]!,
      low: d.temperature_2m_min[i]!,
      maxPrecipProbability: d.precipitation_probability_max[i] ?? 0,
      averageHumidity: humidities.length
        ? Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length)
        : 0,
      maxWindSpeed: Math.round(d.wind_speed_10m_max[i]!),
      minDewPointMargin: margins.length ? Math.min(...margins) : 0,
      description: describeCode(d.weather_code[i]!),
      hasLightning,
    });
  }

  return days;
}

// Inverse lookup used only for hasLightning on daily — the description field
// doesn't preserve the raw WMO code, so a direct code check is simpler.
function codeFromDescription(desc: string): number {
  if (desc === "Thunderstorms") return 95;
  if (desc === "Thunderstorms with Hail") return 96;
  return -1;
}

function checkDailyLightning(data: OpenMeteoResponse, dayIndex: number): boolean {
  const code = data.daily.weather_code[dayIndex];
  return code !== undefined && LIGHTNING_CODES.has(code);
}

function buildForecastSummary(
  data: OpenMeteoResponse,
  nowIndex: number,
  hourlyForecastSlice: HourlyForecast[],
): ForecastSummary {
  // Forward-looking
  let hoursUntilRain: number | null = null;
  for (let i = 0; i < hourlyForecastSlice.length; i++) {
    if ((hourlyForecastSlice[i]!.precipProbability ?? 0) >= RAIN_PROB_THRESHOLD) {
      hoursUntilRain = i;
      break;
    }
  }

  const next24 = hourlyForecastSlice.slice(0, NEXT_24H_WINDOW);
  const overnightLow = next24.length
    ? Math.min(...next24.map((h) => h.temperature))
    : data.current.temperature_2m;
  const peakTempNext24h = next24.length
    ? Math.max(...next24.map((h) => h.temperature))
    : data.current.temperature_2m;

  const hasLightningNext24h = hourlyForecastSlice
    .slice(0, NEXT_24H_WINDOW)
    .some((_, i) => {
      const absIdx = nowIndex + i;
      return hourHasLightning(
        data.hourly.weather_code[absIdx]!,
        data.hourly.cape[absIdx] ?? null,
      );
    });

  // Backward-looking (real values from past_days=2)
  const pastStart = Math.max(0, nowIndex - PAST_WINDOW);
  let hoursOfRainPast48h = 0;
  let hoursSinceRain: number | null = null;
  let recentMinOvernightLow = Number.POSITIVE_INFINITY;

  for (let i = pastStart; i < nowIndex; i++) {
    const precip = data.hourly.precipitation[i] ?? 0;
    const code = data.hourly.weather_code[i]!;
    const temp = data.hourly.temperature_2m[i]!;
    if (hourIsRaining(code, precip)) {
      hoursOfRainPast48h++;
      // Convert to hours-since by position relative to now.
      const hoursAgo = nowIndex - i;
      if (hoursSinceRain === null || hoursAgo < hoursSinceRain) {
        hoursSinceRain = hoursAgo;
      }
    }
    if (temp < recentMinOvernightLow) recentMinOvernightLow = temp;
  }

  // If it is raining right now, treat hoursSinceRain as 0.
  if (hourIsRaining(data.current.weather_code, data.current.precipitation)) {
    hoursSinceRain = 0;
    if (hoursOfRainPast48h === 0) hoursOfRainPast48h = 1;
  }

  if (!Number.isFinite(recentMinOvernightLow)) {
    recentMinOvernightLow = overnightLow;
  }

  return {
    hoursUntilRain,
    overnightLow,
    peakTempNext24h,
    hasLightningNext24h,
    hoursOfRainPast48h,
    recentMinOvernightLow,
    hoursSinceRain,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function fetchWeather(
  lat: number,
  lon: number,
  env: Env,
): Promise<NormalizedWeather> {
  const [data, locationName] = await Promise.all([
    fetchOpenMeteo(lat, lon),
    fetchLocationName(lat, lon, env),
  ]);

  const nowIndex = findNowIndex(data.hourly.time, data.current.time);
  const hourly = buildHourlyForecastSlice(data, nowIndex);
  const current = buildCurrent(data, nowIndex);
  const todayKey = dateKeyOf(data.current.time);
  const daily = buildDaily(data, todayKey, hourly);
  const forecast = buildForecastSummary(data, nowIndex, hourly);

  return {
    location: {
      city: locationName.city,
      state: locationName.state,
      lat,
      lon,
    },
    current,
    forecast,
    hourly,
    daily,
  };
}
