import type { NormalizedWeather } from "./weather";
import projectDefs from "./projects.json" with { type: "json" };

// Rule engine. TODO: evaluate each project's rules against the forecast and
// produce the status objects the frontend expects (see SPEC.md §API Design).

export interface ProjectDefinition {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  rules: Record<string, { min?: number; max?: number; unit?: string }>;
  tips: string[];
  seoContent?: string;
}

export interface EvaluatedProject {
  id: string;
  name: string;
  category: string;
  icon: string;
  status: "green" | "yellow" | "red";
  statusLabel: string;
  reason: string;
  details: Array<{
    label: string;
    value: string;
    requirement: string;
    status: "green" | "yellow" | "red";
  }>;
  bestWindow: string | null;
  nextGoodDay: string | null;
}

export const PROJECT_DEFINITIONS = projectDefs as ProjectDefinition[];

export function evaluateProjects(_weather: NormalizedWeather): EvaluatedProject[] {
  // TODO: iterate PROJECT_DEFINITIONS, evaluate rules, compute status and reason,
  // scan hourly forecast for best window and next good day.
  return [];
}
