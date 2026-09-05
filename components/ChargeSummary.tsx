import { StyleSheet, View } from 'react-native';
import type { Device } from '../types';
import { BatteryIcon } from './icons/BatteryIcon';

// Resumen colapsado de "Estado de carga": 1 ícono si todos los dispositivos
// del grupo están igual (verde cargado / rojo descargado), o una fila de
// mini íconos por dispositivo cuando el estado es mixto. Siempre muestra
// algo — nunca queda vacío, el color ya cuenta la historia sin abrir el
// grupo.
export function ChargeSummary({ devices }: { devices: Device[] }) {
  if (devices.length === 0) return null;
  const allCharged = devices.every((d) => d.charged);
  const allDischarged = devices.every((d) => !d.charged);
  if (allCharged || allDischarged) {
    return <BatteryIcon state={allCharged ? 'charging' : 'discharging'} size={15} />;
  }
  return (
    <View style={styles.summaryRow}>
      {devices.map((d) => (
        <BatteryIcon key={d.key} state={d.charged ? 'charging' : 'discharging'} size={15} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
