import { CATEGORY_LABELS, type ProjectCategory } from "../lib/types";

type CategoryFilter = ProjectCategory | "all";

interface Props {
  categories: ProjectCategory[];
  search: string;
  onSearchChange: (value: string) => void;
  category: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
}

export function FilterBar({
  categories,
  search,
  onSearchChange,
  category,
  onCategoryChange,
}: Props) {
  return (
    <div class="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-canvas)]/95 backdrop-blur">
      <div class="mx-auto max-w-3xl px-5 py-3">
        <label class="relative block">
          <span class="sr-only">Search projects</span>
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-subtle)]">
            🔍
          </span>
          <input
            type="search"
            value={search}
            onInput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
            placeholder="Search projects…"
            class="w-full rounded-lg border border-[var(--color-border)] bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-[var(--color-ink-subtle)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20"
          />
        </label>

        <div class="mt-3 -mx-5 overflow-x-auto px-5">
          <div class="flex gap-2 pb-1">
            <FilterChip
              active={category === "all"}
              label="All"
              onClick={() => onCategoryChange("all")}
            />
            {categories.map((cat) => (
              <FilterChip
                key={cat}
                active={category === cat}
                label={CATEGORY_LABELS[cat]}
                onClick={() => onCategoryChange(cat)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const base = "whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium";
  const styles = active
    ? "bg-[var(--color-brand)] text-white"
    : "border border-[var(--color-border)] bg-white text-[var(--color-ink-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-ink)]";
  return (
    <button type="button" onClick={onClick} class={`${base} ${styles}`}>
      {label}
    </button>
  );
}
