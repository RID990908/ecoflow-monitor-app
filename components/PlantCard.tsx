import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, PLANT_TONE_COLOR } from '../theme';
import { AcSourceSelector, type AcOrigin } from './AcSourceSelector';
import {
  PLANT_OUTPUT_W,
  PLANT_TARGET_PCT,
  BATTERY_CAPACITY_WH,
  clockIn,
  formatHours,
  plantNeed,
  plantTitle,
  plantTone,
} from '../lib/plantNeed';

const PILL_UNCLASSIFIED_BG = 'rgba(234,179,8,0.14)';
const PILL_CLASSIFIED_BG = 'rgba(74,222,128,0.14)';
const PILL_NONE_BG = 'rgba(255,255,255,0.05)';

export function PlantCard({
  percent,
  floorPct,
  pvW,
  outW,
  hasAc,
  lastAcShort,
  origin,
  onOriginChange,
  gridOut,
  onGridBack,
  now,
}: {
  percent: number;
  floorPct: number;
  pvW: number;
  outW: number;
  hasAc: boolean;
  lastAcShort?: string | null;
  origin: AcOrigin;
  onOriginChange: (next: AcOrigin) => void;
  gridOut: boolean;
  onGridBack: () => void;
  now: number;
}) {
  const unclassified = origin === 'unclassified';
  const pill = !hasAc
    ? { text: 'Sin CA', bg: PILL_NONE_BG, color: COLORS.dim }
    : unclassified
      ? { text: 'CA detectada · sin clasificar', bg: PILL_UNCLASSIFIED_BG, color: COLORS.yellow }
      : {
          text: origin === 'grid' ? 'CA de la red (calle)' : 'CA de la planta de gas',
          bg: PILL_CLASSIFIED_BG,
          color: COLORS.green,
        };

  const gridBack = hasAc && origin === 'grid';
  // The card answers one question: will the plant be needed? Any AC input
  // (street grid or the plant itself) answers it already; only on solar alone
  // is it computed from sun vs. house consumption.
  const need = plantNeed({
    percent,
    floorPct,
    pvW,
    outW,
    capacityWh: BATTERY_CAPACITY_WH,
    plantW: PLANT_OUTPUT_W,
    targetPct: PLANT_TARGET_PCT,
  });

  let title: string;
  let tone: string;
  let reason: ReactNode;
  if (hasAc && origin === 'plant') {
    title = 'Planta en uso';
    tone = COLORS.green;
    reason = 'La CA que entra viene de la planta de gas.';
  } else if (hasAc) {
    title = 'No es necesaria';
    tone = COLORS.green;
    reason =
      origin === 'grid'
        ? 'La red de la calle está entregando CA.'
        : 'Está entrando CA. Si viene de la planta, márcalo abajo.';
  } else if (need.kind === 'ok') {
    title = plantTitle(need);
    tone = PLANT_TONE_COLOR[plantTone(need.kind)];
    reason = (
      <>
        El sol cubre la casa y sobran <Text style={styles.strong}>{need.balanceW} W</Text>. La batería se mantiene o
        sube.
      </>
    );
  } else {
    title = plantTitle(need);
    tone = PLANT_TONE_COLOR[plantTone(need.kind)];
    reason = (
      <>
        La batería llega al <Text style={styles.strong}>{floorPct}%</Text> en{' '}
        <Text style={styles.strong}>{formatHours(need.hoursToFloor ?? 0)}</Text> (≈{' '}
        <Text style={styles.strong}>{clockIn(need.hoursToFloor ?? 0, now)}</Text>). Ya encendida, ~
        <Text style={styles.strong}>{formatHours(need.runHours ?? 0)}</Text> para volver al{' '}
        <Text style={styles.strong}>{PLANT_TARGET_PCT}%</Text>.
      </>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Planta de gas</Text>
        <Text style={styles.title}>Batería {percent.toFixed(1)}%</Text>
      </View>

      <View style={styles.verdict}>
        <View style={[styles.verdictDot, { backgroundColor: tone, boxShadow: `0 0 10px ${tone}` }]} />
        <Text style={[styles.verdictText, { color: tone }]}>{title}</Text>
      </View>
      <Text style={styles.facts}>{reason}</Text>

      <View style={styles.divider} />

      <View style={styles.line}>
        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.pillText, { color: pill.color }]}>{pill.text}</Text>
        </View>
        {gridBack ? (
          <Text style={styles.clock}>Red restablecida</Text>
        ) : lastAcShort ? (
          <Text style={styles.clock}>
            Sin red <Text style={styles.strong}>{lastAcShort}</Text>
          </Text>
        ) : null}
      </View>

      {hasAc && !gridOut ? <AcSourceSelector origin={origin} onChange={onOriginChange} /> : null}

      {hasAc && gridOut ? (
        <View style={styles.gridOutRow}>
          <Text style={styles.note}>Sin red de la calle: se asume que la CA viene de la planta.</Text>
          <Pressable accessibilityRole="button" onPress={onGridBack} style={styles.gridBackBtn}>
            <Text style={styles.gridBackText}>Volvió la red</Text>
          </Pressable>
        </View>
      ) : null}

      {hasAc && !gridOut ? (
        <Text style={styles.note}>
          {unclassified
            ? 'El contador no espera tu respuesta: la CA cuenta desde que llegó y tu elección se aplica hacia atrás.'
            : 'Aplicado desde que llegó la CA. Puedes corregirlo cuando quieras.'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%', maxWidth: 340, marginTop: 14, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: COLORS.faint, fontWeight: '600' },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12 },
  pill: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 99 },
  pillText: { fontSize: 11, fontWeight: '600' },
  clock: { fontSize: 12, color: COLORS.dim, flexShrink: 1, textAlign: 'right' },
  strong: { color: COLORS.text, fontVariant: ['tabular-nums'], fontWeight: '700' },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  verdictDot: { width: 10, height: 10, borderRadius: 5 },
  verdictText: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  gridOutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  gridBackBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.nodeBg },
  gridBackText: { fontSize: 12, fontWeight: '600', color: COLORS.dim },
  divider: { height: 1, backgroundColor: COLORS.border, marginTop: 14 },
  facts: { marginTop: 10, fontSize: 12, color: COLORS.dim, lineHeight: 18.5 },
  note: { flexShrink: 1, marginTop: 8, fontSize: 11, color: COLORS.faint, lineHeight: 16 },
});
