import { Fragment } from 'react';
import { StyleSheet, Text } from 'react-native';
import { BatteryIcon } from './BatteryIcon';
import { TowerIcon } from './TowerIcon';

// El emoji de fuente (status.source_emoji) puede venir combinado del backend
// (ej. "☀️/🔋" cuando usa solar + batería a la vez), no siempre "🔋" solo —
// por eso el match exacto no alcanzaba. Se parte el string por 🔋 y esa
// parte puntual se reemplaza por el ícono; el resto (☀️, /, 🔌) queda igual.
export function SourceEmoji({ value }: { value?: string }) {
  if (!value) return null;
  if (value === '🔌') return <TowerIcon size={20} />;
  if (!value.includes('🔋')) return <Text style={styles.emoji}>{value}</Text>;
  const parts = value.split('🔋');
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part ? <Text style={styles.emoji}>{part}</Text> : null}
          {i < parts.length - 1 ? <BatteryIcon state="charging" size={20} /> : null}
        </Fragment>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  emoji: { fontSize: 22, marginTop: 2 },
});
