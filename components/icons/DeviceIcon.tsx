import { StyleSheet, Text } from 'react-native';
import { AppleIcon } from './AppleIcon';
import { BatteryIcon } from './BatteryIcon';
import { FanIcon } from './FanIcon';

// Ícono dibujado a mano para un emoji de dispositivo, sin badge — para usar
// inline en cualquier fila (chargeRow/powerRow), igual que el resto de los
// emoji de dispositivo (🥶/💻/📡) que no tienen badge. Ícono SVG puro: sin
// métrica de fuente, alignItems:'center' del row padre lo centra bien solo,
// sin nudges manuales por instancia.
export function DeviceIcon({ emoji }: { emoji: string }) {
  if (emoji === '🔋') return <BatteryIcon state="charging" size={13} />;
  if (emoji === '🌀') return <FanIcon size={14} />;
  if (emoji === '') return <AppleIcon size={13} />;
  return <Text style={styles.groupEmoji}>{emoji}</Text>;
}

const styles = StyleSheet.create({
  groupEmoji: { fontSize: 15 },
});
