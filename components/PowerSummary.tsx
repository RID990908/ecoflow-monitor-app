import { StyleSheet, View } from 'react-native';
import type { Device } from '../types';
import { COLORS } from '../theme';

// Mismo patrón que ChargeSummary para "Qué tienes encendido": 1 bola si
// todos están igual (verde on / rojo off), o mini bolas cuando es mixto.
export function PowerSummary({ devices }: { devices: Device[] }) {
  if (devices.length === 0) return null;
  const allOn = devices.every((d) => d.on);
  const allOff = devices.every((d) => !d.on);
  if (allOn || allOff) {
    return <View style={[styles.summaryDotMini, { backgroundColor: allOn ? COLORS.green : COLORS.red }]} />;
  }
  return (
    <View style={styles.summaryRow}>
      {devices.map((d) => (
        <View key={d.key} style={[styles.summaryDotMini, { backgroundColor: d.on ? COLORS.green : COLORS.red }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryDotMini: { width: 12, height: 12, borderRadius: 6 },
});
