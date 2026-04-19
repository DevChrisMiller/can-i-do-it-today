export type ProjectStatus = "green" | "yellow" | "red";

export type ProjectCategory =
  | "concrete"
  | "painting"
  | "roofing"
  | "landscaping"
  | "construction"
  | "paving"
  | "automotive"
  | "garden"
  | "misc";

export interface RuleDetail {
  label: string;
  value: string;
  requirement: string;
  status: ProjectStatus;
}

export interface Project {
  id: string;
  name: string;
  category: ProjectCategory;
  icon: string;
  status: ProjectStatus;
  statusLabel: string;
  reason: string;
  details: RuleDetail[];
  bestWindow: string | null;
  nextGoodDay: string | null;
  tips?: string[];
}

export interface Location {
  city: string;
  state: string;
  lat: number;
  lon: number;
}

export interface CurrentWeather {
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipProbability: number;
  dewPoint: number;
  description: string;
  hoursUntilRain: number | null;
}

export interface CheckResponse {
  location: Location;
  current: CurrentWeather;
  projects: Project[];
  fetchedAt: string;
  cacheExpiresAt: string;
}

export const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  concrete: "Concrete",
  painting: "Paint & Stain",
  roofing: "Roofing",
  landscaping: "Lawn",
  construction: "Construction",
  paving: "Paving",
  automotive: "Auto",
  garden: "Garden",
  misc: "Other",
};
