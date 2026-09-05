import { StyleSheet, Text } from 'react-native';
import { BatteryIcon } from './icons/BatteryIcon';
import { FanIcon } from './icons/FanIcon';
import { GroupIconBadge } from './icons/GroupIconBadge';

// Mismo mapeo que DeviceIcon pero para el header de grupo (Ventilador ×3,
// Power bank ×2): ambos van en la misma caja circular de 26px (mismo
// estilo que los nodos del diagrama) para que las filas queden alineadas —
// battery sin fondo de color (a pedido del usuario), fan con fondo oscuro
// para contraste. Sin transform/nudge: DeviceIcon y GroupHeaderIcon usan el
// mismo BatteryIcon puro, así quedan a la misma altura relativa en
// cualquier contexto.
export function GroupHeaderIcon({ emoji }: { emoji: string }) {
  if (emoji === '🔋') {
    return (
      <GroupIconBadge>
        <BatteryIcon state="charging" size={15} />
      </GroupIconBadge>
    );
  }
  if (emoji === '🌀') {
    return (
      <GroupIconBadge bg="#33404d">
        <FanIcon size={16} />
      </GroupIconBadge>
    );
  }
  return <Text style={styles.groupEmoji}>{emoji}</Text>;
}

const styles = StyleSheet.create({
  groupEmoji: { fontSize: 15 },
});
