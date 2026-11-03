import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FlowState } from '../../types';
import { COLORS, flowBg, flowColor, flowNodeStyle } from '../../theme';

export function IconCircle({
  emoji,
  icon,
  state,
  watts,
  dirLabel,
  dirColor,
  name,
}: {
  emoji?: string;
  icon?: ReactNode;
  state: FlowState;
  watts: string;
  dirLabel?: string;
  dirColor?: string;
  name: string;
}) {
  const labelColor = dirColor ?? flowColor(state);
  return (
    <View style={styles.iconItem}>
      <View style={[styles.iconCircle, { backgroundColor: flowBg(state) }, flowNodeStyle(state)]}>
        {icon ?? <Text style={{ fontSize: 23 }}>{emoji}</Text>}
      </View>
      <Text style={[styles.iconWatts, state !== 'neutral' && styles.iconWattsActive]}>{watts}</Text>
      {dirLabel ? <Text style={[styles.iconDir, { color: labelColor }]}>{dirLabel}</Text> : null}
      <Text style={styles.iconName}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconItem: { alignItems: 'center', width: 96 },
  iconCircle: {
    width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  iconWatts: { fontSize: 13, color: COLORS.dim, marginTop: 6, fontWeight: '600', fontVariant: ['tabular-nums'] },
  iconWattsActive: { color: COLORS.text },
  iconDir: { fontSize: 11, marginTop: 1, color: COLORS.dim, height: 14 },
  iconName: { fontSize: 10, color: COLORS.faint, marginTop: 2, letterSpacing: 0.8, fontWeight: '600', textTransform: 'uppercase' },
});
