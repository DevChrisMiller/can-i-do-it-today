import type { Project } from "../lib/types";
import { StatusDot } from "./StatusDot";

interface Props {
  project: Project;
  onOpen: (project: Project) => void;
}

const BORDER_ACCENT = {
  green: "border-l-[var(--color-status-green)]",
  yellow: "border-l-[var(--color-status-yellow)]",
  red: "border-l-[var(--color-status-red)]",
} as const;

export function ProjectCard({ project, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(project)}
      class={`group w-full rounded-lg border border-[var(--color-border)] border-l-4 bg-[var(--color-surface)] p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 ${BORDER_ACCENT[project.status]}`}
    >
      <div class="flex items-start gap-3">
        <span class="text-2xl" aria-hidden="true">
          {project.icon}
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <StatusDot status={project.status} size="sm" />
            <h3 class="truncate font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
              {project.name}
            </h3>
          </div>
          <p class="mt-1 line-clamp-2 text-sm text-[var(--color-ink-muted)]">
            {project.reason}
          </p>
          {project.nextGoodDay && project.status === "red" && (
            <p class="mt-1 text-xs font-medium text-[var(--color-ink-subtle)]">
              Next good day:{" "}
              <span class="text-[var(--color-ink-muted)]">
                {project.nextGoodDay}
              </span>
            </p>
          )}
          {project.bestWindow && project.status === "green" && (
            <p class="mt-1 text-xs font-medium text-[var(--color-ink-subtle)]">
              Best window:{" "}
              <span class="text-[var(--color-ink-muted)]">
                {project.bestWindow}
              </span>
            </p>
          )}
        </div>
        <span class="shrink-0 text-[var(--color-ink-subtle)] transition-transform group-hover:translate-x-0.5">
          ›
        </span>
      </div>
    </button>
  );
}
