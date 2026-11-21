// Colour rule of the liquid sphere (pure, unit-testable): one solid colour,
// decided only by the battery %. Decimals count (19.9 is already red).
type SphereFill = {
  // Vertical gradient from the liquid surface (offset 0) to the bottom (offset 1).
  stops: { offset: number; color: string }[];
  glow: string;
  // Light tint of the tone at the liquid surface (glass light, upper left).
  light: string;
};

// From this % up the sphere is green; below it, yellow until YELLOW_MIN_PCT; below that, red.
const GREEN_MIN_PCT = 40;
const YELLOW_MIN_PCT = 20;

const GREEN = { top: '#16a34a', bottom: '#15803d', glow: '#16a34a', light: '#6ee7a0' };
const YELLOW = { top: '#eab308', bottom: '#ca8a04', glow: '#eab308', light: '#fde68a' };
const RED = { top: '#ef4444', bottom: '#b91c1c', glow: '#ef4444', light: '#fca5a5' };

export function sphereFill(pct: number): SphereFill {
  const tone = pct >= GREEN_MIN_PCT ? GREEN : pct >= YELLOW_MIN_PCT ? YELLOW : RED;
  return {
    stops: [
      { offset: 0, color: tone.top },
      { offset: 1, color: tone.bottom },
    ],
    glow: tone.glow,
    light: tone.light,
  };
}
