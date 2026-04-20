export function DashboardSkeleton() {
  return (
    <div class="animate-pulse">
      <section class="bg-[var(--color-brand)] text-white">
        <div class="mx-auto max-w-3xl px-5 py-6 sm:py-8">
          <div class="h-8 w-48 rounded bg-white/10" />
          <div class="mt-3 h-4 w-64 rounded bg-white/10" />
          <div class="mt-6 h-12 w-32 rounded bg-white/10" />
          <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="h-10 rounded bg-white/10" />
            <div class="h-10 rounded bg-white/10" />
            <div class="h-10 rounded bg-white/10" />
            <div class="h-10 rounded bg-white/10" />
          </div>
        </div>
      </section>
      <div class="mx-auto max-w-3xl px-5 py-6">
        <div class="h-10 rounded-lg bg-[var(--color-border)]/40" />
        <div class="mt-6 flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              class="h-[76px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
