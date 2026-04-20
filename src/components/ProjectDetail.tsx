import { useEffect } from "preact/hooks";
import type { Project, ProjectStatus } from "../lib/types";
import { StatusDot } from "./StatusDot";

interface Props {
  project: Project;
  onClose: () => void;
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  green: "Good to go",
  yellow: "Use caution",
  red: "Not today",
};

const STATUS_ACCENT: Record<ProjectStatus, string> = {
  green: "text-[var(--color-status-green)]",
  yellow: "text-[var(--color-status-yellow)]",
  red: "text-[var(--color-status-red)]",
};

const RULE_BG: Record<ProjectStatus, string> = {
  green: "bg-[var(--color-status-green)]/8",
  yellow: "bg-[var(--color-status-yellow)]/10",
  red: "bg-[var(--color-status-red)]/8",
};

export function ProjectDetail({ project, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      class="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-detail-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        class="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div class="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-[var(--color-canvas)] shadow-2xl sm:rounded-2xl">
        <header class="flex items-start gap-3 border-b border-[var(--color-border)] bg-white px-5 py-4">
          <span class="text-3xl" aria-hidden="true">
            {project.icon}
          </span>
          <div class="min-w-0 flex-1">
            <h2
              id="project-detail-title"
              class="truncate font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]"
            >
              {project.name}
            </h2>
            <div class="mt-0.5 flex items-center gap-2">
              <StatusDot status={project.status} size="sm" />
              <span
                class={`text-xs font-semibold uppercase tracking-wide ${STATUS_ACCENT[project.status]}`}
              >
                {STATUS_LABEL[project.status]}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            class="-mr-1 -mt-1 rounded-full p-1.5 text-[var(--color-ink-muted)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-ink)]"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              class="h-5 w-5"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-5">
          <p class="text-sm text-[var(--color-ink)]">{project.reason}</p>

          {(project.bestWindow || project.nextGoodDay) && (
            <div class="mt-4 grid gap-2 sm:grid-cols-2">
              {project.bestWindow && (
                <InfoTile label="Best window" value={project.bestWindow} />
              )}
              {project.nextGoodDay && (
                <InfoTile label="Next good day" value={project.nextGoodDay} />
              )}
            </div>
          )}

          {project.details.length > 0 && (
            <section class="mt-6">
              <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-ink-subtle)]">
                Conditions
              </h3>
              <ul class="mt-2 flex flex-col gap-1.5">
                {project.details.map((detail) => (
                  <li
                    key={detail.label}
                    class={`flex items-start gap-3 rounded-md px-3 py-2 ${RULE_BG[detail.status]}`}
                  >
                    <StatusDot status={detail.status} size="sm" />
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span class="text-sm font-medium text-[var(--color-ink)]">
                          {detail.label}
                        </span>
                        <span class="text-sm text-[var(--color-ink)]">
                          {detail.value}
                        </span>
                      </div>
                      <p class="text-xs text-[var(--color-ink-muted)]">
                        {detail.requirement}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {project.tips && project.tips.length > 0 && (
            <section class="mt-6">
              <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-ink-subtle)]">
                Tips
              </h3>
              <ul class="mt-2 flex flex-col gap-1.5 text-sm text-[var(--color-ink-muted)]">
                {project.tips.map((tip, i) => (
                  <li key={i} class="flex gap-2">
                    <span
                      class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-ink-subtle)]"
                      aria-hidden="true"
                    />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div class="rounded-md border border-[var(--color-border)] bg-white px-3 py-2">
      <dt class="text-xs uppercase tracking-wide text-[var(--color-ink-subtle)]">
        {label}
      </dt>
      <dd class="mt-0.5 text-sm font-medium text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}
