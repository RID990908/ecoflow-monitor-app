// Night plan for the gas plant ("planta de gas"). Pure: no React, no I/O.
//
// The backend decides when to run the plant and for how long so the battery
// reaches 07:00 with the reserve without running past the quiet hours; this
// file only turns that plan into what the screen shows.

export type PlantPlanKind = 'plan' | 'now' | 'urgent' | 'no_time' | 'not_needed' | 'short';

export type PlantPlan = {
  kind: PlantPlanKind;
  // Epoch in seconds of the planned start (only for `plan`; the pill no longer shows it).
  start_ts: number | null;
  minutes: number | null;
  // Fixed battery % that is enough to reach the next 08:00 with the reserve
  // when it is there at 22:00 (null in the `short` state: not even 100% is enough).
  target_pct: number | null;
  // Battery % at the next 08:00 without the plant (only for `not_needed`).
  end_pct: number | null;
  // Epoch in seconds when even a full battery at 22:00 runs out (only for `short`).
  until_ts: number | null;
};

export type PlantTone = 'amber' | 'red' | 'green';

export type PlantPill = { text: string; tone: PlantTone };

// Wall-clock `HH:MM` (24 h) of an epoch in ms, in the phone's time zone.
export function clockAt(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 45 -> "45 min"; 185 -> "3h 05m" (long runs read better in hours).
function duration(minutes: number): string {
  if (minutes < 120) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

// Quiet hours start at 22:00 (phone time); the plant plan is anchored to it.
const QUIET_START_HOUR = 22;

// Minutes from `nowMs` until the next 22:00 in the phone's time zone.
function minutesToQuiet(nowMs: number): number {
  const now = new Date(nowMs);
  const quiet = new Date(nowMs);
  quiet.setHours(QUIET_START_HOUR, 0, 0, 0);
  return Math.max(0, (quiet.getTime() - now.getTime()) / 60000);
}

// The panel between Entrada and Salida; null when there is nothing to say.
// Before the plant has to start it only says "Ahora" (amber: it can be run any
// time until 22:00); once the start time is reached it adds the minutes, and
// goes red when less than an hour is left until 22:00.
export function plantPill(
  plan: PlantPlan | null | undefined,
  percent: number,
  nowMs: number = Date.now(),
): PlantPill | null {
  if (!plan) return null;
  switch (plan.kind) {
    case 'plan':
      return plan.target_pct != null && percent < plan.target_pct ? { text: 'Ahora', tone: 'amber' } : null;
    case 'now':
    case 'urgent':
      return plan.minutes != null
        ? { text: `Ahora · ${duration(plan.minutes)}`, tone: minutesToQuiet(nowMs) < 60 ? 'red' : 'amber' }
        : null;
    case 'no_time':
      return { text: 'No da tiempo', tone: 'red' };
    case 'short':
      return { text: 'No alcanza', tone: 'red' };
    case 'not_needed':
      return plan.end_pct != null ? { text: `Sin planta · ${Math.round(plan.end_pct)}%`, tone: 'green' } : null;
    default:
      return null;
  }
}
