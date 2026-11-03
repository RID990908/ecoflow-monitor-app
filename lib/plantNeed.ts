// Gas plant ("planta de gas") decision helper. Pure: no React, no I/O.

// Assumptions (not reported by the backend):
// Delta 2 + extra battery, same capacity each per the backend comment (total Wh).
export const BATTERY_CAPACITY_WH = 2048;
// Output of the plant while it is running, in W.
export const PLANT_OUTPUT_W = 1200;
// Hour of day (local, 24 h) by which the battery must be ready for the night.
export const NIGHT_START_HOUR = 21;
// Hours the night lasts (until the sun is back), used to size the reserve.
export const NIGHT_HOURS = 10;
// Assumed house load overnight, in W. Today's reading is too noisy to size it.
export const NIGHT_LOAD_W = 150;

export type PlantNeedInput = {
  percent: number;
  floorPct: number;
  pvW: number;
  outW: number;
  capacityWh: number;
  plantW: number;
  nowMs: number;
};

export type PlantNeed = {
  // 'night': past NIGHT_START_HOUR the plant is never started, so there is
  // no plant verdict, only how long the battery lasts.
  kind: 'ok' | 'later' | 'soon' | 'now' | 'night';
  balanceW: number;
  // Projected battery % at NIGHT_START_HOUR (current % once that hour passed).
  projectedPct: number;
  // Battery % needed at NIGHT_START_HOUR to get through the night.
  requiredPct: number;
  // Hours left until NIGHT_START_HOUR (0 once it passed).
  hoursToNight: number;
  // Hours until the battery hits the reserve at the assumed night load (kind 'night').
  hoursToFloor?: number;
  // Hours from now until the plant has to be started to still make it.
  startInHours?: number;
  // Hours the plant has to run to close the gap.
  runHours?: number;
};

// "Will we reach 21:00 with enough charge to get through the night?" The
// projection keeps today's net power (sun minus house) constant until then:
// optimistic in the afternoon, because the sun fades.
export function plantNeed({ percent, floorPct, pvW, outW, capacityWh, plantW, nowMs }: PlantNeedInput): PlantNeed {
  const balanceW = pvW - outW;
  const night = new Date(nowMs);
  night.setHours(NIGHT_START_HOUR, 0, 0, 0);
  const hoursToNight = Math.max(0, (night.getTime() - nowMs) / 3600e3);

  const projectedPct = Math.min(100, Math.max(0, percent + ((balanceW * hoursToNight) / capacityWh) * 100));
  const requiredPct = Math.min(100, floorPct + ((NIGHT_LOAD_W * NIGHT_HOURS) / capacityWh) * 100);
  if (projectedPct >= requiredPct) return { kind: 'ok', balanceW, projectedPct, requiredPct, hoursToNight };

  if (hoursToNight === 0) {
    const hoursToFloor = (Math.max(0, percent - floorPct) / 100 * capacityWh) / NIGHT_LOAD_W;
    return { kind: 'night', balanceW, projectedPct, requiredPct, hoursToNight, hoursToFloor };
  }

  // With the plant on, the battery sees plant output + solar - house.
  const gapWh = ((requiredPct - projectedPct) / 100) * capacityWh;
  const runHours = gapWh / Math.max(plantW + balanceW, 1);
  const startInHours = hoursToNight - runHours;
  const kind = startInHours <= 0 ? 'now' : startInHours < 2 ? 'soon' : 'later';
  return { kind, balanceW, projectedPct, requiredPct, hoursToNight, startInHours, runHours };
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
  const h = need.startInHours ?? 0;
  if (need.kind === 'ok') return 'No es necesaria';
  if (need.kind === 'night') return 'Sin planta esta noche';
  if (need.kind === 'now') return 'Enciéndela ya';
  if (need.kind === 'soon') return `Enciéndela en ${formatHours(h)}`;
  return `Necesaria, enciéndela en ${formatHours(h)}`;
}

// Short verdict for the Planta node label.
export function plantNodeLabel(need: PlantNeed): string {
  const h = need.startInHours ?? 0;
  if (need.kind === 'ok') return 'No necesaria';
  if (need.kind === 'night') return 'Pasadas las 21h';
  if (need.kind === 'now') return 'Encender ya';
  if (need.kind === 'soon') return `Encender en ${formatHoursShort(h)}`;
  return `En ${formatHoursShort(h)}`;
}
