import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { CheckResponse, Project, ProjectCategory } from "../lib/types";
import { getCheck, geocodeZip } from "../lib/api";
import {
  clearLocation,
  getBrowserLocation,
  loadLocation,
  roundCoord,
  saveLocation,
  type StoredLocation,
} from "../lib/location";
import { WeatherSummary } from "./WeatherSummary";
import { FilterBar } from "./FilterBar";
import { StatusSection } from "./StatusSection";
import { LocationInput } from "./LocationInput";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { ProjectDetail } from "./ProjectDetail";

type Phase =
  | { kind: "booting" }
  | { kind: "needs-location"; error: string | null; locating: boolean }
  | { kind: "loading"; location: StoredLocation }
  | { kind: "ready"; location: StoredLocation; data: CheckResponse }
  | { kind: "error"; message: string; location: StoredLocation | null };

type CategoryFilter = ProjectCategory | "all";

export function Dashboard() {
  const [phase, setPhase] = useState<Phase>({ kind: "booting" });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selected, setSelected] = useState<Project | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored = loadLocation();
    if (stored) {
      fetchCheck(stored);
    } else {
      setPhase({ kind: "needs-location", error: null, locating: false });
    }
    return () => abortRef.current?.abort();
  }, []);

  function fetchCheck(location: StoredLocation) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: "loading", location });
    getCheck(roundCoord(location.lat), roundCoord(location.lon), controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const enriched: StoredLocation = {
          ...location,
          city: data.location.city,
          state: data.location.state,
        };
        saveLocation(enriched);
        setPhase({ kind: "ready", location: enriched, data });
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        setPhase({ kind: "error", message: err.message, location });
      });
  }

  async function handleZipSubmit(zip: string) {
    setPhase({ kind: "needs-location", error: null, locating: true });
    try {
      const geo = await geocodeZip(zip);
      const next: StoredLocation = {
        lat: geo.lat,
        lon: geo.lon,
        city: geo.city,
        state: geo.state,
        zip: geo.zip,
        source: "zip",
      };
      saveLocation(next);
      fetchCheck(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lookup failed";
      setPhase({ kind: "needs-location", error: message, locating: false });
    }
  }

  async function handleUseBrowser() {
    setPhase({ kind: "needs-location", error: null, locating: true });
    try {
      const coords = await getBrowserLocation();
      const next: StoredLocation = {
        lat: coords.lat,
        lon: coords.lon,
        source: "browser",
      };
      saveLocation(next);
      fetchCheck(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Location failed";
      setPhase({ kind: "needs-location", error: message, locating: false });
    }
  }

  function handleChangeLocation() {
    clearLocation();
    abortRef.current?.abort();
    setPhase({ kind: "needs-location", error: null, locating: false });
  }

  const projects = phase.kind === "ready" ? phase.data.projects : [];
  const categories = useMemo(() => {
    const set = new Set<ProjectCategory>();
    for (const p of projects) set.add(p.category);
    return Array.from(set);
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.reason.toLowerCase().includes(q)
      );
    });
  }, [projects, search, category]);

  const green = filtered.filter((p) => p.status === "green");
  const yellow = filtered.filter((p) => p.status === "yellow");
  const red = filtered.filter((p) => p.status === "red");

  if (phase.kind === "booting") {
    return <DashboardSkeleton />;
  }

  if (phase.kind === "needs-location") {
    return (
      <LocationInput
        onZipSubmit={handleZipSubmit}
        onUseBrowser={handleUseBrowser}
        loading={phase.locating}
        error={phase.error}
      />
    );
  }

  if (phase.kind === "loading") {
    return <DashboardSkeleton />;
  }

  if (phase.kind === "error") {
    return (
      <div class="mx-auto max-w-md px-5 py-12 text-center">
        <p class="text-sm text-[var(--color-status-red)]">{phase.message}</p>
        <div class="mt-4 flex justify-center gap-3">
          {phase.location && (
            <button
              type="button"
              onClick={() => phase.location && fetchCheck(phase.location)}
              class="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={handleChangeLocation}
            class="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
          >
            Change location
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <WeatherSummary
        location={phase.data.location}
        current={phase.data.current}
        onChangeLocation={handleChangeLocation}
      />
      <FilterBar
        categories={categories}
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
      />
      <main class="mx-auto max-w-3xl pb-16">
        {filtered.length === 0 ? (
          <p class="px-5 py-10 text-center text-sm text-[var(--color-ink-muted)]">
            No projects match those filters.
          </p>
        ) : (
          <>
            <StatusSection
              status="green"
              heading="Good to go"
              subheading="all conditions met"
              projects={green}
              onOpen={setSelected}
            />
            <StatusSection
              status="yellow"
              heading="Use caution"
              subheading="watch the window"
              projects={yellow}
              onOpen={setSelected}
            />
            <StatusSection
              status="red"
              heading="Not today"
              subheading="come back later"
              projects={red}
              onOpen={setSelected}
            />
          </>
        )}
      </main>
      {selected && (
        <ProjectDetail project={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
