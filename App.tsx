import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const API_BASE = 'https://ecoflow-monitor-production.up.railway.app';

const COLORS = {
  bg: '#0b0f14',
  card: '#141b22',
  border: '#232b33',
  text: '#f5f5f5',
  dim: '#9aa4af',
  faint: '#6b7684',
  green: '#4ade80',
  red: '#f87171',
  yellow: '#eab308',
  ringTrack: '#1c232b',
  chargingBg: '#14351f',
  dischargingBg: '#3a1616',
};

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
  threshold_text?: string | null;
  last_ac_text?: string | null;
  remain_duration?: string | null;
  ports?: { name: string; watts: number }[];
  updated_at?: string;
};

type CargasResponse = { message?: string; error?: string };
type Device = { key: string; label: string; emoji: string; watts: number; on: boolean };
type DevicesResponse = { devices: Device[] };

type FlowState = 'neutral' | 'charging' | 'discharging';

function batteryFlow(netW: number | null | undefined): { state: FlowState; suffix: string } {
  if (netW == null || (netW > -5 && netW < 5)) return { state: 'neutral', suffix: '' };
  if (netW > 5) return { state: 'charging', suffix: ` (${Math.round(netW)} W)` };
  return { state: 'discharging', suffix: ` (${Math.abs(Math.round(netW))} W)` };
}

function flowColor(state: FlowState) {
  return state === 'charging' ? COLORS.green : state === 'discharging' ? COLORS.red : COLORS.faint;
}

// Mismo shape que el ícono de batería del dashboard web (un rect + terminal + relleno).
function BatteryIcon({ state, size = 15 }: { state: FlowState; size?: number }) {
  const color = flowColor(state);
  const w = size * (26 / 15);
  return (
    <Svg width={w} height={size} viewBox="0 0 28 16">
      <Rect x={1} y={1} width={23} height={14} rx={3} fill="none" stroke={color} strokeWidth={2} />
      <Rect x={25} y={5.5} width={2.5} height={5} rx={1} fill={color} />
      <Rect x={3.5} y={3.5} width={18} height={9} rx={1.5} fill={color} />
    </Svg>
  );
}

function UsbIcon({ color = COLORS.dim }: { color?: string }) {
  return (
    <Svg width={18} height={9} viewBox="0 0 24 12">
      <Rect x={1} y={1} width={22} height={10} rx={5} fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

function ArrowDownIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        d="M12 3v10m0 0l-4-4m4 4l4-4M4 19h16"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ArrowUpIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        d="M12 21V11m0 0l-4 4m4-4l4 4M4 5h16"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Anillo circular por porcentaje — equivalente RN del conic-gradient del CSS web.
function PercentRing({ pct, color, size = 240 }: { pct: number; color: string; size?: number }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * Math.min(Math.max(pct, 0), 100) / 100;
  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }}>
      <Circle cx={c} cy={c} r={r} stroke={COLORS.ringTrack} strokeWidth={stroke} fill="none" />
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="round"
        rotation={-90}
        origin={`${c}, ${c}`}
      />
    </Svg>
  );
}

function IconCircle({
  emoji,
  state,
  watts,
  dirLabel,
  name,
}: {
  emoji: string;
  state: FlowState;
  watts: string;
  dirLabel?: string;
  name: string;
}) {
  const bg = state === 'charging' ? COLORS.chargingBg : state === 'discharging' ? COLORS.dischargingBg : '#1c232b';
  const dirColor = flowColor(state);
  return (
    <View style={styles.iconItem}>
      <View style={[styles.iconCircle, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
      </View>
      <Text style={styles.iconWatts}>{watts}</Text>
      {dirLabel ? <Text style={[styles.iconDir, { color: dirColor }]}>{dirLabel}</Text> : <Text style={styles.iconDir}> </Text>}
      <Text style={styles.iconName}>{name}</Text>
    </View>
  );
}

function BatteryRow({ label, pct, netW }: { label: string; pct: number; netW: number | null | undefined }) {
  const flow = batteryFlow(netW);
  const labelText = flow.state === 'charging' ? 'Carga' : flow.state === 'discharging' ? 'Descarga' : 'Carga';
  return (
    <View style={styles.batteryRow}>
      <View style={styles.batteryRowName}>
        <BatteryIcon state={flow.state} />
        <Text style={styles.batteryRowNameText}>
          {label} — {labelText}
        </Text>
      </View>
      <Text style={[styles.batteryRowVal, { color: flow.state === 'neutral' ? COLORS.text : flowColor(flow.state) }]}>
        {pct.toFixed(1)}%{flow.suffix}
      </Text>
    </View>
  );
}

// El bot manda *negrita* estilo Telegram — se quitan los asteriscos, sin
// intentar re-crear el bold real para no complicar el render.
function formatCargas(raw: string): string {
  return raw.replace(/\*/g, '');
}

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [cargas, setCargas] = useState<string>('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [live, setLive] = useState<'ok' | 'stale'>('stale');
  const [updatedLabel, setUpdatedLabel] = useState('Conectando…');
  const lastSuccessAt = useRef<number | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      const data: StatusResponse = await res.json();
      setStatus(data);
      setLive(data.ready ? 'ok' : 'stale');
      if (data.ready) lastSuccessAt.current = Date.now();
    } catch {
      setLive('stale');
    }
  }, []);

  const loadCargas = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cargas`);
      const data: CargasResponse = await res.json();
      setCargas(data.message ?? '');
    } catch {
      // silencioso
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
    const cargasInterval = setInterval(loadCargas, 3000);
    const devicesInterval = setInterval(loadDevices, 3000);
    const clockInterval = setInterval(() => {
      if (lastSuccessAt.current == null) {
        setUpdatedLabel('Conectando…');
        return;
      }
      const secs = Math.round((Date.now() - lastSuccessAt.current) / 1000);
      if (secs < 3) setUpdatedLabel('Actualizado ahora');
      else if (secs < 60) setUpdatedLabel(`Actualizado hace ${secs}s`);
      else setUpdatedLabel(`Desactualizado hace ${Math.round(secs / 60)}m`);
    }, 1000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(cargasInterval);
      clearInterval(devicesInterval);
      clearInterval(clockInterval);
    };
  }, [loadStatus, loadCargas, loadDevices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadStatus(), loadCargas(), loadDevices()]);
    setRefreshing(false);
  }, [loadStatus, loadCargas, loadDevices]);

  const pct = status?.percent ?? 0;
  const ringColor = pct <= 10 ? COLORS.red : pct <= 20 ? COLORS.yellow : COLORS.green;
  const acFlow: FlowState = status?.has_ac ? 'charging' : 'neutral';
  const extraFlow = batteryFlow(status?.extra_net_w);
  const solarFlow: FlowState = (status?.pv_w ?? 0) > 5 ? 'charging' : 'neutral';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.dim} />}
        >
          {!status || !status.ready ? (
            <View style={styles.card}>
              <Text style={styles.dimText}>{status?.error ?? 'Conectando…'}</Text>
            </View>
          ) : (
            <>
              {/* io-row: entrada / verbo+emoji / salida */}
              <View style={styles.ioRow}>
                <View style={styles.ioCol}>
                  <View style={styles.ioLabelRow}>
                    <ArrowDownIcon color={(status.in_w ?? 0) > 0 ? COLORS.green : COLORS.faint} />
                    <Text style={[styles.ioLabel, { color: (status.in_w ?? 0) > 0 ? COLORS.green : COLORS.faint }]}>
                      Entrada
                    </Text>
                  </View>
                  <Text style={styles.ioValue}>{status.in_w ?? '--'} W</Text>
                </View>
                <View style={styles.ioCenter}>
                  <Text style={styles.verb}>{status.source_verb}</Text>
                  <Text style={styles.emoji}>{status.source_emoji}</Text>
                </View>
                <View style={[styles.ioCol, { alignItems: 'flex-end' }]}>
                  <View style={styles.ioLabelRow}>
                    <Text style={[styles.ioLabel, { color: (status.out_w ?? 0) > 0 ? COLORS.red : COLORS.faint }]}>
                      Salida
                    </Text>
                    <ArrowUpIcon color={(status.out_w ?? 0) > 0 ? COLORS.red : COLORS.faint} />
                  </View>
                  <Text style={styles.ioValue}>{status.out_w ?? '--'} W</Text>
                </View>
              </View>

              {/* icons-row: AC / Extra / Solar */}
              <View style={styles.iconsRow}>
                <IconCircle emoji="🔌" state={acFlow} watts={`${status.ac_w ?? 0} W`} dirLabel={status.has_ac ? 'Sí' : undefined} name="AC" />
                <IconCircle
                  emoji="🔋"
                  state={extraFlow.state}
                  watts={`${status.extra_net_w == null ? '--' : Math.abs(status.extra_net_w)} W`}
                  dirLabel={extraFlow.state === 'charging' ? '↑ carga' : extraFlow.state === 'discharging' ? '↓ descarga' : undefined}
                  name="Extra"
                />
                <IconCircle emoji="☀️" state={solarFlow} watts={`${status.pv_w ?? 0} W`} name="Solar" />
              </View>

              {/* Anillo de porcentaje */}
              <View style={styles.ringWrap}>
                <PercentRing pct={pct} color={ringColor} />
                <View style={styles.ringInner}>
                  <Text style={styles.pct}>{status.percent != null ? status.percent.toFixed(1) : '--'}%</Text>
                  <Text style={styles.pctSubLabel}>Tiempo restante</Text>
                  <Text style={styles.pctSubDur}>{status.remain_duration || '--'}</Text>
                </View>
              </View>

              {/* ETA box */}
              {status.eta_text ? (
                <View style={styles.etaBox}>
                  <Text style={[styles.etaMain, { color: status.eta_ok ? COLORS.green : COLORS.red }]}>{status.eta_text}</Text>
                  <View style={styles.etaSubRow}>
                    {status.threshold_text ? <BatteryIcon state="discharging" size={14} /> : null}
                    <Text style={styles.etaSubText}>{status.threshold_text || status.last_ac_text || ''}</Text>
                  </View>
                </View>
              ) : null}

              {/* Baterías */}
              <View style={styles.batteries}>
                {status.soc_delta2 != null && <BatteryRow label="Delta 2" pct={status.soc_delta2} netW={status.delta2_net_w} />}
                {status.soc_extra != null && <BatteryRow label="Batería Extra" pct={status.soc_extra} netW={status.extra_net_w} />}
              </View>

              {/* Puertos */}
              {status.ports && status.ports.length > 0 && (
                <View style={styles.ports}>
                  <Text style={styles.sectionTitle}>Puertos activos</Text>
                  {status.ports.map((p, i) => (
                    <View key={i} style={styles.portRow}>
                      <View style={styles.portName}>
                        <UsbIcon />
                        <Text style={styles.portNameText}>{p.name}</Text>
                      </View>
                      <Text style={styles.portWatts}>{p.watts} W</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Gestión de cargas */}
          {cargas ? (
            <View style={styles.cargas}>
              <Text style={styles.sectionTitle}>Gestión de cargas</Text>
              <View style={styles.cargasBox}>
                <Text style={styles.cargasText}>{formatCargas(cargas)}</Text>
              </View>
            </View>
          ) : null}

          {/* Dispositivos */}
          {devices.length > 0 && (
            <View style={styles.devices}>
              <Text style={styles.sectionTitle}>Qué tenés encendido</Text>
              {devices.map((d) => (
                <Pressable
                  key={d.key}
                  onPress={() => toggleDevice(d.key, !d.on)}
                  style={[styles.deviceBtn, d.on ? styles.deviceBtnOn : styles.deviceBtnOff]}
                >
                  <Text style={styles.deviceBtnName}>
                    {d.emoji} {d.label} · {d.watts}W
                  </Text>
                  <Text style={[styles.deviceState, { color: d.on ? COLORS.green : COLORS.faint }]}>{d.on ? 'ON' : 'OFF'}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.updatedRow}>
            <View style={[styles.liveDot, { backgroundColor: live === 'ok' ? COLORS.green : '#ef4444' }]} />
            <Text style={styles.updatedText}>{updatedLabel}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20, paddingTop: 24, alignItems: 'center', paddingBottom: 50 },
  card: {
    backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 14,
    padding: 16, width: '100%', maxWidth: 380,
  },
  dimText: { color: COLORS.dim, fontSize: 14 },

  ioRow: { width: '100%', maxWidth: 380, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  ioCol: { flex: 1 },
  ioLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ioLabel: { fontSize: 13 },
  ioValue: { fontSize: 20, fontWeight: '600', marginTop: 2, color: COLORS.text, fontVariant: ['tabular-nums'] },
  ioCenter: { alignItems: 'center', paddingTop: 4, flex: 1 },
  verb: { fontSize: 13, color: COLORS.dim },
  emoji: { fontSize: 22, marginTop: 2 },

  iconsRow: { width: '100%', maxWidth: 380, flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  iconItem: { alignItems: 'center', width: 84 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  iconWatts: { fontSize: 12, color: COLORS.dim, marginTop: 5, fontVariant: ['tabular-nums'] },
  iconDir: { fontSize: 11, marginTop: 1, color: COLORS.dim, height: 14 },
  iconName: { fontSize: 10, color: COLORS.faint, marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase' },

  ringWrap: { width: 240, height: 240, marginVertical: 6, alignItems: 'center', justifyContent: 'center' },
  ringInner: {
    width: 240 * 0.8, height: 240 * 0.8, borderRadius: (240 * 0.8) / 2, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  pct: { fontSize: 48, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },
  pctSubLabel: { fontSize: 13, color: COLORS.dim, marginTop: 8 },
  pctSubDur: { fontSize: 22, color: '#e5e7eb', fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },

  etaBox: {
    marginTop: 4, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 16, backgroundColor: COLORS.card,
    alignItems: 'center', maxWidth: 340, width: '100%',
  },
  etaMain: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  etaSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  etaSubText: { fontSize: 13, color: COLORS.dim },

  batteries: { width: '100%', maxWidth: 380, marginTop: 16 },
  batteryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginTop: 8,
  },
  batteryRowName: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  batteryRowNameText: { fontSize: 14, color: '#cbd5e1' },
  batteryRowVal: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },

  ports: { width: '100%', maxWidth: 380, marginTop: 14 },
  sectionTitle: { fontSize: 13, color: COLORS.dim, marginBottom: 6 },
  portRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  portName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  portNameText: { fontSize: 14, color: '#cbd5e1' },
  portWatts: { fontSize: 14, color: '#cbd5e1', fontVariant: ['tabular-nums'] },

  cargas: { width: '100%', maxWidth: 380, marginTop: 14 },
  cargasBox: { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 10, padding: 14 },
  cargasText: { fontSize: 14, lineHeight: 22, color: '#cbd5e1' },

  devices: { width: '100%', maxWidth: 380, marginTop: 14 },
  deviceBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1,
  },
  deviceBtnOn: { backgroundColor: '#1a2b1f', borderColor: '#4ade8055' },
  deviceBtnOff: { backgroundColor: COLORS.card, borderColor: COLORS.border },
  deviceBtnName: { fontSize: 14, color: '#cbd5e1' },
  deviceState: { fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },

  updatedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  liveDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  updatedText: { fontSize: 12, color: '#7b8794' },
});
