import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

// Badge circular fijo para headers de grupo (Ventilador ×3, Power bank ×2):
// mismo estilo de nodo que usa el diagrama (iconCircle/lateralIconCircle),
// con el ícono dibujado a mano correspondiente adentro en vez del emoji del
// dispositivo — evita el problema de glifos de emoji con métrica vertical
// distinta (🔋 vs 🌀).
export function GroupIconBadge({ bg = 'transparent', size = 26, children }: { bg?: string; size?: number; children: ReactNode }) {
  return (
    <View style={[styles.groupIconCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  groupIconCircle: { alignItems: 'center', justifyContent: 'center' },
});
