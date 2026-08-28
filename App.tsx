import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const API_BASE = 'https://ecoflow-monitor-production.up.railway.app';

type StatusResponse = {
  ready: boolean;
  error?: string;
  percent?: number | null;
  soc_delta2?: number | null;
  soc_extra?: number | null;
  source_verb?: string;
  source_emoji?: string;
  pv_w?: number;
  ac_w?: number;
  delta2_net_w?: number | null;
  extra_net_w?: number | null;
  has_ac?: boolean;
  in_w?: number;
  out_w?: number;
  eta_text?: string | null;
  eta_ok?: boolean | null;
  remain_duration?: string | null;
  ports?: { name: string; watts: number }[];
  updated_at?: string;
};

type CargasResponse = { message?: string; error?: string };

type Device = { key: string; label: string; emoji: string; watts: number; on: boolean };
type DevicesResponse = { devices: Device[] };

function battFlow(netW: number | null | undefined) {
  if (netW == null || (netW > -5 && netW < 5)) return { color: COLORS.gray, arrow: '' };
  if (netW > 5) return { color: COLORS.green, arrow: '↑' };
  return { color: COLORS.red, arrow: '↓' };
}

const COLORS = {
  bg: '#0b0f14',
  card: '#141b22',
  border: '#232b33',
  text: '#e5e7eb',
  dim: '#9aa4af',
  green: '#4ade80',
  red: '#f87171',
  yellow: '#eab308',
  gray: '#6b7684',
};

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [cargas, setCargas] = useState<string>('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastOk, setLastOk] = useState<number | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      const data: StatusResponse = await res.json();
      setStatus(data);
      setLastOk(Date.now());
    } catch {
      // se reintenta solo en el próximo tick, no hace falta mostrar el error cada vez
    }
  }, []);

  const loadCargas = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cargas`);
      const data: CargasResponse = await res.json();
      setCargas(data.message ?? '');
    } catch {
      // silencioso, no es tan crítico como el estado
    }
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/devices`);
      const data: DevicesResponse = await res.json();
      setDevices(data.devices ?? []);
    } catch {
      // silencioso
    }
  }, []);

  const toggleDevice = useCallback(async (key: string, turningOn: boolean) => {
    // optimista: refleja el toggle al toque, si el POST falla el próximo loadDevices() corrige
    setDevices((prev) => prev.map((d) => (d.key === key ? { ...d, on: turningOn } : d)));
    try {
      const res = await fetch(`${API_BASE}/api/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: key, on: turningOn }),
      });
      const data: DevicesResponse = await res.json();
      if (data.devices) setDevices(data.devices);
    } catch {
      loadDevices();
    }
  }, [loadDevices]);

  useEffect(() => {
    loadStatus();
    loadCargas();
    loadDevices();
    const statusInterval = setInterval(loadStatus, 3000);
    const cargasInterval = setInterval(loadCargas, 30000);
    const devicesInterval = setInterval(loadDevices, 15000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(cargasInterval);
      clearInterval(devicesInterval);
    };
  }, [loadStatus, loadCargas, loadDevices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadStatus(), loadCargas(), loadDevices()]);
    setRefreshing(false);
  }, [loadStatus, loadCargas, loadDevices]);

  const stale = lastOk == null || Date.now() - lastOk > 15000;
  const percent = status?.percent ?? null;
  const ringColor = percent == null ? COLORS.gray : percent <= 10 ? COLORS.red : percent <= 20 ? COLORS.yellow : COLORS.green;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.dim} />}
        >
          <View style={styles.header}>
            <Text style={styles.title}>⚡ EcoFlow</Text>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: stale ? COLORS.yellow : COLORS.green }]} />
              <Text style={styles.dimText}>{stale ? 'Conectando…' : 'En vivo'}</Text>
            </View>
          </View>

          {!status ? (
            <ActivityIndicator color={COLORS.dim} style={{ marginTop: 40 }} />
          ) : !status.ready ? (
            <View style={styles.card}>
              <Text style={styles.errorText}>{status.error ?? 'No listo todavía'}</Text>
            </View>
          ) : (
            <>
              <View style={styles.percentCard}>
                <Text style={[styles.percentBig, { color: ringColor }]}>
                  {percent != null ? `${percent.toFixed(1)}%` : '--'}
                </Text>
                <Text style={styles.dimText}>
                  {status.source_verb} {status.source_emoji}
                </Text>
                {status.eta_text ? (
                  <Text style={[styles.etaText, { color: status.eta_ok ? COLORS.green : COLORS.red }]}>
                    {status.eta_text}
                    {status.remain_duration ? ` · ${status.remain_duration}` : ''}
                  </Text>
                ) : null}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Baterías</Text>
                {status.soc_delta2 != null && (
                  <BatteryRow label="Delta 2" pct={status.soc_delta2} netW={status.delta2_net_w} />
                )}
                {status.soc_extra != null && (
                  <BatteryRow label="Batería Extra" pct={status.soc_extra} netW={status.extra_net_w} />
                )}
                <View style={styles.flowRow}>
                  <Text style={styles.dimText}>☀️ Entrada solar</Text>
                  <Text style={styles.text}>{status.pv_w ?? 0} W</Text>
                </View>
                <View style={styles.flowRow}>
                  <Text style={styles.dimText}>📤 Salida</Text>
                  <Text style={styles.text}>{status.out_w ?? 0} W</Text>
                </View>
                <View style={styles.flowRow}>
                  <Text style={styles.dimText}>🔌 ¿Hay corriente?</Text>
                  <Text style={styles.text}>{status.has_ac ? 'Sí' : 'No'}</Text>
                </View>
              </View>

              {status.ports && status.ports.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Puertos activos</Text>
                  {status.ports.map((p, i) => (
                    <View key={i} style={styles.flowRow}>
                      <Text style={styles.dimText}>{p.name}</Text>
                      <Text style={styles.text}>{p.watts} W</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {cargas ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Gestión de cargas</Text>
              <Text style={styles.cargasText}>{formatCargas(cargas)}</Text>
            </View>
          ) : null}

          {devices.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Qué tenés encendido</Text>
              {devices.map((d) => (
                <Pressable
                  key={d.key}
                  onPress={() => toggleDevice(d.key, !d.on)}
                  style={[styles.deviceBtn, d.on ? styles.deviceBtnOn : styles.deviceBtnOff]}
                >
                  <Text style={styles.text}>
                    {d.emoji} {d.label} · {d.watts}W
                  </Text>
                  <Text style={[styles.deviceState, { color: d.on ? COLORS.green : COLORS.gray }]}>
                    {d.on ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.footer}>
            {status?.updated_at ? `Actualizado: ${status.updated_at}` : ''}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function BatteryRow({ label, pct, netW }: { label: string; pct: number; netW: number | null | undefined }) {
  const flow = battFlow(netW);
  return (
    <View style={styles.flowRow}>
      <Text style={styles.dimText}>{label}</Text>
      <Text style={[styles.text, { color: flow.color }]}>
        {flow.arrow} {pct.toFixed(1)}%
      </Text>
    </View>
  );
}

// El bot manda *negrita* estilo Telegram — acá solo se quitan los asteriscos,
// sin bold real, para no complicar el render con texto parcialmente estilizado.
function formatCargas(raw: string): string {
  return raw.replace(/\*/g, '');
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  percentCard: {
    backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 16,
    padding: 24, alignItems: 'center', marginBottom: 14,
  },
  percentBig: { fontSize: 48, fontWeight: '800' },
  etaText: { fontSize: 14, marginTop: 6 },
  card: {
    backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 14,
    padding: 16, marginBottom: 14,
  },
  cardTitle: { color: COLORS.dim, fontSize: 13, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  flowRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  text: { color: COLORS.text, fontSize: 15, fontVariant: ['tabular-nums'] },
  dimText: { color: COLORS.dim, fontSize: 14 },
  errorText: { color: COLORS.yellow, fontSize: 14 },
  cargasText: { color: COLORS.text, fontSize: 14, lineHeight: 22 },
  deviceBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1,
  },
  deviceBtnOn: { backgroundColor: '#1a2b1f', borderColor: '#4ade8055' },
  deviceBtnOff: { backgroundColor: COLORS.bg, borderColor: COLORS.border },
  deviceState: { fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  footer: { color: COLORS.dim, fontSize: 11, textAlign: 'center', marginTop: 8 },
});
