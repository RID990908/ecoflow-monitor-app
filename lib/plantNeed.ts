// Night plan for the gas plant ("planta de gas"). Pure: no React, no I/O.
//
// The backend decides when to run the plant and for how long so the battery
// reaches 07:00 with the reserve without running past the quiet hours; this
// file only turns that plan into what the screen shows.

export type PlantPlanKind = 'plan' | 'now' | 'urgent' | 'no_time' | 'not_needed' | 'short';

export type PlantPlan = {
  kind: PlantPlanKind;
  // Epoch in seconds of the planned start (only for `plan`).
  start_ts: number | null;
  minutes: number | null;
  // Battery % needed now to reach the next 08:00 with the reserve if the plant
  // stopped now (for `plan`, `now` and `urgent`; null when it is above 100%; 100 for `short`).
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

// The panel between Entrada and Salida; null when there is nothing to say.
export function plantPill(plan: PlantPlan | null | undefined): PlantPill | null {
  if (!plan) return null;
  switch (plan.kind) {
    case 'plan':
      return plan.start_ts != null && plan.minutes != null
        ? { text: `${clockAt(plan.start_ts * 1000)} · ${duration(plan.minutes)}`, tone: 'amber' }
        : null;
    case 'now':
      return plan.minutes != null ? { text: `Ahora · ${duration(plan.minutes)}`, tone: 'amber' } : null;
    case 'urgent':
      return plan.minutes != null ? { text: `Ahora · ${duration(plan.minutes)}`, tone: 'red' } : null;
    case 'no_time':
      return { text: 'No da tiempo', tone: 'red' };
    case 'short':
      return plan.until_ts != null ? { text: `Solo hasta ${clockAt(plan.until_ts * 1000)}`, tone: 'red' } : null;
    case 'not_needed':
      return plan.end_pct != null ? { text: `Sin planta · ${Math.round(plan.end_pct)}%`, tone: 'green' } : null;
    default:
      return null;
  }
}

// Plant icon over the ring (replaces the green dot): amber while there is a
// plan, red when time is running out; none when the plant is not needed.
export function plantIconTone(plan: PlantPlan | null | undefined): 'amber' | 'red' | null {
  if (!plan) return null;
  if (plan.kind === 'plan' || plan.kind === 'now') return 'amber';
  if (plan.kind === 'urgent' || plan.kind === 'no_time' || plan.kind === 'short') return 'red';
  return null;
}

// Where the translucent segment under the green arc ends: the battery % that
// is needed. Null when there is nothing to draw (already reached, or the plan
// has no target).
export function plantGhostTo(plan: PlantPlan | null | undefined, percent: number): number | null {
  if (!plan || (plan.kind !== 'plan' && plan.kind !== 'now' && plan.kind !== 'urgent' && plan.kind !== 'short')) return null;
  return plan.target_pct != null && plan.target_pct > percent ? Math.min(plan.target_pct, 100) : null;
}
