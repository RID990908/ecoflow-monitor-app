// Gas plant ("planta de gas") decision helper. Pure: no React, no I/O.

// The plant is needed when the battery is projected to reach the reserve
// threshold (the "15% a las HH:MM" line shown in the ring) before this hour
// of today (local, 24 h).
const PLANT_CUTOFF_HOUR = 23;

type PlantNeededInput = {
  percent: number;
  thresholdPct: number | null | undefined;
  // Epoch in ms of the projected threshold crossing, when the backend has one.
  thresholdAtMs: number | null | undefined;
  nowMs: number;
};

export function plantNeeded({ percent, thresholdPct, thresholdAtMs, nowMs }: PlantNeededInput): boolean {
  // Already at or below the reserve: nothing left to project.
  if (thresholdPct != null && percent <= thresholdPct) return true;
  if (thresholdAtMs == null) return false;
  const cutoff = new Date(nowMs);
  cutoff.setHours(PLANT_CUTOFF_HOUR, 0, 0, 0);
  return thresholdAtMs <= cutoff.getTime();
}

// Wall-clock `HH:MM` (24 h) of an epoch in ms, in the phone's time zone.
export function clockAt(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
