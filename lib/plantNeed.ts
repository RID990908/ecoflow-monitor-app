// Gas plant ("planta de gas") decision helper. Pure: no React, no I/O.

// Assumptions (not reported by the backend):
// Delta 2 + extra battery, same capacity each per the backend comment (total Wh).
export const BATTERY_CAPACITY_WH = 2048;
// Output of the plant while it is running, in W.
export const PLANT_OUTPUT_W = 1200;
// Hour of day (local, 24 h) by which the battery must be ready for the night.
const NIGHT_START_HOUR = 21;
// Hours the night lasts (until the sun is back), used to size the reserve.
const NIGHT_HOURS = 10;
// The plant is never started before this hour of day (local, 24 h).
const PLANT_EARLIEST_HOUR = 9;
// Shortest run worth starting the plant for, in hours: a shorter gap is
// covered by running it this long, ending at NIGHT_START_HOUR.
const PLANT_MIN_RUN_HOURS = 1;
// Assumed house load overnight, in W. Today's reading is too noisy to size it.
const NIGHT_LOAD_W = 150;

type PlantNeedInput = {
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
  // Battery % needed at NIGHT_START_HOUR to last NIGHT_HOURS at NIGHT_LOAD_W.
  requiredPct: number;
  // Hours after NIGHT_START_HOUR that projectedPct lasts at NIGHT_LOAD_W.
  lastsHours: number;
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
  const lastsHours = (Math.max(0, projectedPct - floorPct) / 100 * capacityWh) / NIGHT_LOAD_W;
  const requiredPct = Math.min(100, floorPct + ((NIGHT_LOAD_W * NIGHT_HOURS) / capacityWh) * 100);
  if (projectedPct >= requiredPct) return { kind: 'ok', balanceW, projectedPct, requiredPct, lastsHours, hoursToNight };

  if (hoursToNight === 0) {
    const hoursToFloor = (Math.max(0, percent - floorPct) / 100 * capacityWh) / NIGHT_LOAD_W;
    return { kind: 'night', balanceW, projectedPct, requiredPct, lastsHours, hoursToNight, hoursToFloor };
  }

  // With the plant on, the battery sees plant output + solar - house.
  const gapWh = ((requiredPct - projectedPct) / 100) * capacityWh;
  const runHours = Math.max(gapWh / Math.max(plantW + balanceW, 1), PLANT_MIN_RUN_HOURS);
  // Starting late only works if the battery survives until then: at the
  // current balance it hits the reserve after `hoursToFloor`, so the plant
  // cannot start any later than that (0 when it is already at or below it).
  const hoursToFloor =
    percent <= floorPct ? 0 : balanceW < 0 ? ((percent - floorPct) / 100 * capacityWh) / -balanceW : Infinity;
  const earliest = new Date(nowMs);
  earliest.setHours(PLANT_EARLIEST_HOUR, 0, 0, 0);
  const hoursToEarliest = Math.max(0, (earliest.getTime() - nowMs) / 3600e3);
  // Never before the earliest hour, even if the battery runs out first.
  const startInHours = Math.max(Math.min(hoursToNight - runHours, hoursToFloor), hoursToEarliest);
  const kind = startInHours <= 0 ? 'now' : startInHours < 2 ? 'soon' : 'later';
  return { kind, balanceW, projectedPct, requiredPct, lastsHours, hoursToNight, startInHours, runHours };
}

// Wall-clock `HH:MM` (24 h) of an epoch in ms, in the phone's time zone.
export function clockAt(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
