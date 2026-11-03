import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';

export type AcOrigin = 'unclassified' | 'grid' | 'plant';

// Two-option segmented control: where does the AC input come from? Pressing
// the selected option again clears the choice.
export function AcSourceSelector({ origin, onChange }: { origin: AcOrigin; onChange: (next: AcOrigin) => void }) {
  const options: { value: Exclude<AcOrigin, 'unclassified'>; label: string }[] = [
    { value: 'grid', label: 'Red (calle)' },
    { value: 'plant', label: 'Planta de gas' },
  ];
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{origin === 'unclassified' ? '¿De dónde viene la CA?' : 'Origen de la CA'}</Text>
      <View style={styles.seg}>
        {options.map((o) => {
          const selected = origin === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(selected ? 'unclassified' : o.value)}
              style={[styles.btn, selected && styles.btnSelected]}
            >
              <Text style={[styles.btnText, selected && styles.btnTextSelected]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 10 },
  label: { flexShrink: 1, fontSize: 12, color: COLORS.dim },
  seg: {
    flexDirection: 'row', padding: 3, borderRadius: 99, backgroundColor: COLORS.nodeBg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  btn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99 },
  btnSelected: { backgroundColor: '#1d4a2d', boxShadow: '0 0 0 1px rgba(74,222,128,0.45)' },
  btnText: { fontSize: 12, fontWeight: '600', color: COLORS.dim },
  btnTextSelected: { color: '#d9f7e3' },
});
