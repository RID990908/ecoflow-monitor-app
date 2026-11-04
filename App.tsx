import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import * as Updates from 'expo-updates';

import type { FlowState } from './types';
import { COLORS, PLANT_TONE_COLOR } from './theme';
import { DiagramBackdrop } from './components/DiagramBackdrop';
import { FlowPath } from './components/FlowPath';
import { LiveDot } from './components/LiveDot';
import { StatusBanner } from './components/StatusBanner';
import { GridTowerIcon } from './components/icons/GridTowerIcon';
import { GeneratorIcon } from './components/icons/GeneratorIcon';
import { UsbIcon } from './components/icons/UsbIcon';
import { ArrowDownIcon } from './components/icons/ArrowDownIcon';
import { ArrowUpIcon } from './components/icons/ArrowUpIcon';
import { PercentRing } from './components/icons/PercentRing';
import { IconCircle } from './components/icons/IconCircle';
import { LateralIcon } from './components/icons/LateralIcon';
import { LateralHook } from './components/icons/LateralHook';
import type { AcOrigin } from './lib/acOrigin';
import {
  BATTERY_CAPACITY_WH,
  PLANT_OUTPUT_W,
  plantNeed,
  plantNodeLabel,
  plantTone,
} from './lib/plantNeed';

// Paths de los colectores (viewBox 0 0 300 130). Los de arriba van nodo -> hub
// (entrada); los de abajo, hub -> nodo (salida), para que el dash viaje en el
// sentido real del flujo. KEEP IN SYNC con ecoflow_telegram_monitor.py.
const TOP_GRID = 'M 50,8 L 50,55 Q 50,65 60,65 L 140,65 Q 150,65 150,75 L 150,130';
const TOP_PLANT = 'M 150,8 L 150,130';
const TOP_SOLAR = 'M 250,8 L 250,55 Q 250,65 240,65 L 160,65 Q 150,65 150,75 L 150,130';
// Track-only variants: the shared trunk is drawn once so idle tracks never
// paint over an active beam.
const TOP_GRID_TRACK = 'M 50,8 L 50,55 Q 50,65 60,65 L 140,65 Q 150,65 150,75';
const TOP_SOLAR_TRACK = 'M 250,8 L 250,55 Q 250,65 240,65 L 160,65 Q 150,65 150,75';
const BOTTOM_USB_TRACK = 'M 150,55 Q 150,65 160,65 L 215,65 Q 225,65 225,75 L 225,122';
const BOTTOM_AC = 'M 150,0 L 150,55 Q 150,65 140,65 L 85,65 Q 75,65 75,75 L 75,122';
const BOTTOM_USB = 'M 150,0 L 150,55 Q 150,65 160,65 L 215,65 Q 225,65 225,75 L 225,122';

// Diámetro del anillo principal: 224 deja espacio a los nodos laterales dentro
// de un ancho de 390 (con 240 el nodo derecho se salía ~7px de la pantalla).
const RING = 224;

const STATUS_POLL_MS = 1000;
const FETCH_TIMEOUT_MS = 5000;
// Data older than this (or a not-ready payload) is shown as stale.
const STALE_AFTER_MS = 10000;

const API_BASE = 'https://ecoflow-monitor-production.up.railway.app';

// Umbrales de color del ring principal (rojo/amarillo/verde). Mismos valores
// que RING_RED_MAX_PCT/RING_YELLOW_MAX_PCT en el dashboard web — si cambian
// acá, cambiarlos ahí también para que no queden desincronizados.
const RING_RED_MAX_PCT = 10;
const RING_YELLOW_MAX_PCT = 20;

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
  threshold_short?: string | null;
  threshold_pct?: number | null;
  ac_origin?: AcOrigin;
  grid_out?: boolean;
  last_ac_text?: string | null;
  last_ac_short?: string | null;
  remain_duration?: string | null;
  ports?: { name: string; watts: number }[];
  updated_at?: string;
  ac_out_w: number;
  extra_in_w: number;
  extra_out_w: number;
  usb_out_w: number;
  delta2_charge_w: number;
  delta2_discharge_w: number;
};

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Where the AC input comes from, as marked by the user. The backend keeps it
  // (it survives restarts); local state only smooths the tap until the next
  // poll echoes it back.
  const [acOrigin, setAcOrigin] = useState<AcOrigin>('unclassified');
  // Street power is out: the plant was chosen as the AC source, or AC that was
  // classified as grid dropped. Any AC that shows up is assumed to come from
  // the plant until the user says the grid is back.
  const [gridOut, setGridOut] = useState(false);
  // Ignore server echoes briefly after a tap so a poll already in flight does
  // not undo it.
  const originTapAt = useRef(0);

  // Derived flow flags (computed before the effects below so hooks stay
  // unconditional and in a stable order).
  // Wattage actual de cada nodo -> decide si su línea conectora se anima.
  // AC arrival is detected from has_ac (never from the user's selection); the
  // origin only decides which node (Red or Planta) shows it.
  const hasAc = !!status?.has_ac;
  const effectiveOrigin: AcOrigin = gridOut && hasAc ? 'plant' : acOrigin;
  const redActive = hasAc && effectiveOrigin !== 'plant';
  const plantActive = hasAc && effectiveOrigin === 'plant';

  const serverOrigin = status?.ac_origin;
  const serverGridOut = status?.grid_out;
  useEffect(() => {
    if (Date.now() - originTapAt.current < 3000) return;
    if (serverOrigin) setAcOrigin(serverOrigin);
    if (serverGridOut !== undefined) setGridOut(serverGridOut);
  }, [serverOrigin, serverGridOut]);

  // Tapping the Red / Planta nodes marks where the AC comes from; tapping the
  // active one again clears it. While the grid is out, Red means "grid is back".
  const markOrigin = useCallback((next: AcOrigin) => {
    originTapAt.current = Date.now();
    setAcOrigin(next);
    setGridOut(next === 'plant');
    fetch(`${API_BASE}/api/ac-origin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin: next }),
    }).catch(() => {
      // Offline: the tap stays local and the next poll restores the server value.
    });
  }, []);
  const onRedPress = useCallback(() => {
    markOrigin(gridOut || acOrigin !== 'grid' ? 'grid' : 'unclassified');
  }, [markOrigin, gridOut, acOrigin]);
  const onPlantPress = useCallback(() => {
    markOrigin(acOrigin === 'plant' ? 'unclassified' : 'plant');
  }, [markOrigin, acOrigin]);
  const solarActive = (status?.pv_w ?? 0) > 0;
  const acOutActive = (status?.ac_out_w ?? 0) > 0;
  const usbActive = (status?.usb_out_w ?? 0) > 0;

  // Nodo lateral derecho (batería extra/expansión): solo extra_in_w O
  // extra_out_w es distinto de cero a la vez (nunca ambos, confirmado en
  // producción). Descarga (extra_out_w) = rojo, ring->batería en visual pero
  // batería->ring en dirección de flujo real; carga (extra_in_w) = verde.
  const extraInW = status?.extra_in_w ?? 0;
  const extraOutW = status?.extra_out_w ?? 0;
  const lateralDischarging = extraOutW > 0;
  const lateralCharging = !lateralDischarging && extraInW > 0;
  const lateralW = lateralDischarging ? extraOutW : extraInW;
  const lateralState: FlowState = lateralDischarging ? 'discharging' : lateralCharging ? 'charging' : 'neutral';

  // Nodo lateral izquierdo (Delta 2 propia): misma lógica, fuente
  // delta2_charge_w/delta2_discharge_w (derivados de delta2_net_w).
  const delta2InW = status?.delta2_charge_w ?? 0;
  const delta2OutW = status?.delta2_discharge_w ?? 0;
  const delta2Discharging = delta2OutW > 0;
  const delta2Charging = !delta2Discharging && delta2InW > 0;
  const delta2W = delta2Discharging ? delta2OutW : delta2InW;
  const delta2State: FlowState = delta2Discharging ? 'discharging' : delta2Charging ? 'charging' : 'neutral';

  const mainFlowActive = redActive || plantActive || solarActive || acOutActive || usbActive;
  const lateralFlowActive = delta2Charging || delta2Discharging || lateralCharging || lateralDischarging;

  // Offset animado compartido para el "flujo" de las líneas conectoras
  // (dash que viaja por el path) — un solo loop, reusado por todos los
  // overlays; cada uno se prende/apaga por separado según su wattage.
  // useNativeDriver:false porque strokeDashoffset no es soportado por el
  // driver nativo de RN. El loop corre solo mientras algún nodo está activo.
  const flowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!mainFlowActive) return;
    const loop = Animated.loop(
      Animated.timing(flowAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      flowAnim.setValue(0);
    };
  }, [flowAnim, mainFlowActive]);
  const flowDashOffset = flowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });

  // Loop separado para los hooks laterales (Delta 2 / Batería Extra): dash
  // más chico y más rápido que el flujo principal, igual que
  // @keyframes flow-dash-lateral (0.96s, offset -14) en el dashboard web.
  const flowAnimLateral = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!lateralFlowActive) return;
    const loop = Animated.loop(
      Animated.timing(flowAnimLateral, {
        toValue: 1,
        duration: 960,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      flowAnimLateral.setValue(0);
    };
  }, [flowAnimLateral, lateralFlowActive]);
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

  const inFlight = useRef(false);
  const loadStatus = useCallback(async () => {
    // At a 1 s cadence a slow response must not overlap the next request.
    if (inFlight.current) return;
    inFlight.current = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}/api/status`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StatusResponse = await res.json();
      setStatus(data);
      const t = Date.now();
      setLastSuccessAt(t);
      setNow(t);
    } catch {
      // timeout, abort or network error: counts as a failed request
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
    }
  }, []);

  // Poll only while the app is in the foreground. On resume, refresh right
  // away and restart both intervals (react-native-web maps AppState to page
  // visibility).
  useEffect(() => {
    let statusInterval: ReturnType<typeof setInterval> | null = null;
    let clockInterval: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (statusInterval) clearInterval(statusInterval);
      if (clockInterval) clearInterval(clockInterval);
      statusInterval = null;
      clockInterval = null;
    };
    const start = () => {
      stop();
      setNow(Date.now());
      loadStatus();
      statusInterval = setInterval(loadStatus, STATUS_POLL_MS);
      clockInterval = setInterval(() => setNow(Date.now()), 1000);
    };

    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') start();
      else stop();
    });
    return () => {
      sub.remove();
      stop();
    };
  }, [loadStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  }, [loadStatus]);

  const pct = status?.percent ?? 0;
  const ringColor = pct <= RING_RED_MAX_PCT ? COLORS.red : pct <= RING_YELLOW_MAX_PCT ? COLORS.yellow : COLORS.green;
  const solarFlow: FlowState = (status?.pv_w ?? 0) > 0 ? 'charging' : 'neutral';

  // Single source of truth for staleness: no success yet, last success too
  // old, or the backend reports it is not ready.
  const stale = lastSuccessAt == null || now - lastSuccessAt > STALE_AFTER_MS || !status?.ready;
  const minutesAgo = lastSuccessAt == null ? null : Math.max(1, Math.floor((now - lastSuccessAt) / 60000));

  // Only the backend's own error message gets a card; plain "connecting" is
  // already covered by the StatusBanner.
  const notReadyCard = status?.error && !status.ready ? (
    <View style={styles.card}>
      <Text style={styles.dimText}>{status.error}</Text>
    </View>
  ) : null;

  // Wide web screens: diagram and plant card side by side.
  const { width: winW } = useWindowDimensions();
  const wide = winW >= 900;

  const inW = status?.in_w ?? 0;
  const outW = status?.out_w ?? 0;
  const stateWord = inW > outW ? 'Cargando' : inW < outW ? 'Descargando' : 'Usando';
  const stateColor =
    stateWord === 'Usando'
      ? COLORS.dim
      : status?.eta_text
        ? status.eta_ok
          ? COLORS.green
          : COLORS.red
        : stateWord === 'Cargando'
          ? COLORS.green
          : COLORS.red;

  // Full battery: the backend reports no remaining time ("—"), so say so.
  const remainEmpty = !status?.remain_duration || status.remain_duration === '—';
  const batteryFull = pct >= 99 && remainEmpty;
  const ringLine = status?.eta_text
    ? status.eta_text
    : stateWord === 'Usando' && hasAc
      ? 'Usando la CA'
      : stateWord;

  const floorPct = status?.threshold_pct ?? 20;
  const need = plantNeed({
    percent: pct,
    floorPct,
    pvW: status?.pv_w ?? 0,
    outW,
    capacityWh: BATTERY_CAPACITY_WH,
    plantW: PLANT_OUTPUT_W,
    nowMs: now,
  });
  // With any AC input the plant is not needed; the verdict only applies on solar alone.
  const nodeNeed = hasAc ? { ...need, kind: 'ok' as const } : need;

  const centerFlow = status && status.ready ? (
    <>
              {/* io-row: entrada / salida */}
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

              {/* GEOMETRY SPEC (top, three nodes into the hub): viewBox
                  0 0 300 130, hub (150,122) at the ring's top edge, nodes
                  Red/Planta/Solar at x=50/150/250 y=8 (with 3 icon-items
                  space-around centers them at 1/6, 3/6, 5/6 of 300px). Red
                  and Solar drop to a shared bus at y=65 (rounded 10px
                  corners) and join the trunk at (150,65); Planta goes
                  straight down. KEEP IN SYNC WITH
                  ecoflow_telegram_monitor.py .flow-connectors.top. */}
              <View style={styles.flowTopWrap}>
                <View style={styles.iconsRowTop}>
                  {/* The dirLabel slot shows "hace Xh"/"sin registro" while
                      there is no AC, and the unclassified hint while the
                      user has not picked an origin. */}
                  <IconCircle
                    icon={<GridTowerIcon />}
                    state={redActive ? 'charging' : 'neutral'}
                    watts={`${redActive ? status.ac_w ?? 0 : 0} W`}
                    dirLabel={
                      redActive
                        ? effectiveOrigin === 'unclassified'
                          ? 'sin clasificar'
                          : undefined
                        : status.last_ac_short
                          ? status.last_ac_short // backend text already reads "hace 19h 56m"
                          : 'sin registro'
                    }
                    dirColor={redActive && effectiveOrigin === 'unclassified' ? COLORS.yellow : undefined}
                    onPress={hasAc ? onRedPress : undefined}
                    selected={redActive && effectiveOrigin === 'grid'}
                    name="Red"
                  />
                  <IconCircle
                    icon={<GeneratorIcon />}
                    state={plantActive ? 'charging' : 'neutral'}
                    watts={`${plantActive ? status.ac_w ?? 0 : 0} W`}
                    dirLabel={plantActive ? 'en uso' : plantNodeLabel(nodeNeed, now)}
                    dirColor={plantActive ? undefined : PLANT_TONE_COLOR[plantTone(nodeNeed.kind)]}
                    onPress={hasAc ? onPlantPress : undefined}
                    selected={plantActive}
                    name="Planta"
                  />
                  <IconCircle emoji="☀️" state={solarFlow} watts={`${status.pv_w ?? 0} W`} name="Solar" />
                </View>
                <Svg width={300} height={130} viewBox="0 0 300 130" style={styles.flowConnectorsTop}>
                  <FlowPath d={TOP_GRID_TRACK} color={COLORS.green} active={false} dashOffset={flowDashOffset} layer="track" />
                  <FlowPath d={TOP_SOLAR_TRACK} color={COLORS.green} active={false} dashOffset={flowDashOffset} layer="track" />
                  <FlowPath d={TOP_PLANT} color={COLORS.green} active={false} dashOffset={flowDashOffset} layer="track" />
                  <FlowPath d={TOP_GRID} color={COLORS.green} active={redActive} dashOffset={flowDashOffset} layer="beam" />
                  <FlowPath d={TOP_PLANT} color={COLORS.green} active={plantActive} dashOffset={flowDashOffset} layer="beam" />
                  <FlowPath d={TOP_SOLAR} color={COLORS.green} active={solarActive} dashOffset={flowDashOffset} layer="beam" />
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
                {/* Resplandor suave detrás del anillo, del color de su estado. */}
                <Svg width={RING * 1.7} height={RING * 1.7} style={styles.ringGlow} pointerEvents="none">
                  <Defs>
                    <RadialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
                      <Stop offset="0.45" stopColor={ringColor} stopOpacity={0.14} />
                      <Stop offset="1" stopColor={ringColor} stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Circle cx="50%" cy="50%" r="50%" fill="url(#ringGlow)" />
                </Svg>
                <PercentRing pct={pct} color={ringColor} />
                <View style={styles.ringInner}>
                  <LiveDot live={!stale} />
                  <Text style={styles.pct}>{status.percent != null ? status.percent.toFixed(1) : '--'}%</Text>
                  <Text style={styles.pctSubLabel}>{batteryFull ? 'Batería llena' : 'Tiempo restante'}</Text>
                  {batteryFull ? null : <Text style={styles.pctSubDur}>{status.remain_duration || '--'}</Text>}
                  {/* eta_text already says the direction ("Llena a las…", "Dura hasta las…"); the state word only fills in when there is none. */}
                  <Text style={[styles.pctEta, { color: stateColor }]}>{ringLine}</Text>
                  {status.threshold_short ? <Text style={styles.pctThreshold}>{status.threshold_short}</Text> : null}
                </View>
                <View style={styles.lateralOverlayLeft}>
                  <LateralHook side="left" charging={delta2Charging} discharging={delta2Discharging} dashOffset={flowDashOffsetLateral} />
                  <LateralIcon side="left" state={delta2State} watts={`${delta2W} W`} name="Delta 2" pct={status.soc_delta2} remain={status.delta2_remain} />
                </View>
                <View style={styles.lateralOverlayRight}>
                  <LateralHook side="right" charging={lateralCharging} discharging={lateralDischarging} dashOffset={flowDashOffsetLateral} />
                  <LateralIcon side="right" state={lateralState} watts={`${lateralW} W`} name="Batería" pct={status.soc_extra} remain={status.extra_remain} />
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
                  <FlowPath d={BOTTOM_AC} color={COLORS.red} active={false} dashOffset={flowDashOffset} layer="track" />
                  <FlowPath d={BOTTOM_USB_TRACK} color={COLORS.red} active={false} dashOffset={flowDashOffset} layer="track" />
                  <FlowPath d={BOTTOM_AC} color={COLORS.red} active={acOutActive} dashOffset={flowDashOffset} layer="beam" />
                  <FlowPath d={BOTTOM_USB} color={COLORS.red} active={usbActive} dashOffset={flowDashOffset} layer="beam" />
                </Svg>
                <View style={styles.iconsRowBottom}>
                  <IconCircle emoji="🏠" state={acOutActive ? 'discharging' : 'neutral'} watts={`${status.ac_out_w ?? 0} W`} name="CA" />
                  <IconCircle icon={<UsbIcon />} state={usbActive ? 'discharging' : 'neutral'} watts={`${status.usb_out_w ?? 0} W`} name="USB" />
                </View>
              </View>

    </>
  ) : null;

  return (
    <SafeAreaProvider>
      <View style={styles.screen}>
      <DiagramBackdrop />
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" />
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.dim} />}
        >
          {stale ? <StatusBanner minutesAgo={minutesAgo} /> : null}
          {notReadyCard}
          <View style={[styles.body, wide && styles.bodyWide]}>
          <View style={[styles.diagram, wide && styles.diagramWide, stale && styles.diagramStale]}>{centerFlow}</View>
          </View>
        </ScrollView>

      </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  root: { flex: 1 },
  scroll: { padding: 20, paddingTop: 24, alignItems: 'center', paddingBottom: 50 },
  card: {
    backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 14,
    padding: 16, width: '100%', maxWidth: 380,
  },
  dimText: { color: COLORS.dim, fontSize: 14 },

  ioRow: { width: '100%', maxWidth: 380, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  ioCol: { flex: 1 },
  ioLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ioLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  ioValue: { fontSize: 24, fontWeight: '700', marginTop: 3, color: COLORS.text, fontVariant: ['tabular-nums'] },

  flowTopWrap: { width: 300, maxWidth: '100%', alignSelf: 'center', paddingBottom: 122 },
  iconsRowTop: { width: 300, maxWidth: 300, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-around' },
  flowConnectorsTop: { position: 'absolute', left: 0, bottom: 0 },
  flowBottomWrap: { width: 300, maxWidth: '100%', alignSelf: 'center', paddingTop: 122 },
  flowConnectors: { position: 'absolute', top: 0, left: 0 },
  iconsRowBottom: { width: 300, maxWidth: 300, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-around' },

  ringWrap: { width: RING, height: RING, marginTop: 0, marginBottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringGlow: { position: 'absolute' },
  ringInner: {
    width: RING - 34, height: RING - 34, borderRadius: (RING - 34) / 2, backgroundColor: COLORS.disc,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  // Hooks laterales (Delta 2 propia / batería extra), anclados al borde del
  // ring en su punto medio vertical (top: RING/2 = mitad de ringWrap).
  // left:RING = borde derecho, left:0 = borde izquierdo — mismos
  // valores que .lateral-overlay/.lateral-overlay-left en
  // ecoflow_telegram_monitor.py. width/height:0 para no consumir layout.
  lateralOverlayRight: { position: 'absolute', left: RING, top: RING / 2, width: 0, height: 0 },
  lateralOverlayLeft: { position: 'absolute', left: 0, top: RING / 2, width: 0, height: 0 },

  pct: { fontSize: 46, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },
  pctSubLabel: { fontSize: 13, color: COLORS.dim, marginTop: 8 },
  pctSubDur: { fontSize: 21, color: '#e8edf2', fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  pctEta: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  pctThreshold: { fontSize: 12, fontWeight: '600', marginTop: 3, color: COLORS.red },

  body: { width: '100%', alignItems: 'center' },
  bodyWide: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 48 },
  diagramWide: { width: 420 },
  diagram: { width: '100%', alignItems: 'center' },
  diagramStale: { opacity: 0.45 },
});
