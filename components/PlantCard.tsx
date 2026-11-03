import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, PLANT_TONE_COLOR } from '../theme';
import type { AcOrigin } from '../lib/acOrigin';
import {
  NIGHT_START_HOUR,
  clockIn,
  formatHours,
  plantTitle,
  plantTone,
  type PlantNeed,
} from '../lib/plantNeed';

export function PlantCard({
  percent,
  need,
  hasAc,
  lastAcShort,
  origin,
  now,
}: {
  percent: number;
  need: PlantNeed;
  hasAc: boolean;
  lastAcShort?: string | null;
  origin: AcOrigin;
  now: number;
}) {
  const gridBack = hasAc && origin === 'grid';
  // The card answers one question: will the plant be needed? Any AC input
  // (street grid or the plant itself) answers it already; only on solar alone
  // is it computed from sun vs. house consumption.
  const pctText = (v: number) => `${Math.round(v)}%`;
  const nightText = `${NIGHT_START_HOUR}:00`;

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
        : 'Está entrando CA. Toca Red o Planta arriba para marcar de dónde viene.';
  } else if (need.kind === 'ok') {
    title = plantTitle(need);
    tone = PLANT_TONE_COLOR[plantTone(need.kind)];
    reason = (
      <>
        {need.hoursToNight > 0 ? 'Llegas' : 'Estás'} a las {nightText} con{' '}
        <Text style={styles.strong}>{pctText(need.projectedPct)}</Text>, y para pasar la noche necesitas{' '}
        <Text style={styles.strong}>{pctText(need.requiredPct)}</Text>.
      </>
    );
  } else {
    title = plantTitle(need);
    tone = PLANT_TONE_COLOR[plantTone(need.kind)];
    reason = (
      <>
        {need.hoursToNight > 0 ? 'A' : 'Son más de'} las {nightText} {need.hoursToNight > 0 ? 'llegarías con' : 'y tienes'}{' '}
        <Text style={styles.strong}>{pctText(need.projectedPct)}</Text> y necesitas{' '}
        <Text style={styles.strong}>{pctText(need.requiredPct)}</Text>. Hacen falta ~
        <Text style={styles.strong}>{formatHours(need.runHours ?? 0)}</Text> de planta
        {need.kind === 'now' ? '.' : <> (empieza antes de las <Text style={styles.strong}>{clockIn(need.startInHours ?? 0, now)}</Text>).</>}
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

      {!hasAc ? (
        <View style={styles.stats}>
          <Stat label="Ahora" value={pctText(percent)} />
          <Stat label={`A las ${nightText}`} value={pctText(need.projectedPct)} />
          <Stat
            label="Necesitas"
            value={pctText(need.requiredPct)}
            color={need.projectedPct >= need.requiredPct ? COLORS.green : COLORS.red}
          />
        </View>
      ) : null}

      {lastAcShort || gridBack ? (
        <Text style={styles.clock}>
          {gridBack ? (
            'Red restablecida'
          ) : (
            <>
              Sin red <Text style={styles.strong}>{lastAcShort}</Text>
            </>
          )}
        </Text>
      ) : null}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
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
  clock: { marginTop: 10, fontSize: 12, color: COLORS.dim },
  strong: { color: COLORS.text, fontVariant: ['tabular-nums'], fontWeight: '700' },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  verdictDot: { width: 10, height: 10, borderRadius: 5 },
  verdictText: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  stats: { flexDirection: 'row', marginTop: 12, borderRadius: 12, backgroundColor: COLORS.nodeBg, borderWidth: 1, borderColor: COLORS.border },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  statLabel: { fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: COLORS.faint, fontWeight: '600' },
  statValue: { marginTop: 2, fontSize: 14, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },
  facts: { marginTop: 10, fontSize: 12, color: COLORS.dim, lineHeight: 18.5 },
});
