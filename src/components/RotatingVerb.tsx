import { useEffect, useState } from "preact/hooks";

const PHRASES = [
  "pour concrete",
  "paint the deck",
  "stain the fence",
  "mulch the beds",
  "seed the lawn",
  "pressure wash the siding",
  "seal the driveway",
  "shingle the roof",
  "wash the car",
  "plant tomatoes",
];

const FADE_MS = 180;
const HOLD_MS = 2200;

export function RotatingVerb() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    let timeoutId: number | undefined;

    const interval = window.setInterval(() => {
      setVisible(false);
      timeoutId = window.setTimeout(() => {
        setIndex((i) => (i + 1) % PHRASES.length);
        setVisible(true);
      }, FADE_MS);
    }, HOLD_MS);

    return () => {
      clearInterval(interval);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <span
      class="text-[var(--color-status-green)] transition-opacity ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transitionDuration: `${FADE_MS}ms`,
      }}
    >
      {PHRASES[index]}
    </span>
  );
}
