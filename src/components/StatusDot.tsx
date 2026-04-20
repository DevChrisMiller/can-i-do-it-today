import type { ProjectStatus } from "../lib/types";

interface Props {
  status: ProjectStatus;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS = {
  sm: "h-2.5 w-2.5",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
} as const;

const COLOR_VAR = {
  green: "var(--color-status-green)",
  yellow: "var(--color-status-yellow)",
  red: "var(--color-status-red)",
} as const;

export function StatusDot({ status, size = "md" }: Props) {
  return (
    <span
      class={`inline-block rounded-full ring-2 ring-white shadow-sm ${SIZE_CLASS[size]}`}
      style={{ backgroundColor: COLOR_VAR[status] }}
      aria-hidden="true"
    />
  );
}
