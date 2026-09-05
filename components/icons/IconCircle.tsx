import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FlowState } from '../../types';
import { COLORS, flowColor } from '../../theme';

export function IconCircle({
  emoji,
  icon,
  state,
  watts,
  dirLabel,
  name,
}: {
  emoji?: string;
  icon?: ReactNode;
  state: FlowState;
  watts: string;
  dirLabel?: string;
  name: string;
}) {
  const bg = state === 'charging' ? COLORS.chargingBg : state === 'discharging' ? COLORS.dischargingBg : '#1c232b';
  const dirColor = flowColor(state);
  return (
    <View style={styles.iconItem}>
      <View style={[styles.iconCircle, { backgroundColor: bg }]}>
        {icon ?? <Text style={{ fontSize: 22 }}>{emoji}</Text>}
      </View>
      <Text style={styles.iconWatts}>{watts}</Text>
      {dirLabel ? <Text style={[styles.iconDir, { color: dirColor }]}>{dirLabel}</Text> : null}
      <Text style={styles.iconName}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconItem: { alignItems: 'center', width: 84 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  iconWatts: { fontSize: 12, color: COLORS.dim, marginTop: 5, fontVariant: ['tabular-nums'] },
  iconDir: { fontSize: 11, marginTop: 1, color: COLORS.dim, height: 14 },
  iconName: { fontSize: 10, color: COLORS.faint, marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase' },
});
