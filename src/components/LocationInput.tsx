import { useState } from "preact/hooks";

interface Props {
  onZipSubmit: (zip: string) => void;
  onUseBrowser: () => void;
  loading: boolean;
  error: string | null;
}

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
    <div class="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-5 py-12">
      <div class="text-center">
        <h1 class="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--color-ink)] sm:text-4xl">
          CanIDoIt
          <span class="text-[var(--color-status-green)]">.</span>
          today
        </h1>
        <p class="mt-3 text-sm text-[var(--color-ink-muted)]">
          Enter your zip code or share your location to see what outdoor
          projects work today.
        </p>
      </div>

      <form onSubmit={submit} class="mt-8 flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          placeholder="Zip code"
          value={zip}
          onInput={(e) => setZip((e.target as HTMLInputElement).value)}
          disabled={loading}
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

      {error && (
        <p class="mt-4 rounded-md border border-[var(--color-status-red)]/30 bg-[var(--color-status-red)]/5 px-3 py-2 text-center text-xs text-[var(--color-status-red)]">
          {error}
        </p>
      )}
    </div>
  );
}
