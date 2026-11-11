import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { COLORS } from '../theme';
import type { PlantPill as PlantPillData, PlantTone } from '../lib/plantNeed';
import { GeneratorIcon } from './icons/GeneratorIcon';

const TONES: Record<PlantTone, { bg: string; border: string; text: string }> = {
  amber: { bg: '#2a2208', border: '#6b5710', text: '#f5b81c' },
  red: { bg: COLORS.dischargingBg, border: '#7a2e2e', text: COLORS.red },
  green: { bg: COLORS.chargingBg, border: '#1f6b3a', text: COLORS.green },
};

// Small panel centered between Entrada and Salida: when to run the plant and
// for how long (or that it is not needed). Never covers the ring.
export function PlantPill({ pill }: { pill: PlantPillData }) {
  const tone = TONES[pill.tone];
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View
        style={[styles.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}
        accessible
        accessibilityLabel={`Planta: ${pill.text}`}
      >
        {pill.tone === 'green' ? (
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={tone.text} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : (
          <GeneratorIcon size={16} badge={pill.tone === 'red' ? COLORS.red : undefined} />
        )}
        <Text style={[styles.text, { color: tone.text }]} numberOfLines={1}>
          {pill.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 4, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  text: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
