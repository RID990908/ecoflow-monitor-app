import { StyleSheet, View } from 'react-native';
import type { Device } from '../types';
import { COLORS } from '../theme';

// Grupos colapsados (Ventilador/Power bank) ya no resumen on/off (a pedido
// del usuario, no se marca encendido/apagado): resumen
// mismo patrón visual pero basado en fits (entra o no en el excedente
// actual), igual que el punto 🟢/🔴 de cada fila individual.
export function PowerSummary({ devices }: { devices: Device[] }) {
  const withFits = devices.filter((d) => d.fits != null);
  if (withFits.length === 0) return null;
  const allFits = withFits.every((d) => d.fits);
  const noneFits = withFits.every((d) => !d.fits);
  if (allFits || noneFits) {
    return <View style={[styles.summaryDotMini, { backgroundColor: allFits ? COLORS.green : COLORS.red }]} />;
  }
  return (
    <View style={styles.summaryRow}>
      {withFits.map((d) => (
        <View key={d.key} style={[styles.summaryDotMini, { backgroundColor: d.fits ? COLORS.green : COLORS.red }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryDotMini: { width: 12, height: 12, borderRadius: 6 },
});
