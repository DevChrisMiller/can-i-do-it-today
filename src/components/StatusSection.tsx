import type { Project, ProjectStatus } from "../lib/types";
import { ProjectCard } from "./ProjectCard";

interface Props {
  status: ProjectStatus;
  heading: string;
  subheading: string;
  projects: Project[];
  onOpen: (project: Project) => void;
}

const ACCENT = {
  green: "text-[var(--color-status-green)]",
  yellow: "text-[var(--color-status-yellow)]",
  red: "text-[var(--color-status-red)]",
} as const;

export function StatusSection({
  status,
  heading,
  subheading,
  projects,
  onOpen,
}: Props) {
  if (projects.length === 0) return null;
  return (
    <section class="mt-6 first:mt-2">
      <header class="flex items-baseline justify-between px-5 pb-2">
        <h2
          class={`font-[family-name:var(--font-display)] text-xs font-bold uppercase tracking-[0.15em] ${ACCENT[status]}`}
        >
          {heading}
        </h2>
        <span class="text-xs text-[var(--color-ink-subtle)]">
          {projects.length} · {subheading}
        </span>
      </header>
      <div class="flex flex-col gap-2 px-5">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}
