import { StyleSheet, Text, View } from 'react-native';

type Props = {
  // Whole minutes since the last successful response; null if never connected.
  minutesAgo: number | null;
};

export function StatusBanner({ minutesAgo }: Props) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      {minutesAgo == null ? (
        <Text style={styles.text}>Conectando…</Text>
      ) : (
        <Text style={styles.text}>
          <Text style={styles.bold}>Sin conexión</Text> · datos de hace {minutesAgo} min
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginBottom: 14,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
  },
  text: { color: '#fecaca', fontSize: 12, textAlign: 'center' },
  bold: { fontWeight: '700' },
});
