import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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

// Mismo umbral que NOISE_FLOOR_W del lado Python (ecoflow_telegram_monitor.py):
// por debajo de esto se considera ruido de medición, no transferencia real.
const NOISE_FLOOR_W = 5;
// Umbrales de color del ring principal (rojo/amarillo/verde). Mismos valores
// que RING_RED_MAX_PCT/RING_YELLOW_MAX_PCT en el dashboard web — si cambian
// acá, cambiarlos ahí también para que no queden desincronizados.
const RING_RED_MAX_PCT = 10;
const RING_YELLOW_MAX_PCT = 20;

// A partir de este ancho (iPad en cualquier orientación, tablets chicas
// incluidas) se activa el layout de 3 columnas — ver `isTablet` en App().
// useWindowDimensions() (a diferencia de Dimensions.get) es reactivo: se
// actualiza solo ante rotación/resize, sin necesidad de listeners manuales.
const TABLET_BREAKPOINT = 768;

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
  delta2_charge_w: number;
  delta2_discharge_w: number;
};

type CargasResponse = { message?: string; error?: string };
type Device = { key: string; label: string; emoji: string; watts: number; on: boolean; charged?: boolean | null };
type DevicesResponse = { devices: Device[] };

type FlowState = 'neutral' | 'charging' | 'discharging';

function batteryFlow(netW: number | null | undefined): { state: FlowState } {
  if (netW == null || (netW > -NOISE_FLOOR_W && netW < NOISE_FLOOR_W)) return { state: 'neutral' };
  if (netW > NOISE_FLOOR_W) return { state: 'charging' };
  return { state: 'discharging' };
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

// Nodo lateral compacto (hook que sale del anillo hacia Delta 2/Batería
// Extra) — versión angosta de IconCircle, sin dirLabel (el web tampoco lo
// muestra ahí, ver .icon-item.lateral-icon en ecoflow_telegram_monitor.py).
function LateralIcon({
  state,
  watts,
  name,
  side,
}: {
  state: FlowState;
  watts: string;
  name: string;
  side: 'left' | 'right';
}) {
  const bg = state === 'charging' ? COLORS.chargingBg : state === 'discharging' ? COLORS.dischargingBg : '#1c232b';
  return (
    <View style={side === 'right' ? styles.lateralIconRight : styles.lateralIconLeft}>
      <View style={[styles.lateralIconCircle, { backgroundColor: bg }]}>
        <BatteryIcon state={state} size={17} />
      </View>
      <Text style={styles.lateralIconWatts}>{watts}</Text>
      <Text style={styles.lateralIconName}>{name}</Text>
    </View>
  );
}

// Conector "hook" lateral: sale del anillo (borde derecho o izquierdo, punto
// medio vertical), va horizontal y dobla 90° con esquina redondeada — exacto
// mismo `d` que .lateral-overlay/.lateral-overlay-left en
// ecoflow_telegram_monitor.py (izquierda = mismas coordenadas en x negativo).
// KEEP IN SYNC WITH ecoflow_telegram_monitor.py .flow-connectors.lateral.
function LateralHook({
  side,
  charging,
  discharging,
  dashOffset,
}: {
  side: 'left' | 'right';
  charging: boolean;
  discharging: boolean;
  dashOffset: Animated.AnimatedInterpolation<string | number>;
}) {
  // El lado izquierdo usa coordenadas X negativas (el gancho sale hacia la
  // izquierda del anillo). Antes ambos lados compartían el mismo viewBox
  // "0 0 64 40" y dependían de overflow:'visible' para que el contenido
  // negativo "se viera" fuera de los límites del box — funciona en web
  // (react-native-web) pero no se puede confiar en eso en nativo. Ahora el
  // viewBox y la posición del propio Svg coinciden exactamente con el rango
  // de coordenadas que cada lado realmente usa, sin depender de overflow.
  const chargePath = side === 'right' ? 'M 0,0 L 54,0 Q 62,0 62,8 L 62,38' : 'M 0,0 L -54,0 Q -62,0 -62,8 L -62,38';
  const dischargePath = side === 'right' ? 'M 62,38 L 62,8 Q 62,0 54,0 L 0,0' : 'M -62,38 L -62,8 Q -62,0 -54,0 L 0,0';
  const viewBox = side === 'right' ? '0 0 64 40' : '-64 0 64 40';
  const svgStyle = side === 'right' ? styles.lateralSvg : [styles.lateralSvg, styles.lateralSvgLeft];
  return (
    <Svg width={64} height={40} viewBox={viewBox} style={svgStyle}>
      <Path d={chargePath} stroke="#232c36" strokeWidth={2} fill="none" />
      <AnimatedPath
        d={chargePath}
        stroke={COLORS.green}
        strokeWidth={2.5}
        strokeLinecap="butt"
        strokeDasharray="3,4"
        strokeDashoffset={dashOffset}
        fill="none"
        opacity={charging ? 1 : 0}
      />
      <AnimatedPath
        d={dischargePath}
        stroke={COLORS.red}
        strokeWidth={2.5}
        strokeLinecap="butt"
        strokeDasharray="3,4"
        strokeDashoffset={dashOffset}
        fill="none"
        opacity={discharging ? 1 : 0}
      />
    </Svg>
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
  const remainColor = remain ? (remain.charging ? COLORS.green : COLORS.red) : undefined;
  return (
    <View style={styles.batteryRow}>
      <View style={styles.batteryRowName}>
        <BatteryIcon state={flow.state} />
        <View>
          <Text style={styles.batteryRowNameText}>{label}</Text>
          {remain ? (
            <View style={styles.batteryRowSubRow}>
              <Text style={[styles.batteryRowRemain, { color: remainColor }]}>{remain.text}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text style={[styles.batteryRowVal, { color: flow.state === 'neutral' ? COLORS.text : flowColor(flow.state) }]}>
        {pct.toFixed(1)}%
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
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [cargas, setCargas] = useState<string>('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [live, setLive] = useState<'ok' | 'stale'>('stale');
  const [updatedLabel, setUpdatedLabel] = useState('Conectando…');
  const [ecoplayModalVisible, setEcoplayModalVisible] = useState(false);
  const [ecoplayPctInput, setEcoplayPctInput] = useState('');
  const [ecoplayModalError, setEcoplayModalError] = useState('');
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

  // Loop separado para los hooks laterales (Delta 2 / Batería Extra): dash
  // más chico y más rápido que el flujo principal, igual que
  // @keyframes flow-dash-lateral (0.96s, offset -14) en el dashboard web.
  const flowAnimLateral = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(flowAnimLateral, {
        toValue: 1,
        duration: 960,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [flowAnimLateral]);
  const flowDashOffsetLateral = flowAnimLateral.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });

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

  // Mismo patrón que toggleDevice, apuntando a /api/devices/charged. Caso
  // especial ecoplay: pasar a "cargada" abre el modal de % (fuente de verdad
  // real, igual que en web) en vez de togglear directo; pasar a "descargada"
  // sí es un toggle directo (el backend ya sincroniza ECOPLAY_LAST_PCT=0).
  const toggleCharged = useCallback(async (key: string, settingCharged: boolean) => {
    if (key === 'ecoplay' && settingCharged) {
      setEcoplayModalError('');
      setEcoplayPctInput('');
      setEcoplayModalVisible(true);
      return;
    }
    setDevices((prev) => prev.map((d) => (d.key === key ? { ...d, charged: settingCharged } : d)));
    try {
      const res = await fetch(`${API_BASE}/api/devices/charged`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: key, charged: settingCharged }),
      });
      const data: DevicesResponse = await res.json();
      if (data.devices) setDevices(data.devices);
      if (key === 'ecoplay') loadCargas();
    } catch {
      loadDevices();
    }
  }, [loadDevices, loadCargas]);

  // Modal de % de Ecoplay (POST /api/ecoplay), único trigger: el badge de
  // Ecoplay en "Estado de carga" cuando está descargada (ver toggleCharged).
  const submitEcoplayPct = useCallback(async () => {
    const pct = parseInt(ecoplayPctInput, 10);
    if (ecoplayPctInput === '' || Number.isNaN(pct) || pct < 0 || pct > 100) {
      setEcoplayModalError('Ingresá un % entero entre 0 y 100.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/ecoplay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pct }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEcoplayModalError(data.error || 'Error');
        return;
      }
      // Informar un % siempre implica que Ecoplay quedó "cargada" (es la
      // fuente de verdad real), así que sincronizamos el badge acá también.
      try {
        const chargedRes = await fetch(`${API_BASE}/api/devices/charged`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device: 'ecoplay', charged: true }),
        });
        const chargedData: DevicesResponse = await chargedRes.json();
        if (chargedData.devices) setDevices(chargedData.devices);
      } catch {
        loadDevices();
      }
      loadCargas();
      setEcoplayModalVisible(false);
    } catch {
      setEcoplayModalError('No se pudo conectar con el servidor.');
    }
  }, [ecoplayPctInput, loadDevices, loadCargas]);

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
  const ringColor = pct <= RING_RED_MAX_PCT ? COLORS.red : pct <= RING_YELLOW_MAX_PCT ? COLORS.yellow : COLORS.green;
  const acFlow: FlowState = status?.has_ac ? 'charging' : 'neutral';
  const solarFlow: FlowState = (status?.pv_w ?? 0) > NOISE_FLOOR_W ? 'charging' : 'neutral';

  // Wattage actual de cada nodo -> decide si su línea conectora se anima.
  const acTopActive = (status?.ac_w ?? 0) > NOISE_FLOOR_W;
  const solarActive = (status?.pv_w ?? 0) > NOISE_FLOOR_W;
  const acOutActive = (status?.ac_out_w ?? 0) > NOISE_FLOOR_W;
  const usbActive = (status?.usb_out_w ?? 0) > NOISE_FLOOR_W;

  // Nodo lateral derecho (batería extra/expansión): solo extra_in_w O
  // extra_out_w es distinto de cero a la vez (nunca ambos, confirmado en
  // producción). Descarga (extra_out_w) = rojo, ring->batería en visual pero
  // batería->ring en dirección de flujo real; carga (extra_in_w) = verde.
  const extraInW = status?.extra_in_w ?? 0;
  const extraOutW = status?.extra_out_w ?? 0;
  const lateralDischarging = extraOutW > NOISE_FLOOR_W;
  const lateralCharging = !lateralDischarging && extraInW > NOISE_FLOOR_W;
  const lateralW = lateralDischarging ? extraOutW : extraInW;
  const lateralState: FlowState = lateralDischarging ? 'discharging' : lateralCharging ? 'charging' : 'neutral';

  // Nodo lateral izquierdo (Delta 2 propia): misma lógica, fuente
  // delta2_charge_w/delta2_discharge_w (derivados de delta2_net_w).
  const delta2InW = status?.delta2_charge_w ?? 0;
  const delta2OutW = status?.delta2_discharge_w ?? 0;
  const delta2Discharging = delta2OutW > NOISE_FLOOR_W;
  const delta2Charging = !delta2Discharging && delta2InW > NOISE_FLOOR_W;
  const delta2W = delta2Discharging ? delta2OutW : delta2InW;
  const delta2State: FlowState = delta2Discharging ? 'discharging' : delta2Charging ? 'charging' : 'neutral';

  // Cada sección se arma una sola vez como variable JSX y se reusa TAL CUAL
  // (mismo árbol de componentes) tanto en el layout mobile (una sola
  // columna, orden original sin tocar) como en el layout tablet (3
  // columnas) — así no hay dos copias del diagrama central que se puedan
  // desincronizar entre sí.
  const notReadyCard = !status || !status.ready ? (
    <View style={styles.card}>
      <Text style={styles.dimText}>{status?.error ?? 'Conectando…'}</Text>
    </View>
  ) : null;

  const centerFlow = status && status.ready ? (
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
                  hub (150,122) at the ring's top edge, nodes x=75/225 y=8
                  (bottom-center of each top node). AC and Solar are the two
                  remaining nodes after the middle "Extra" node was removed
                  (consolidated into the ring's right lateral hook below) —
                  with only 2 icon-items left, iconsRowTop's space-around
                  naturally centers them at x=75/225 (25%/75% of 300px),
                  which is why the connector paths below anchor there instead
                  of the old 50/250. Each side node drops straight down to a
                  shared horizontal bus at y=65 (rounded 10px corners), then
                  a single shared vertical trunk continues from the bus
                  center (150,65) down to the hub. KEEP IN SYNC WITH
                  ecoflow_telegram_monitor.py .flow-connectors.top
                  (and vice-versa). */}
              <View style={styles.flowTopWrap}>
                <View style={styles.iconsRowTop}>
                  <IconCircle emoji="🔌" state={acFlow} watts={`${status.ac_w ?? 0} W`} dirLabel={status.has_ac ? 'Sí' : undefined} name="AC" />
                  <IconCircle emoji="☀️" state={solarFlow} watts={`${status.pv_w ?? 0} W`} name="Solar" />
                </View>
                <Svg width={300} height={130} viewBox="0 0 300 130" style={styles.flowConnectorsTop}>
                  <Path d="M 75,8 L 75,55 Q 75,65 85,65 L 140,65 Q 150,65 150,75 L 150,122" stroke="#232c36" strokeWidth={2} fill="none" />
                  <AnimatedPath d="M 75,8 L 75,55 Q 75,65 85,65 L 140,65 Q 150,65 150,75 L 150,122" stroke={COLORS.green} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,10" strokeDashoffset={flowDashOffset} fill="none" opacity={acTopActive ? 1 : 0} />
                  <Path d="M 225,8 L 225,55 Q 225,65 215,65 L 160,65 Q 150,65 150,75 L 150,122" stroke="#232c36" strokeWidth={2} fill="none" />
                  <AnimatedPath d="M 225,8 L 225,55 Q 225,65 215,65 L 160,65 Q 150,65 150,75 L 150,122" stroke={COLORS.green} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,10" strokeDashoffset={flowDashOffset} fill="none" opacity={solarActive ? 1 : 0} />
                </Svg>
              </View>

              {/* Anillo de porcentaje, con dos "hooks" laterales (izq =
                  Delta 2 propia, der = batería extra/expansión) que salen
                  del borde del anillo en su punto medio vertical — ver
                  GEOMETRY SPEC en ecoflow_telegram_monitor.py
                  .lateral-overlay/.lateral-overlay-left (KEEP IN SYNC).
                  ringWrap tiene position:'relative' implícito (default de
                  RN), así que estos overlays absolutos se anclan a su caja
                  sin afectar el centrado del anillo. */}
              <View style={styles.ringWrap}>
                <PercentRing pct={pct} color={ringColor} />
                <View style={styles.ringInner}>
                  <Text style={styles.pct}>{status.percent != null ? status.percent.toFixed(1) : '--'}%</Text>
                  <Text style={styles.pctSubLabel}>Tiempo restante</Text>
                  <Text style={styles.pctSubDur}>{status.remain_duration || '--'}</Text>
                </View>
                <View style={styles.lateralOverlayLeft}>
                  <LateralHook side="left" charging={delta2Charging} discharging={delta2Discharging} dashOffset={flowDashOffsetLateral} />
                  <LateralIcon side="left" state={delta2State} watts={`${delta2W} W`} name="Delta 2" />
                </View>
                <View style={styles.lateralOverlayRight}>
                  <LateralHook side="right" charging={lateralCharging} discharging={lateralDischarging} dashOffset={flowDashOffsetLateral} />
                  <LateralIcon side="right" state={lateralState} watts={`${lateralW} W`} name="Batería" />
                </View>
              </View>

              {/* Fila inferior: CA / USB, con conectores tipo manifold/elbow
                  hacia el anillo central.
                  GEOMETRY SPEC (manifold/elbow style): sdd/power-flow-bottom-nodes/design
                  §4 — viewBox 0 0 300 130, hub (150,8), nodes x=75/225 y=122.
                  CA/USB son los 2 nodos que quedan después de sacar el
                  "Batería" del medio (consolidado en el hook lateral derecho
                  del anillo, ver arriba) — mismo razonamiento de centrado
                  x=75/225 que la fila de arriba. Each side node connects to
                  a shared horizontal bus at y=65 (rounded 10px corners),
                  then a single shared vertical trunk continues from the bus
                  center (150,65) to the hub. DIRECTION: unlike the top row
                  above (Entrada, defined node -> hub), these bottom-row
                  (Salida) paths are defined hub -> node — the ring feeds the
                  device, so the flow-dash animation must walk in the
                  opposite winding direction, same visual geometry. KEEP IN
                  SYNC WITH ecoflow_telegram_monitor.py .flow-connectors
                  (and vice-versa). */}
              <View style={styles.flowBottomWrap}>
                <Svg width={300} height={130} viewBox="0 0 300 130" style={styles.flowConnectors}>
                  <Path d="M 150,8 L 150,55 Q 150,65 140,65 L 85,65 Q 75,65 75,75 L 75,122" stroke="#232c36" strokeWidth={2} fill="none" />
                  <AnimatedPath d="M 150,8 L 150,55 Q 150,65 140,65 L 85,65 Q 75,65 75,75 L 75,122" stroke={COLORS.red} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,10" strokeDashoffset={flowDashOffset} fill="none" opacity={acOutActive ? 1 : 0} />
                  <Path d="M 150,8 L 150,55 Q 150,65 160,65 L 215,65 Q 225,65 225,75 L 225,122" stroke="#232c36" strokeWidth={2} fill="none" />
                  <AnimatedPath d="M 150,8 L 150,55 Q 150,65 160,65 L 215,65 Q 225,65 225,75 L 225,122" stroke={COLORS.red} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,10" strokeDashoffset={flowDashOffset} fill="none" opacity={usbActive ? 1 : 0} />
                </Svg>
                <View style={styles.iconsRowBottom}>
                  <IconCircle emoji="🔌" state="neutral" watts={`${status.ac_out_w ?? 0} W`} name="CA" />
                  <IconCircle icon={<UsbIcon color={COLORS.dim} />} state="neutral" watts={`${status.usb_out_w ?? 0} W`} name="USB" />
                </View>
              </View>

    </>
  ) : null;

  // ETA box ("Llena a las...") extraída como sección propia (antes vivía
  // adentro de centerFlow) para poder reubicarla en la columna izquierda,
  // debajo de "Gestión de cargas", en el layout de iPad — en mobile se
  // sigue renderizando justo después de centerFlow, mismo lugar de siempre.
  const etaBoxSection = status && status.ready && (status.eta_text || status.goal_label) ? (
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
  ) : null;

  const batteriesSection = status && status.ready ? (
    <View style={styles.batteries}>
      {status.soc_delta2 != null && (
        <BatteryRow label="Delta 2" pct={status.soc_delta2} netW={status.delta2_net_w} remain={status.delta2_remain} />
      )}
      {status.soc_extra != null && (
        <BatteryRow label="Batería Extra" pct={status.soc_extra} netW={status.extra_net_w} remain={status.extra_remain} />
      )}
    </View>
  ) : null;

  // Gestión de cargas
  const cargasSection = cargas ? (
    <View style={styles.cargas}>
      <Text style={styles.sectionTitle}>Gestión de cargas</Text>
      <View style={styles.cargasBox}>
        <Text style={styles.cargasText}>{formatCargas(cargas)}</Text>
      </View>
    </View>
  ) : null;

  // Estado de carga: tocable, mismo patrón que "Qué tenés encendido" pero
  // apuntando a /api/devices/charged (mirroring web dashboard).
  const estadoCargaSection = devices.some((d) => d.charged != null) ? (
    <View style={styles.devices}>
      <Text style={styles.sectionTitle}>Estado de carga</Text>
      {devices
        .filter((d) => d.charged != null)
        .map((d) => (
          <Pressable
            key={d.key}
            onPress={() => toggleCharged(d.key, !d.charged)}
            style={[styles.deviceBtn, d.charged ? styles.deviceBtnOn : styles.deviceBtnOff]}
          >
            <Text style={styles.deviceBtnName}>
              {d.emoji} {d.label}
            </Text>
            <Text style={[styles.deviceState, { color: d.charged ? COLORS.green : COLORS.faint }]}>
              {d.charged ? '🔋 cargada' : '🪫 descargada'}
            </Text>
          </Pressable>
        ))}
    </View>
  ) : null;

  // Dispositivos
  const dispositivosSection = devices.length > 0 ? (
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
  ) : null;

  const updatedRowSection = (
    <View style={styles.updatedRow}>
      <View style={[styles.liveDot, { backgroundColor: live === 'ok' ? COLORS.green : '#ef4444' }]} />
      <Text style={styles.updatedText}>{updatedLabel}</Text>
    </View>
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.dim} />}
        >
          {isTablet ? (
            // Layout tablet/iPad (>= TABLET_BREAKPOINT): 3 columnas
            // independientes en un contenedor flexDirection:'row'. CLAVE:
            // alignItems:'flex-start' en vez de 'stretch' (el default de
            // 'stretch' NO aplica acá porque cada columna ya tiene su propio
            // ancho fijo, pero 'flex-start' además evita que RN intente
            // igualar alturas — cada View hija en un row solo crece a la
            // altura de SU PROPIO contenido, nunca la de sus hermanas). Esto
            // es justamente lo que CSS Grid no daba: ahí una fila de grid se
            // estira a la altura del ítem más alto de esa fila entre TODAS
            // las columnas, generando huecos enormes cuando un panel lateral
            // corto compartía fila con el diagrama central, mucho más alto.
            // Acá no hay filas compartidas entre columnas: cada columna es
            // un único bloque vertical independiente, sin ninguna
            // coordinación de alturas entre sí.
            <View style={styles.tabletRow}>
              <View style={styles.tabletColLeft}>
                {batteriesSection}
                {cargasSection}
                {etaBoxSection}
              </View>
              <View style={styles.tabletColCenter}>
                {notReadyCard}
                {centerFlow}
                {updatedRowSection}
              </View>
              <View style={styles.tabletColRight}>
                {estadoCargaSection}
                {dispositivosSection}
              </View>
            </View>
          ) : (
            // Layout mobile (< TABLET_BREAKPOINT): una sola columna, mismo
            // orden y mismos componentes que antes de este cambio — sin
            // modificaciones de comportamiento (etaBoxSection ahora está
            // separada de centerFlow pero se renderiza justo después, mismo
            // lugar visual de siempre).
            <>
              {notReadyCard}
              {centerFlow}
              {etaBoxSection}
              {batteriesSection}
              {cargasSection}
              {estadoCargaSection}
              {dispositivosSection}
            </>
          )}

          {/* En tablet, updatedRowSection ya se renderiza adentro de
              tabletColCenter (debajo del diagrama) — acá solo hace falta
              para mobile, donde sigue yendo al final como siempre. */}
          {!isTablet && updatedRowSection}
        </ScrollView>

        <Modal
          visible={ecoplayModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEcoplayModalVisible(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setEcoplayModalVisible(false)}>
            <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Ecoplay: % de batería propia</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="number-pad"
                placeholder="0-100"
                placeholderTextColor={COLORS.faint}
                value={ecoplayPctInput}
                onChangeText={setEcoplayPctInput}
                maxLength={3}
              />
              {ecoplayModalError ? <Text style={styles.modalError}>{ecoplayModalError}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={submitEcoplayPct}>
                  <Text style={styles.modalBtnPrimaryText}>Aceptar</Text>
                </Pressable>
                <Pressable style={styles.modalBtn} onPress={() => setEcoplayModalVisible(false)}>
                  <Text style={styles.modalBtnText}>Cerrar</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
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

  // Modal de % de Ecoplay — mismo estilo dark que .modal-box/.eta-box en
  // web (bg #141b22, radios, colores de acento), sin inventar un lenguaje
  // visual nuevo.
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { width: '100%', maxWidth: 320, backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 14, padding: 20 },
  modalTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  modalInput: {
    borderColor: COLORS.border, borderWidth: 1, borderRadius: 8, color: COLORS.text,
    fontSize: 16, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
  },
  modalError: { color: COLORS.red, fontSize: 13, marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, borderRadius: 8, borderColor: COLORS.border, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  modalBtnPrimary: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  modalBtnText: { color: COLORS.text, fontSize: 15 },
  modalBtnPrimaryText: { color: '#0b0f14', fontSize: 15, fontWeight: '600' },

  // Layout tablet/iPad — ver comentario junto a `isTablet` en el render.
  // alignItems:'flex-start' (no 'stretch') es lo que mantiene la altura de
  // cada columna desacoplada de sus hermanas.
  tabletRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', width: '100%', gap: 24 },
  tabletColLeft: { flexDirection: 'column', width: 260 },
  tabletColCenter: { flexDirection: 'column', alignItems: 'center', width: 380 },
  tabletColRight: { flexDirection: 'column', width: 260 },

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
  // Hooks laterales (Delta 2 propia / batería extra), anclados al borde del
  // ring en su punto medio vertical (top: 120 = mitad de los 240px de
  // ringWrap). left:240 = borde derecho, left:0 = borde izquierdo — mismos
  // valores que .lateral-overlay/.lateral-overlay-left en
  // ecoflow_telegram_monitor.py. width/height:0 para no consumir layout.
  lateralOverlayRight: { position: 'absolute', left: 240, top: 120, width: 0, height: 0 },
  lateralOverlayLeft: { position: 'absolute', left: 0, top: 120, width: 0, height: 0 },
  lateralSvg: { overflow: 'visible' },
  // Con viewBox "-64 0 64 40" el contenido (x entre -62 y 0) queda pegado
  // al borde DERECHO de la caja renderizada del Svg — sin mover la caja,
  // el gancho se vería 64px más a la derecha de lo que corresponde. Se
  // corre la caja misma 64px a la izquierda para compensar.
  lateralSvgLeft: { marginLeft: -64 },
  lateralIconRight: { position: 'absolute', left: 34, top: 18, width: 56, alignItems: 'center' },
  lateralIconLeft: { position: 'absolute', left: -90, top: 18, width: 56, alignItems: 'center' },
  lateralIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  lateralIconWatts: { fontSize: 11, color: COLORS.dim, marginTop: 3, fontVariant: ['tabular-nums'] },
  lateralIconName: { fontSize: 9, color: COLORS.faint, marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase' },

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
