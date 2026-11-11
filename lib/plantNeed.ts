// Night plan for the gas plant ("planta de gas"). Pure: no React, no I/O.
//
// The backend decides when to run the plant and for how long so the battery
// reaches 07:00 with the reserve without running past the quiet hours; this
// file only turns that plan into what the screen shows.

export type PlantPlanKind = 'plan' | 'now' | 'urgent' | 'no_time' | 'not_needed';

export type PlantPlan = {
  kind: PlantPlanKind;
  // Epoch in seconds of the planned start (only for `plan`).
  start_ts: number | null;
  minutes: number | null;
  // Battery % when the plant stops (for `plan`, `now` and `urgent`).
  target_pct: number | null;
  // Battery % at 07:00 without the plant (only for `not_needed`).
  end_pct: number | null;
};

export type PlantTone = 'amber' | 'red' | 'green';

export type PlantPill = { text: string; tone: PlantTone };

// Wall-clock `HH:MM` (24 h) of an epoch in ms, in the phone's time zone.
export function clockAt(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// The panel between Entrada and Salida; null when there is nothing to say.
export function plantPill(plan: PlantPlan | null | undefined): PlantPill | null {
  if (!plan) return null;
  switch (plan.kind) {
    case 'plan':
      return plan.start_ts != null && plan.minutes != null
        ? { text: `${clockAt(plan.start_ts * 1000)} · ${plan.minutes} min`, tone: 'amber' }
        : null;
    case 'now':
      return plan.minutes != null ? { text: `Ahora · ${plan.minutes} min`, tone: 'amber' } : null;
    case 'urgent':
      return plan.minutes != null ? { text: `Ahora · ${plan.minutes} min`, tone: 'red' } : null;
    case 'no_time':
      return { text: 'No da tiempo', tone: 'red' };
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
  if (plan.kind === 'urgent' || plan.kind === 'no_time') return 'red';
  return null;
}

// Where the translucent segment on the ring ends: the battery % when the
// plant stops. Null when there is no segment to draw.
export function plantGhostTo(plan: PlantPlan | null | undefined, percent: number): number | null {
  if (!plan || (plan.kind !== 'plan' && plan.kind !== 'now' && plan.kind !== 'urgent')) return null;
  return plan.target_pct != null && plan.target_pct > percent ? Math.min(plan.target_pct, 100) : null;
}
