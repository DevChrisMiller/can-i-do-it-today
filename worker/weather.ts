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
  current: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    precipProbability: number;
    dewPoint: number;
    description: string;
    hoursUntilRain: number | null;
  };
  hourly: HourlyForecast[];
}

export interface HourlyForecast {
  startTime: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipProbability: number;
  dewPoint: number;
  shortForecast: string;
}

export async function fetchWeather(
  _lat: number,
  _lon: number,
  _userAgent: string,
): Promise<NormalizedWeather> {
  throw new Error("fetchWeather not yet implemented");
}
