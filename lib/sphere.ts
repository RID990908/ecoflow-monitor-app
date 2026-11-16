// Colour rule of the liquid sphere (pure, unit-testable).
export type SphereState = 'charging' | 'at_risk' | 'ok' | null;

export type SphereFill = {
  // Vertical gradient from the liquid surface (offset 0) to the bottom (offset 1).
  stops: { offset: number; color: string }[];
  glow: string;
};

const YELLOW = { top: '#eab308', bottom: '#ca8a04', glow: '#eab308' };
const GREEN = { top: '#16a34a', bottom: '#15803d', glow: '#16a34a' };

const solid = (t: typeof YELLOW) => [
  { offset: 0, color: t.top },
  { offset: 1, color: t.bottom },
];

export function sphereFill(
  state: SphereState,
  pct: number,
  targetPct?: number | null,
): SphereFill {
  if (state === 'at_risk') return { stops: solid(YELLOW), glow: YELLOW.glow };
  if (state !== 'charging' || targetPct == null) return { stops: solid(GREEN), glow: GREEN.glow };

  const level = Math.min(Math.max(pct, 0), 100);
  const target = Math.min(Math.max(targetPct, 0), 100);
  if (level <= target) return { stops: solid(YELLOW), glow: YELLOW.glow };
  if (target <= 0) return { stops: solid(GREEN), glow: GREEN.glow };

  // Share of the liquid's height (from the surface) that lies above the target level.
  const cut = (level - target) / level;
  return {
    stops: [
      { offset: 0, color: GREEN.top },
      { offset: cut, color: GREEN.bottom },
      { offset: cut, color: YELLOW.top },
      { offset: 1, color: YELLOW.bottom },
    ],
    glow: GREEN.glow,
  };
}
