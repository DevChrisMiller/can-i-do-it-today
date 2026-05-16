import projectDefs from "./projects.json";
import type {
  DailyForecast,
  HourlyForecast,
  NormalizedWeather,
} from "./weather";

export type Status = "green" | "yellow" | "red";

export interface RangeRule {
  min?: number;
  max?: number;
}

export type FlagId =
  | "noActiveRain"
  | "noFreezingOvernight"
  | "noExtremeHeat"
  | "groundNotFrozen"
  | "soilNotWaterlogged"
  | "noLightning"
  | "surfaceDry";

export interface ProjectRules {
  temperature?: RangeRule;
  overnightLow?: RangeRule;
  humidity?: RangeRule;
  windSpeed?: RangeRule;
  precipFreeHours?: RangeRule;
  dewPointMargin?: RangeRule;
  flags?: FlagId[];
}

export interface ProjectDefinition {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  keywords?: string[];
  rules: ProjectRules;
  tips: string[];
  seoContent?: string;
}

export interface RuleDetail {
  key: string;
  label: string;
  value: string;
  requirement: string;
  status: Status;
  reason?: string;
}

export interface EvaluatedProject {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  keywords: string[];
  status: Status;
  statusLabel: string;
  reason: string;
  details: RuleDetail[];
  bestWindow: string | null;
  nextGoodDay: string | null;
  tips: string[];
}

export const PROJECT_DEFINITIONS: ProjectDefinition[] =
  projectDefs as unknown as ProjectDefinition[];

// ---------------------------------------------------------------------------
// Yellow-zone buffers (applied around the green min/max to carve a yellow band)
// ---------------------------------------------------------------------------

const YELLOW_BUFFER: Record<string, { min: number; max: number }> = {
  temperature: { min: 10, max: 5 },
  overnightLow: { min: 8, max: 0 },
  humidity: { min: 10, max: 5 },
  windSpeed: { min: 0, max: 5 },
  precipFreeHours: { min: 6, max: 0 },
  dewPointMargin: { min: 3, max: 0 },
};

const STATUS_RANK: Record<Status, number> = { green: 0, yellow: 1, red: 2 };

const STATUS_LABEL: Record<Status, string> = {
  green: "Good to go",
  yellow: "Proceed with caution",
  red: "Not today",
};

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function worstStatus(statuses: Status[]): Status {
  return statuses.reduce<Status>(
    (worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst),
    "green",
  );
}

function evaluateRange(
  value: number,
  rule: RangeRule,
  buffer: { min: number; max: number },
): Status {
  const { min, max } = rule;
  const inGreen =
    (min === undefined || value >= min) &&
    (max === undefined || value <= max);
  if (inGreen) return "green";

  const yMin = min !== undefined ? min - buffer.min : undefined;
  const yMax = max !== undefined ? max + buffer.max : undefined;
  const inYellow =
    (yMin === undefined || value >= yMin) &&
    (yMax === undefined || value <= yMax);
  return inYellow ? "yellow" : "red";
}

function formatRange(rule: RangeRule, unit: string): string {
  const { min, max } = rule;
  if (min !== undefined && max !== undefined) return `${min}–${max}${unit}`;
  if (min !== undefined) return `≥ ${min}${unit}`;
  if (max !== undefined) return `≤ ${max}${unit}`;
  return "";
}

function round(n: number): number {
  return Math.round(n);
}

// ---------------------------------------------------------------------------
// Range-rule evaluators
// ---------------------------------------------------------------------------

function evalTemperature(temp: number, rule: RangeRule): RuleDetail {
  const status = evaluateRange(temp, rule, YELLOW_BUFFER.temperature);
  let reason: string | undefined;
  if (status !== "green") {
    if (rule.min !== undefined && temp < rule.min) {
      reason = `Too cool at ${round(temp)}°F (need ≥ ${rule.min}°F)`;
    } else if (rule.max !== undefined && temp > rule.max) {
      reason = `Too warm at ${round(temp)}°F (need ≤ ${rule.max}°F)`;
    }
  }
  return {
    key: "temperature",
    label: "Temperature",
    value: `${round(temp)}°F`,
    requirement: formatRange(rule, "°F"),
    status,
    reason,
  };
}

function evalOvernightLow(low: number, rule: RangeRule): RuleDetail {
  const status = evaluateRange(low, rule, YELLOW_BUFFER.overnightLow);
  const reason =
    status !== "green" && rule.min !== undefined && low < rule.min
      ? `Overnight low ${round(low)}°F (need ≥ ${rule.min}°F)`
      : undefined;
  return {
    key: "overnightLow",
    label: "Overnight low",
    value: `${round(low)}°F`,
    requirement: formatRange(rule, "°F"),
    status,
    reason,
  };
}

function evalHumidity(humidity: number, rule: RangeRule): RuleDetail {
  const status = evaluateRange(humidity, rule, YELLOW_BUFFER.humidity);
  let reason: string | undefined;
  if (status !== "green") {
    if (rule.max !== undefined && humidity > rule.max) {
      reason = `Humidity ${round(humidity)}% (need ≤ ${rule.max}%)`;
    } else if (rule.min !== undefined && humidity < rule.min) {
      reason = `Humidity ${round(humidity)}% (need ≥ ${rule.min}%)`;
    }
  }
  return {
    key: "humidity",
    label: "Humidity",
    value: `${round(humidity)}%`,
    requirement: formatRange(rule, "%"),
    status,
    reason,
  };
}

function evalWindSpeed(wind: number, rule: RangeRule): RuleDetail {
  const status = evaluateRange(wind, rule, YELLOW_BUFFER.windSpeed);
  const reason =
    status !== "green" && rule.max !== undefined && wind > rule.max
      ? `Wind ${round(wind)} mph (need ≤ ${rule.max} mph)`
      : undefined;
  return {
    key: "windSpeed",
    label: "Wind",
    value: `${round(wind)} mph`,
    requirement: formatRange(rule, " mph"),
    status,
    reason,
  };
}

function evalPrecipFreeHours(
  hoursUntilRain: number | null,
  rule: RangeRule,
  isRainingNow: boolean,
): RuleDetail {
  // No rain in the forecast window → treat as effectively unlimited dry hours.
  const actual = hoursUntilRain ?? 9999;
  const status = evaluateRange(actual, rule, YELLOW_BUFFER.precipFreeHours);

  let valueLabel: string;
  if (hoursUntilRain === null) {
    valueLabel = "None in forecast";
  } else if (hoursUntilRain === 0) {
    valueLabel = isRainingNow ? "Raining now" : "Within the hour";
  } else {
    valueLabel = `${hoursUntilRain}h away`;
  }

  let reason: string | undefined;
  if (status !== "green" && rule.min !== undefined && actual < rule.min) {
    if (hoursUntilRain === 0) {
      reason = isRainingNow
        ? `Raining now (need ${rule.min}h dry)`
        : `Rain within the hour (need ${rule.min}h dry)`;
    } else {
      reason = `Rain in ${hoursUntilRain}h (need ${rule.min}h dry)`;
    }
  }

  return {
    key: "precipFreeHours",
    label: "Next rain",
    value: valueLabel,
    requirement: `${rule.min ?? 0}h dry`,
    status,
    reason,
  };
}

function evalDewPointMargin(margin: number, rule: RangeRule): RuleDetail {
  const status = evaluateRange(margin, rule, YELLOW_BUFFER.dewPointMargin);
  const reason =
    status !== "green" && rule.min !== undefined && margin < rule.min
      ? `Dew point margin ${round(margin)}°F (need ≥ ${rule.min}°F)`
      : undefined;
  return {
    key: "dewPointMargin",
    label: "Dew point margin",
    value: `${round(margin)}°F below air`,
    requirement: `≥ ${rule.min ?? 0}°F margin`,
    status,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Flag evaluators (boolean-ish rules with green/yellow/red thresholds)
// ---------------------------------------------------------------------------

function evalFlag(flag: FlagId, weather: NormalizedWeather): RuleDetail {
  switch (flag) {
    case "noActiveRain": {
      const raining = weather.current.isRaining;
      return {
        key: "noActiveRain",
        label: "Right now",
        value: raining ? "Raining now" : "Dry",
        requirement: "No active rain",
        status: raining ? "red" : "green",
        reason: raining ? "It is raining right now" : undefined,
      };
    }

    case "noFreezingOvernight": {
      const low = weather.forecast.overnightLow;
      const status: Status = low >= 34 ? "green" : low >= 30 ? "yellow" : "red";
      return {
        key: "noFreezingOvernight",
        label: "Overnight freeze",
        value: `Low ${round(low)}°F`,
        requirement: "Above 32°F",
        status,
        reason:
          status !== "green"
            ? `Overnight low ${round(low)}°F risks frost damage`
            : undefined,
      };
    }

    case "noExtremeHeat": {
      const peak = weather.forecast.peakTempNext24h;
      const status: Status = peak <= 92 ? "green" : peak <= 98 ? "yellow" : "red";
      return {
        key: "noExtremeHeat",
        label: "Extreme heat",
        value: `Peak ${round(peak)}°F`,
        requirement: "Below 95°F",
        status,
        reason:
          status !== "green"
            ? `Peak temp ${round(peak)}°F will stress the work`
            : undefined,
      };
    }

    case "groundNotFrozen": {
      const minLow = weather.forecast.recentMinOvernightLow;
      const status: Status =
        minLow >= 36 ? "green" : minLow >= 28 ? "yellow" : "red";
      return {
        key: "groundNotFrozen",
        label: "Ground temp",
        value: `Recent low ${round(minLow)}°F`,
        requirement: "Ground not frozen",
        status,
        reason:
          status !== "green"
            ? "Recent freezes likely left the ground frozen"
            : undefined,
      };
    }

    case "soilNotWaterlogged": {
      const hours = weather.forecast.hoursOfRainPast48h;
      const status: Status = hours < 4 ? "green" : hours < 12 ? "yellow" : "red";
      return {
        key: "soilNotWaterlogged",
        label: "Soil moisture",
        value: `${hours}h rain in past 48h`,
        requirement: "Not waterlogged",
        status,
        reason:
          status !== "green"
            ? `${hours}h of recent rain — soil likely saturated`
            : undefined,
      };
    }

    case "noLightning": {
      const storm = weather.forecast.hasLightningNext24h;
      return {
        key: "noLightning",
        label: "Lightning risk",
        value: storm ? "Thunderstorms possible" : "Clear",
        requirement: "No lightning",
        status: storm ? "red" : "green",
        reason: storm ? "Thunderstorms in the forecast" : undefined,
      };
    }

    case "surfaceDry": {
      const since = weather.forecast.hoursSinceRain;
      if (since === null) {
        // No recent-rain data — don't penalize; surface the assumption.
        return {
          key: "surfaceDry",
          label: "Surface condition",
          value: "Assumed dry",
          requirement: "Dry surface",
          status: "green",
        };
      }
      const status: Status = since >= 24 ? "green" : since >= 6 ? "yellow" : "red";
      return {
        key: "surfaceDry",
        label: "Surface condition",
        value: `${since}h since rain`,
        requirement: "Dry surface",
        status,
        reason:
          status !== "green"
            ? `Rain only ${since}h ago — surface may still be damp`
            : undefined,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Per-hour snapshot evaluator (lightweight — used for best-window search)
// ---------------------------------------------------------------------------

function evaluateHourSnapshot(
  rules: ProjectRules,
  hour: HourlyForecast,
): Status {
  const statuses: Status[] = [];

  if (rules.temperature) {
    statuses.push(
      evaluateRange(hour.temperature, rules.temperature, YELLOW_BUFFER.temperature),
    );
  }
  if (rules.humidity) {
    statuses.push(
      evaluateRange(hour.humidity, rules.humidity, YELLOW_BUFFER.humidity),
    );
  }
  if (rules.windSpeed) {
    statuses.push(
      evaluateRange(hour.windSpeed, rules.windSpeed, YELLOW_BUFFER.windSpeed),
    );
  }
  if (rules.dewPointMargin) {
    statuses.push(
      evaluateRange(
        hour.temperature - hour.dewPoint,
        rules.dewPointMargin,
        YELLOW_BUFFER.dewPointMargin,
      ),
    );
  }
  if (rules.flags?.includes("noActiveRain")) {
    if (hour.isRaining) {
      statuses.push("red");
    } else if ((hour.precipProbability ?? 0) >= NEXT_GOOD_DAY_RAIN_PROB) {
      // Probability-threshold rain matches how hoursUntilRain is computed,
      // so the "best window" stops where the forecast says rain will start.
      statuses.push("red");
    }
  }

  return worstStatus(statuses);
}

function evaluateDaySnapshot(
  rules: ProjectRules,
  day: DailyForecast,
): Status {
  const statuses: Status[] = [];

  if (rules.temperature) {
    // Check daily high against max and daily low-ish (approximate with low) against min.
    const hiStatus = evaluateRange(
      day.high,
      { max: rules.temperature.max },
      YELLOW_BUFFER.temperature,
    );
    const loStatus = evaluateRange(
      day.high, // during the warm part of the day, the work window is near the high
      { min: rules.temperature.min },
      YELLOW_BUFFER.temperature,
    );
    statuses.push(hiStatus, loStatus);
  }
  if (rules.overnightLow) {
    statuses.push(
      evaluateRange(day.low, rules.overnightLow, YELLOW_BUFFER.overnightLow),
    );
  }
  if (rules.humidity) {
    statuses.push(
      evaluateRange(
        day.averageHumidity,
        rules.humidity,
        YELLOW_BUFFER.humidity,
      ),
    );
  }
  if (rules.windSpeed) {
    statuses.push(
      evaluateRange(
        day.maxWindSpeed,
        rules.windSpeed,
        YELLOW_BUFFER.windSpeed,
      ),
    );
  }
  if (rules.dewPointMargin) {
    statuses.push(
      evaluateRange(
        day.minDewPointMargin,
        rules.dewPointMargin,
        YELLOW_BUFFER.dewPointMargin,
      ),
    );
  }
  if (rules.flags?.includes("noLightning") && day.hasLightning) {
    statuses.push("red");
  }
  if (rules.flags?.includes("noActiveRain") && day.maxPrecipProbability >= 50) {
    statuses.push("red");
  } else if (
    rules.flags?.includes("noActiveRain") &&
    day.maxPrecipProbability >= 25
  ) {
    statuses.push("yellow");
  }

  return worstStatus(statuses);
}

// ---------------------------------------------------------------------------
// Best window & next good day
// ---------------------------------------------------------------------------

function formatWindow(hours: number): string {
  if (hours <= 0) return "Narrow window";
  if (hours >= 72) return "Next 3+ days";
  if (hours >= 48) return "Today and tomorrow";
  if (hours >= 24) return "Next 24 hours";
  if (hours >= 12) return "Rest of today";
  if (hours >= 6) return `Next ${hours} hours`;
  return `Next ${hours} hours`;
}

function findBestWindow(
  rules: ProjectRules,
  weather: NormalizedWeather,
): string | null {
  if (weather.hourly.length === 0) return null;

  let greenHours = 0;
  for (const hour of weather.hourly) {
    if (evaluateHourSnapshot(rules, hour) === "green") {
      greenHours += 1;
    } else {
      break;
    }
  }

  return greenHours === 0 ? null : formatWindow(greenHours);
}

// Forecast hours qualify as "wet" at the same probability threshold weather.ts
// uses to compute hoursUntilRain (20%). Kept in sync by hand.
const NEXT_GOOD_DAY_RAIN_PROB = 20;

function hasDryStretchFromDay(
  hourly: HourlyForecast[],
  dateKey: string,
  hoursNeeded: number,
): boolean {
  const startIdx = hourly.findIndex((h) => h.startTime.slice(0, 10) === dateKey);
  if (startIdx < 0) return false;
  // If the forecast doesn't extend far enough, we can't confirm — don't promise it.
  if (startIdx + hoursNeeded > hourly.length) return false;
  for (let i = startIdx; i < startIdx + hoursNeeded; i++) {
    const h = hourly[i]!;
    if (h.isRaining) return false;
    if ((h.precipProbability ?? 0) >= NEXT_GOOD_DAY_RAIN_PROB) return false;
  }
  return true;
}

function findNextGoodDay(
  rules: ProjectRules,
  weather: NormalizedWeather,
): string | null {
  const precipFreeMin = rules.precipFreeHours?.min;

  // Skip "Today" — we already report today's status via the card itself.
  for (let i = 1; i < weather.daily.length; i++) {
    const day = weather.daily[i]!;
    if (evaluateDaySnapshot(rules, day) !== "green") continue;
    if (precipFreeMin !== undefined && precipFreeMin > 0) {
      if (!hasDryStretchFromDay(weather.hourly, day.date, precipFreeMin)) {
        continue;
      }
    }
    return day.dayLabel;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Overall reason string
// ---------------------------------------------------------------------------

function formatOverallReason(
  details: RuleDetail[],
  weather: NormalizedWeather,
): string {
  const firstRed = details.find((d) => d.status === "red");
  if (firstRed?.reason) return firstRed.reason;

  const firstYellow = details.find((d) => d.status === "yellow");
  if (firstYellow?.reason) return firstYellow.reason;

  const c = weather.current;
  const h = weather.forecast.hoursUntilRain;
  let rainPart: string;
  if (h === null) {
    rainPart = "no rain in forecast";
  } else if (h === 0) {
    rainPart = c.isRaining ? "raining now" : "rain within the hour";
  } else {
    rainPart = `${h}h until rain`;
  }
  return `${round(c.temperature)}°F, ${c.description.toLowerCase()}, ${rainPart}`;
}

// ---------------------------------------------------------------------------
// Evaluate one project
// ---------------------------------------------------------------------------

export function evaluateProject(
  def: ProjectDefinition,
  weather: NormalizedWeather,
): EvaluatedProject {
  const details: RuleDetail[] = [];
  const { rules } = def;
  const { current, forecast } = weather;

  if (rules.temperature) {
    details.push(evalTemperature(current.temperature, rules.temperature));
  }
  if (rules.overnightLow) {
    details.push(evalOvernightLow(forecast.overnightLow, rules.overnightLow));
  }
  if (rules.humidity) {
    details.push(evalHumidity(current.humidity, rules.humidity));
  }
  if (rules.windSpeed) {
    details.push(evalWindSpeed(current.windSpeed, rules.windSpeed));
  }
  if (rules.precipFreeHours) {
    details.push(
      evalPrecipFreeHours(
        forecast.hoursUntilRain,
        rules.precipFreeHours,
        current.isRaining,
      ),
    );
  }
  if (rules.dewPointMargin) {
    details.push(
      evalDewPointMargin(
        current.temperature - current.dewPoint,
        rules.dewPointMargin,
      ),
    );
  }
  for (const flag of rules.flags ?? []) {
    details.push(evalFlag(flag, weather));
  }

  // Sort so red issues surface first — useful for reason-picking and UI.
  details.sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);

  const overall = worstStatus(details.map((d) => d.status));
  const bestWindow =
    overall === "red" ? null : findBestWindow(rules, weather);
  const nextGoodDay =
    overall === "green" ? null : findNextGoodDay(rules, weather);

  return {
    id: def.id,
    name: def.name,
    category: def.category,
    icon: def.icon,
    description: def.description,
    keywords: def.keywords ?? [],
    status: overall,
    statusLabel: STATUS_LABEL[overall],
    reason: formatOverallReason(details, weather),
    details,
    bestWindow,
    nextGoodDay,
    tips: def.tips,
  };
}

// ---------------------------------------------------------------------------
// Seasonal variants (seed-lawn: cool vs warm grass by latitude + month)
// ---------------------------------------------------------------------------

interface SeasonalVariant {
  name: string;
  description: string;
  rules: ProjectRules;
  tips: string[];
  months: Set<number>; // 1–12, calendar months when seeding works
  seasonLabel: string;
}

// USDA transition zone sits ~35–37°N. Single threshold keeps the heuristic simple.
const COOL_WARM_LAT_THRESHOLD = 36;

const SEED_LAWN_VARIANTS: Record<"cool" | "warm", SeasonalVariant> = {
  cool: {
    name: "Seed Lawn (Cool-Season)",
    description: "Seeding fescue, bluegrass, or ryegrass lawns",
    rules: { temperature: { min: 60, max: 75 }, flags: ["groundNotFrozen"] },
    tips: [
      "Light rain after seeding helps germination — avoid heavy downpours",
      "Keep seed consistently moist for 14–21 days",
      "Early fall is the ideal window in most zones",
    ],
    months: new Set([3, 4, 5, 8, 9, 10]),
    seasonLabel: "early fall or spring",
  },
  warm: {
    name: "Seed Lawn (Warm-Season)",
    description: "Seeding bermuda, zoysia, or other warm-season grasses",
    rules: { temperature: { min: 75, max: 90 }, flags: ["groundNotFrozen"] },
    tips: [
      "Late spring to early summer is the sweet spot",
      "Consistent moisture matters more than frequency — light and frequent",
      "Soil temps above 65°F are the real indicator",
    ],
    months: new Set([4, 5, 6, 7]),
    seasonLabel: "late spring through early summer",
  },
};

function currentLocalMonth(weather: NormalizedWeather): number {
  // Hourly times come back in the location's local zone (timezone=auto).
  const sample = weather.hourly[0]?.startTime;
  if (sample) {
    const m = Number(sample.slice(5, 7));
    if (m >= 1 && m <= 12) return m;
  }
  return new Date().getUTCMonth() + 1;
}

function evaluateSeedLawn(
  def: ProjectDefinition,
  weather: NormalizedWeather,
): EvaluatedProject {
  const variant =
    weather.location.lat >= COOL_WARM_LAT_THRESHOLD
      ? SEED_LAWN_VARIANTS.cool
      : SEED_LAWN_VARIANTS.warm;

  const adjustedDef: ProjectDefinition = {
    ...def,
    name: variant.name,
    description: variant.description,
    rules: variant.rules,
    tips: variant.tips,
  };

  const evaluated = evaluateProject(adjustedDef, weather);

  const month = currentLocalMonth(weather);
  if (!variant.months.has(month)) {
    const seasonDetail: RuleDetail = {
      key: "season",
      label: "Season",
      value: "Off-season",
      requirement: `Best in ${variant.seasonLabel}`,
      status: "yellow",
      reason: `Off-season for this grass — best results in ${variant.seasonLabel}`,
    };
    const nextDetails = [seasonDetail, ...evaluated.details].sort(
      (a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status],
    );
    const overall = worstStatus(nextDetails.map((d) => d.status));
    return {
      ...evaluated,
      details: nextDetails,
      status: overall,
      statusLabel: STATUS_LABEL[overall],
      reason: formatOverallReason(nextDetails, weather),
    };
  }

  return evaluated;
}

// ---------------------------------------------------------------------------
// Evaluate all projects
// ---------------------------------------------------------------------------

export function evaluateProjects(
  weather: NormalizedWeather,
): EvaluatedProject[] {
  return PROJECT_DEFINITIONS.map((def) => {
    if (def.id === "seed-lawn") return evaluateSeedLawn(def, weather);
    return evaluateProject(def, weather);
  });
}
