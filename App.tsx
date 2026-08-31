import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  Easing,
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
import * as Updates from 'expo-updates';

// react-native-svg no trae Animated.createAnimatedComponent aplicado a Path
// por defecto; se arma acá porque no hay reanimated como dependencia (ver
// package.json) — se anima strokeDashoffset con la Animated API nativa de RN.
const AnimatedPath = Animated.createAnimatedComponent(Path);

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
  delta2_remain?: { charging: boolean; text: string } | null;
  extra_remain?: { charging: boolean; text: string } | null;
  has_ac?: boolean;
  in_w?: number;
  out_w?: number;
  eta_text?: string | null;
  eta_ok?: boolean | null;
  threshold_text?: string | null;
  last_ac_text?: string | null;
  remain_duration?: string | null;
  goal_label?: string | null;
  goal_floor?: number | null;
  goal_projected?: number | null;
  goal_met?: boolean | null;
  ports?: { name: string; watts: number }[];
  updated_at?: string;
  ac_out_w: number;
  extra_in_w: number;
  extra_out_w: number;
  usb_out_w: number;
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

// La meta y "se va a cumplir" ya se muestran arriba en la caja de eta junto
// con "dura hasta las X" — se recortan acá del texto de Gestión de cargas
// para no repetirlas dos veces en la misma pantalla.
function stripMeta(msg: string): string {
  const idx = msg.indexOf('\n\n🎯 Meta:');
  return idx === -1 ? msg : msg.slice(0, idx);
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
  icon,
  state,
  watts,
  dirLabel,
  name,
}: {
  emoji?: string;
  icon?: ReactNode;
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
        {icon ?? <Text style={{ fontSize: 22 }}>{emoji}</Text>}
      </View>
      <Text style={styles.iconWatts}>{watts}</Text>
      {dirLabel ? <Text style={[styles.iconDir, { color: dirColor }]}>{dirLabel}</Text> : <Text style={styles.iconDir}> </Text>}
      <Text style={styles.iconName}>{name}</Text>
    </View>
  );
}

function BatteryRow({
  label,
  pct,
  netW,
  remain,
}: {
  label: string;
  pct: number;
  netW: number | null | undefined;
  remain?: { charging: boolean; text: string } | null;
}) {
  const flow = batteryFlow(netW);
  const labelText = flow.state === 'charging' ? 'Carga' : flow.state === 'discharging' ? 'Descarga' : 'Carga';
  const remainColor = remain ? (remain.charging ? COLORS.green : COLORS.red) : undefined;
  return (
    <View style={styles.batteryRow}>
      <View style={styles.batteryRowName}>
        <BatteryIcon state={flow.state} />
        <View>
          <Text style={styles.batteryRowNameText}>{label}</Text>
          <View style={styles.batteryRowSubRow}>
            <Text style={styles.batteryRowSubText}>{labelText}</Text>
            {remain ? (
              <Text style={[styles.batteryRowRemain, { color: remainColor }]}> · {remain.text}</Text>
            ) : null}
          </View>
        </View>
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

  // Offset animado compartido para el "flujo" de las líneas conectoras
  // (dash que viaja por el path) — un solo loop, reusado por todos los
  // overlays; cada uno se prende/apaga por separado según su wattage.
  // useNativeDriver:false porque strokeDashoffset no es soportado por el
  // driver nativo de RN.
  const flowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(flowAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [flowAnim]);
  const flowDashOffset = flowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });

  // Por default expo-updates solo baja el update nuevo en segundo plano y lo
  // aplica en el SIGUIENTE arranque en frío (no en el actual) — así que un
  // cambio recién publicado no se ve hasta cerrar y abrir la app dos veces.
  // Acá se chequea y, si hay uno disponible, se baja y se recarga sola en
  // caliente para verlo ya en el primer reinicio.
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // sin conexión o falló el chequeo: sigue con el bundle que ya tiene
      }
    })();
  }, []);

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
      setCargas(stripMeta(data.message ?? ''));
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
    const statusInterval = setInterval(loadStatus, 2000);
    const cargasInterval = setInterval(loadCargas, 2000);
    const devicesInterval = setInterval(loadDevices, 2000);
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
  // Nodo "Extra" (arriba): SIEMPRE descarga (extra_out_w), nunca neto — la
  // carga de la batería extra se ve en la fila de abajo (Batería/extra_in_w).
  const extraOutW = status?.extra_out_w ?? 0;
  const extraTopActive = extraOutW > 5;
  const solarFlow: FlowState = (status?.pv_w ?? 0) > 5 ? 'charging' : 'neutral';

  // Wattage actual de cada nodo -> decide si su línea conectora se anima.
  const acTopActive = (status?.ac_w ?? 0) > 5;
  const solarActive = (status?.pv_w ?? 0) > 5;
  const acOutActive = (status?.ac_out_w ?? 0) > 5;
  const extraInActive = (status?.extra_in_w ?? 0) > 5;
  const usbActive = (status?.usb_out_w ?? 0) > 5;

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

              {/* GEOMETRY SPEC (top, mirrored, manifold/elbow style):
                  sdd/power-flow-bottom-nodes/design §4 — viewBox 0 0 300 130,
                  hub (150,122) at the ring's top edge, nodes x=50/150/250 y=8
                  (bottom-center of each top node). Each side node drops
                  straight down to a shared horizontal bus at y=65 (rounded
                  10px corners), then a single shared vertical trunk
                  continues from the bus center (150,65) down to the hub.
                  Center node is a straight vertical line (already aligned
                  with hub x). Y-mirror of the bottom spec (node/hub y
                  swapped, same elbow form). KEEP IN SYNC WITH
                  ecoflow_telegram_monitor.py .flow-connectors.top
                  (and vice-versa). */}
              <View style={styles.flowTopWrap}>
                <View style={styles.iconsRowTop}>
                  <IconCircle emoji="🔌" state={acFlow} watts={`${status.ac_w ?? 0} W`} dirLabel={status.has_ac ? 'Sí' : undefined} name="AC" />
                  <IconCircle
                    icon={<BatteryIcon state={extraTopActive ? 'discharging' : 'neutral'} />}
                    state={extraTopActive ? 'discharging' : 'neutral'}
                    watts={`${extraOutW} W`}
                    dirLabel={extraTopActive ? '↓ descarga' : undefined}
                    name="Extra"
                  />
                  <IconCircle emoji="☀️" state={solarFlow} watts={`${status.pv_w ?? 0} W`} name="Solar" />
                </View>
                <Svg width={300} height={130} viewBox="0 0 300 130" style={styles.flowConnectorsTop}>
                  <Path d="M 50,8 L 50,55 Q 50,65 60,65 L 140,65 Q 150,65 150,75 L 150,122" stroke="#232c36" strokeWidth={2} fill="none" />
                  <AnimatedPath d="M 50,8 L 50,55 Q 50,65 60,65 L 140,65 Q 150,65 150,75 L 150,122" stroke={COLORS.green} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,10" strokeDashoffset={flowDashOffset} fill="none" opacity={acTopActive ? 1 : 0} />
                  <Path d="M 150,8 L 150,122" stroke="#232c36" strokeWidth={2} fill="none" />
                  <AnimatedPath d="M 150,8 L 150,122" stroke={COLORS.green} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,10" strokeDashoffset={flowDashOffset} fill="none" opacity={extraTopActive ? 1 : 0} />
                  <Path d="M 250,8 L 250,55 Q 250,65 240,65 L 160,65 Q 150,65 150,75 L 150,122" stroke="#232c36" strokeWidth={2} fill="none" />
                  <AnimatedPath d="M 250,8 L 250,55 Q 250,65 240,65 L 160,65 Q 150,65 150,75 L 150,122" stroke={COLORS.green} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,10" strokeDashoffset={flowDashOffset} fill="none" opacity={solarActive ? 1 : 0} />
                </Svg>
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

              {/* Fila inferior: CA / Batería / USB, con conectores tipo manifold/elbow
                  hacia el anillo central.
                  GEOMETRY SPEC (manifold/elbow style): sdd/power-flow-bottom-nodes/design
                  §4 — viewBox 0 0 300 130, hub (150,8), nodes x=50/150/250 y=122.
                  Each side node rises straight up to a shared horizontal bus at
                  y=65 (rounded 10px corners), then a single shared vertical
                  trunk continues from the bus center (150,65) up to the hub.
                  Center node is a straight vertical line (already aligned with
                  hub x). KEEP IN SYNC WITH ecoflow_telegram_monitor.py
                  .flow-connectors (and vice-versa). */}
              <View style={styles.flowBottomWrap}>
                <Svg width={300} height={130} viewBox="0 0 300 130" style={styles.flowConnectors}>
                  <Path d="M 50,122 L 50,75 Q 50,65 60,65 L 140,65 Q 150,65 150,55 L 150,8" stroke="#232c36" strokeWidth={2} fill="none" />
                  <AnimatedPath d="M 50,122 L 50,75 Q 50,65 60,65 L 140,65 Q 150,65 150,55 L 150,8" stroke={COLORS.red} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,10" strokeDashoffset={flowDashOffset} fill="none" opacity={acOutActive ? 1 : 0} />
                  <Path d="M 150,122 L 150,8" stroke="#232c36" strokeWidth={2} fill="none" />
                  <AnimatedPath d="M 150,122 L 150,8" stroke={COLORS.red} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,10" strokeDashoffset={flowDashOffset} fill="none" opacity={extraInActive ? 1 : 0} />
                  <Path d="M 250,122 L 250,75 Q 250,65 240,65 L 160,65 Q 150,65 150,55 L 150,8" stroke="#232c36" strokeWidth={2} fill="none" />
                  <AnimatedPath d="M 250,122 L 250,75 Q 250,65 240,65 L 160,65 Q 150,65 150,55 L 150,8" stroke={COLORS.red} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,10" strokeDashoffset={flowDashOffset} fill="none" opacity={usbActive ? 1 : 0} />
                </Svg>
                <View style={styles.iconsRowBottom}>
                  <IconCircle emoji="🔌" state="neutral" watts={`${status.ac_out_w ?? 0} W`} name="CA" />
                  <IconCircle
                    icon={<BatteryIcon state={extraInActive ? 'charging' : 'neutral'} />}
                    state={extraInActive ? 'charging' : 'neutral'}
                    watts={`${status.extra_in_w ?? 0} W`}
                    name="Batería"
                  />
                  <IconCircle icon={<UsbIcon color={COLORS.dim} />} state="neutral" watts={`${status.usb_out_w ?? 0} W`} name="USB" />
                </View>
              </View>

              {/* ETA box */}
              {status.eta_text || status.goal_label ? (
                <View style={styles.etaBox}>
                  {status.eta_text ? (
                    <>
                      <Text style={[styles.etaMain, { color: status.eta_ok ? COLORS.green : COLORS.red }]}>{status.eta_text}</Text>
                      <View style={styles.etaSubRow}>
                        {status.threshold_text ? <BatteryIcon state="discharging" size={14} /> : null}
                        <Text style={styles.etaSubText}>{status.threshold_text || status.last_ac_text || ''}</Text>
                      </View>
                    </>
                  ) : null}
                  {status.goal_label ? (
                    <Text style={[styles.etaGoal, { color: status.goal_met ? COLORS.green : COLORS.red }]}>
                      {status.goal_met ? '✅' : '⚠️'} Meta: {status.goal_floor}% para {status.goal_label} (proyectás {status.goal_projected?.toFixed(0)}%)
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Baterías */}
              <View style={styles.batteries}>
                {status.soc_delta2 != null && (
                  <BatteryRow label="Delta 2" pct={status.soc_delta2} netW={status.delta2_net_w} remain={status.delta2_remain} />
                )}
                {status.soc_extra != null && (
                  <BatteryRow label="Batería Extra" pct={status.soc_extra} netW={status.extra_net_w} remain={status.extra_remain} />
                )}
              </View>

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

  iconItem: { alignItems: 'center', width: 84 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  iconWatts: { fontSize: 12, color: COLORS.dim, marginTop: 5, fontVariant: ['tabular-nums'] },
  iconDir: { fontSize: 11, marginTop: 1, color: COLORS.dim, height: 14 },
  iconName: { fontSize: 10, color: COLORS.faint, marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase' },
  flowTopWrap: { width: 300, maxWidth: '100%', alignSelf: 'center', paddingBottom: 122 },
  iconsRowTop: { width: 300, maxWidth: 300, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-around' },
  flowConnectorsTop: { position: 'absolute', left: 0, bottom: 0 },
  flowBottomWrap: { width: 300, maxWidth: '100%', alignSelf: 'center', paddingTop: 122 },
  flowConnectors: { position: 'absolute', top: 0, left: 0 },
  iconsRowBottom: { width: 300, maxWidth: 300, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-around' },

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
  etaGoal: {
    fontSize: 13, fontWeight: '700', marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#232c36', fontVariant: ['tabular-nums'], textAlign: 'center',
  },

  batteries: { width: '100%', maxWidth: 380, marginTop: 16 },
  batteryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginTop: 8,
  },
  batteryRowName: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  batteryRowNameText: { fontSize: 14, color: '#cbd5e1' },
  batteryRowSubRow: { flexDirection: 'row', alignItems: 'center' },
  batteryRowSubText: { fontSize: 12, color: COLORS.faint },
  batteryRowRemain: { fontSize: 12, fontWeight: '600' },
  batteryRowVal: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },

  sectionTitle: { fontSize: 13, color: COLORS.dim, marginBottom: 6 },

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
