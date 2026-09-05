import { StyleSheet, Text, View } from 'react-native';
import type { FlowState } from '../../types';
import { COLORS } from '../../theme';
import { BatteryIcon } from './BatteryIcon';

// Nodo lateral compacto (hook que sale del anillo hacia Delta 2/Batería
// Extra) — versión angosta de IconCircle, sin dirLabel (el web tampoco lo
// muestra ahí, ver .icon-item.lateral-icon en ecoflow_telegram_monitor.py).
export function LateralIcon({
  state,
  watts,
  name,
  side,
  pct,
  remain,
}: {
  state: FlowState;
  watts: string;
  name: string;
  side: 'left' | 'right';
  // pct/remain: % y tiempo de carga o descarga DE ESTA batería puntual
  // (no el combinado del centro del aro) — antes vivían en una tarjeta
  // aparte arriba a la izquierda (BatteriesSection/BatteryRow), movidos
  // acá a pedido del usuario para tener todo junto al nodo del aro. remain
  // ya viene calculado por el backend contemplando ambas direcciones
  // (charging/discharging), no hace falta re-derivarlo acá.
  pct?: number | null;
  remain?: { charging: boolean; text: string } | null;
}) {
  const bg = state === 'charging' ? COLORS.chargingBg : state === 'discharging' ? COLORS.dischargingBg : '#1c232b';
  const remainColor = remain ? (remain.charging ? COLORS.green : COLORS.red) : undefined;
  return (
    <View style={side === 'right' ? styles.lateralIconRight : styles.lateralIconLeft}>
      <View style={[styles.lateralIconCircle, { backgroundColor: bg }]}>
        <BatteryIcon state={state} size={17} />
      </View>
      <Text style={styles.lateralIconWatts}>{watts}</Text>
      <Text style={styles.lateralIconName}>{name}</Text>
      {pct != null ? <Text style={styles.lateralIconPct}>{pct.toFixed(1)}%</Text> : null}
      {remain ? <Text style={[styles.lateralIconRemain, { color: remainColor }]}>{remain.text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lateralIconRight: { position: 'absolute', left: 34, top: 18, width: 56, alignItems: 'center' },
  lateralIconLeft: { position: 'absolute', left: -90, top: 18, width: 56, alignItems: 'center' },
  lateralIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  lateralIconWatts: { fontSize: 11, color: COLORS.dim, marginTop: 3, fontVariant: ['tabular-nums'] },
  lateralIconName: { fontSize: 9, color: COLORS.faint, marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase' },
  lateralIconPct: { fontSize: 12, fontWeight: '700', color: '#e5e7eb', marginTop: 3, fontVariant: ['tabular-nums'] },
  lateralIconRemain: { fontSize: 10, fontWeight: '600', marginTop: 1, fontVariant: ['tabular-nums'] },
});
