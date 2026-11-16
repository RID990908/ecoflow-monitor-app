// Colour rule of the liquid sphere (pure, unit-testable).
export type SphereState = 'charging' | 'at_risk' | 'ok' | null;

export type SphereFill = {
  // Vertical gradient from the liquid surface (offset 0) to the bottom (offset 1).
  stops: { offset: number; color: string }[];
  glow: string;
  // Light tint of the tone at the liquid surface (glass light, upper left).
  light: string;
  // Light tint of the tone at the bottom of the liquid; differs from `light` only
  // in the mixed state (green above the target, yellow below it).
  lightBottom: string;
};

const YELLOW = { top: '#eab308', bottom: '#ca8a04', glow: '#eab308', light: '#fde68a' };
const GREEN = { top: '#16a34a', bottom: '#15803d', glow: '#16a34a', light: '#6ee7a0' };

const solid = (t: typeof YELLOW) => [
  { offset: 0, color: t.top },
  { offset: 1, color: t.bottom },
];

const paint = (
  stops: SphereFill['stops'],
  top: typeof YELLOW,
  bottom: typeof YELLOW,
): SphereFill => ({ stops, glow: top.glow, light: top.light, lightBottom: bottom.light });

export function sphereFill(
  state: SphereState,
  pct: number,
  targetPct?: number | null,
): SphereFill {
  if (state === 'at_risk') return paint(solid(YELLOW), YELLOW, YELLOW);
  if (state !== 'charging') return paint(solid(GREEN), GREEN, GREEN);
  // While charging, keep the liquid itself yellow like the reference state;
  // the dark empty portion above the level communicates the remaining fill.
  if (targetPct == null) return paint(solid(YELLOW), YELLOW, YELLOW);

  const level = Math.min(Math.max(pct, 0), 100);
  const target = Math.min(Math.max(targetPct, 0), 100);
  if (level <= target) return paint(solid(YELLOW), YELLOW, YELLOW);
  if (target <= 0) return paint(solid(GREEN), GREEN, GREEN);

  // Share of the liquid's height (from the surface) that lies above the target level.
  const cut = (level - target) / level;
  return paint(
    [
      { offset: 0, color: GREEN.top },
      { offset: cut, color: GREEN.bottom },
      { offset: cut, color: YELLOW.top },
      { offset: 1, color: YELLOW.bottom },
    ],
    GREEN,
    YELLOW,
  );
}
