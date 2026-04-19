// weather.gov API client.
// TODO: implement /points/{lat},{lon} → hourly forecast fetch with retry/backoff.
// Returns a normalized shape the rule engine can consume.

export interface NormalizedWeather {
  location: {
    city: string;
    state: string;
    lat: number;
    lon: number;
  };
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
  description: string;        // e.g. "Partly Cloudy"
  isRaining: boolean;         // current weather is active precipitation
}

export interface ForecastSummary {
  // Forward-looking (from hourly forecast)
  hoursUntilRain: number | null;        // null = no rain in forecast window
  overnightLow: number;                 // °F — lowest temp in next overnight window
  peakTempNext24h: number;              // °F — highest temp in next 24 hours
  hasLightningNext24h: boolean;         // any thunder/lightning mentions

  // Backward-looking (from observations when available; sensible defaults otherwise)
  hoursOfRainPast48h: number;           // hours with measurable precip in past 48h
  recentMinOvernightLow: number;        // coldest low in past 3 nights (°F)
  hoursSinceRain: number | null;        // null = no recent rain data
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
  date: string;                   // YYYY-MM-DD, local to the forecast grid
  dayLabel: string;               // "Today", "Tomorrow", "Saturday"
  high: number;
  low: number;
  maxPrecipProbability: number;
  averageHumidity: number;
  maxWindSpeed: number;
  minDewPointMargin: number;      // high - dewPoint, lowest of the day
  description: string;
  hasLightning: boolean;
}

export async function fetchWeather(
  _lat: number,
  _lon: number,
  _userAgent: string,
): Promise<NormalizedWeather> {
  throw new Error("fetchWeather not yet implemented");
}
