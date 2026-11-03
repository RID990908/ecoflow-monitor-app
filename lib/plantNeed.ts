// Gas plant ("planta de gas") decision helper. Pure: no React, no I/O.

// Assumptions (not reported by the backend):
// Delta 2 + extra battery, same capacity each per the backend comment (total Wh).
export const BATTERY_CAPACITY_WH = 2048;
// Output of the plant while it is running, in W.
export const PLANT_OUTPUT_W = 1200;
// SOC the plant is expected to bring the battery back to, in %.
export const PLANT_TARGET_PCT = 80;

export type PlantNeedInput = {
  percent: number;
  floorPct: number;
  pvW: number;
  outW: number;
  capacityWh: number;
  plantW: number;
  targetPct: number;
};

export type PlantNeed = {
  kind: 'ok' | 'later' | 'soon' | 'now';
  balanceW: number;
  hoursToFloor?: number;
  runHours?: number;
};

export function plantNeed({ percent, floorPct, pvW, outW, capacityWh, plantW, targetPct }: PlantNeedInput): PlantNeed {
  const balanceW = pvW - outW;
  if (balanceW >= 0) return { kind: 'ok', balanceW };

  const deficit = -balanceW;
  const usableWh = Math.max(0, ((percent - floorPct) / 100) * capacityWh);
  const hoursToFloor = usableWh / deficit;
  // With the plant on, the battery sees plant output + solar - house.
  const runHours = (((targetPct - floorPct) / 100) * capacityWh) / Math.max(plantW + balanceW, 1);
  const kind = hoursToFloor < 0.25 ? 'now' : hoursToFloor < 2 ? 'soon' : 'later';
  return { kind, balanceW, hoursToFloor, runHours };
}

// `5 h 12 min` / `2 h` / `45 min`.
export function formatHours(h: number): string {
  const m = Math.round(h * 60);
  if (m < 60) return `${m} min`;
  const rest = m % 60;
  return rest ? `${Math.floor(m / 60)} h ${String(rest).padStart(2, '0')} min` : `${Math.floor(m / 60)} h`;
}

// Compact form for node labels: `3h05` / `2h` / `45m`.
export function formatHoursShort(h: number): string {
  const m = Math.round(h * 60);
  if (m < 60) return `${m}m`;
  const rest = m % 60;
  return rest ? `${Math.floor(m / 60)}h${String(rest).padStart(2, '0')}` : `${Math.floor(m / 60)}h`;
}

// Wall-clock `HH:MM` (24 h) `h` hours after `nowMs`.
export function clockIn(h: number, nowMs: number): string {
  const d = new Date(nowMs + h * 3600e3);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export type PlantTone = 'ok' | 'warn' | 'bad';

export function plantTone(kind: PlantNeed['kind']): PlantTone {
  return kind === 'ok' ? 'ok' : kind === 'now' ? 'bad' : 'warn';
}

// Verdict headline shown in the plant card.
export function plantTitle(need: PlantNeed): string {
  const h = need.hoursToFloor ?? 0;
  if (need.kind === 'ok') return 'No es necesaria';
  if (need.kind === 'now') return 'Enciéndela ya';
  if (need.kind === 'soon') return `Enciéndela en ${formatHours(h)}`;
  return `Necesaria más tarde, en ${formatHours(h)}`;
}

// Short verdict for the Planta node label.
export function plantNodeLabel(need: PlantNeed): string {
  const h = need.hoursToFloor ?? 0;
  if (need.kind === 'ok') return 'No necesaria';
  if (need.kind === 'now') return 'Encender ya';
  if (need.kind === 'soon') return `Encender en ${formatHoursShort(h)}`;
  return `En ${formatHoursShort(h)}`;
}
