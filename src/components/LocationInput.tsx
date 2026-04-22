import { useState } from "preact/hooks";
import { HeroMark } from "./HeroMark";
import { RotatingVerb } from "./RotatingVerb";

interface Props {
  onZipSubmit: (zip: string) => void;
  onUseBrowser: () => void;
  loading: boolean;
  error: string | null;
}

const HOW_IT_WORKS = [
  {
    icon: "🌡️",
    title: "Check the conditions",
    body: "We pull temperature, humidity, wind, dew point, and forecasted rain for your location.",
  },
  {
    icon: "📋",
    title: "Match against manufacturer specs",
    body: "45+ outdoor projects, each with its own rules. Concrete, paint, stain, roofing, seeding, paving.",
  },
  {
    icon: "🚦",
    title: "Get a clear answer",
    body: "Green means go. Yellow means watch it. Red means wait. For red days, we tell you the next good one.",
  },
];

export function LocationInput({
  onZipSubmit,
  onUseBrowser,
  loading,
  error,
}: Props) {
  const [zip, setZip] = useState("");

  const submit = (e: Event) => {
    e.preventDefault();
    const trimmed = zip.trim();
    if (/^\d{5}$/.test(trimmed)) {
      onZipSubmit(trimmed);
    }
  };

  return (
    <div class="mx-auto max-w-xl px-5 py-10 sm:py-14">
      <div class="flex flex-col items-center text-center">
        <HeroMark />
        <h1 class="mt-5 flex min-h-[2.4em] items-center font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          <span>
            Can I <RotatingVerb /> today?
          </span>
        </h1>
        <p class="mt-3 max-w-md text-sm text-[var(--color-ink-muted)] sm:text-base">
          We match today's forecast against manufacturer specs for 45+ outdoor
          projects. Know before you start.
        </p>
      </div>

      <form onSubmit={submit} class="mt-8 flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          placeholder="Zip Code"
          value={zip}
          onInput={(e) => setZip((e.target as HTMLInputElement).value)}
          disabled={loading}
          aria-label="US zip code"
          class="flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !/^\d{5}$/.test(zip.trim())}
          class="rounded-lg bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "…" : "Check"}
        </button>
      </form>

      <div class="mt-3 flex items-center justify-center">
        <button
          type="button"
          onClick={onUseBrowser}
          disabled={loading}
          class="text-xs font-medium text-[var(--color-ink-muted)] underline hover:text-[var(--color-ink)] disabled:opacity-60"
        >
          Use my current location
        </button>
      </div>

      <p class="mt-2 text-center text-[11px] text-[var(--color-ink-subtle)]">
        Zip codes are US-only. Outside the US? Use your current location.
      </p>

      {error && (
        <p class="mt-4 rounded-md border border-[var(--color-status-red)]/30 bg-[var(--color-status-red)]/5 px-3 py-2 text-center text-xs text-[var(--color-status-red)]">
          {error}
        </p>
      )}

      <section class="mt-10 border-t border-[var(--color-border)] pt-8">
        <h2 class="text-center text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-ink-subtle)]">
          How it works
        </h2>
        <ul class="mt-4 flex flex-col gap-4 sm:grid sm:grid-cols-3 sm:gap-5">
          {HOW_IT_WORKS.map((step) => (
            <li
              key={step.title}
              class="rounded-lg border border-[var(--color-border)] bg-white p-4"
            >
              <div class="text-2xl" aria-hidden="true">
                {step.icon}
              </div>
              <h3 class="mt-2 font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-ink)]">
                {step.title}
              </h3>
              <p class="mt-1 text-xs text-[var(--color-ink-muted)]">
                {step.body}
              </p>
            </li>
          ))}
        </ul>
        <p class="mt-6 text-center text-xs text-[var(--color-ink-subtle)]">
          Free to use. No signup.
        </p>
      </section>
    </div>
  );
}
