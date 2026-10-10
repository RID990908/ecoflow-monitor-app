import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Updates from 'expo-updates';

import type { FlowState } from './types';
import { COLORS } from './theme';
import { TowerIcon } from './components/icons/TowerIcon';
import { SourceEmoji } from './components/icons/SourceEmoji';
import { UsbIcon } from './components/icons/UsbIcon';
import { ArrowDownIcon } from './components/icons/ArrowDownIcon';
import { ArrowUpIcon } from './components/icons/ArrowUpIcon';
import { PercentRing } from './components/icons/PercentRing';
import { IconCircle } from './components/icons/IconCircle';
import { LateralIcon } from './components/icons/LateralIcon';
import { LateralHook } from './components/icons/LateralHook';

// react-native-svg no trae Animated.createAnimatedComponent aplicado a Path
// por defecto; se arma acá porque no hay reanimated como dependencia (ver
// package.json) — se anima strokeDashoffset con la Animated API nativa de RN.
const AnimatedPath = Animated.createAnimatedComponent(Path);

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
  last_ac_text?: string | null;
  last_ac_short?: string | null;
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

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
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

  useEffect(() => {
    loadStatus();
    const statusInterval = setInterval(loadStatus, 2000);
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
      clearInterval(clockInterval);
    };
  }, [loadStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  }, [loadStatus]);

  const pct = status?.percent ?? 0;
  const ringColor = pct <= RING_RED_MAX_PCT ? COLORS.red : pct <= RING_YELLOW_MAX_PCT ? COLORS.yellow : COLORS.green;
  const acFlow: FlowState = status?.has_ac ? 'charging' : 'neutral';
  const solarFlow: FlowState = (status?.pv_w ?? 0) > 0 ? 'charging' : 'neutral';

  // Wattage actual de cada nodo -> decide si su línea conectora se anima.
  const acTopActive = (status?.ac_w ?? 0) > 0;
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
                  <View style={[styles.emojiWrap, styles.sourceEmojiRow]}>
                    <SourceEmoji value={status.source_emoji} />
                  </View>
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
                  {/* Reusa el slot de dirLabel (antes quedaba en blanco
                      cuando has_ac es false — a diferencia de la web, que
                      sí imprime "No" ahí) para mostrar "hace Xh"/"sin
                      registro" sin agregar una fila nueva ni dejar espacio
                      vacío. */}
                  <IconCircle
                    icon={<TowerIcon size={32} />}
                    state={acFlow}
                    watts={`${status.ac_w ?? 0} W`}
                    dirLabel={status.has_ac ? 'Sí' : status.last_ac_short || 'sin registro'}
                    name="CA"
                  />
                  <IconCircle emoji="☀️" state={solarFlow} watts={`${status.pv_w ?? 0} W`} name="Solar" />
                </View>
                <Svg width={300} height={130} viewBox="0 0 300 130" style={styles.flowConnectorsTop}>
                  <Path d="M 75,8 L 75,55 Q 75,65 85,65 L 140,65 Q 150,65 150,75 L 150,122" stroke="#232c36" strokeWidth={2} fill="none" />
                  <Path d="M 225,8 L 225,55 Q 225,65 215,65 L 160,65 Q 150,65 150,75 L 150,122" stroke="#232c36" strokeWidth={2} fill="none" />
                  <AnimatedPath d="M 75,8 L 75,55 Q 75,65 85,65 L 140,65 Q 150,65 150,75 L 150,122" stroke={COLORS.green} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,10" strokeDashoffset={flowDashOffset} fill="none" opacity={acTopActive ? 1 : 0} />
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
                  {status.eta_text ? (
                    <Text style={[styles.pctEta, { color: status.eta_ok ? COLORS.green : COLORS.red }]}>
                      {status.eta_text}
                    </Text>
                  ) : null}
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
                  <Path d="M 150,8 L 150,55 Q 150,65 140,65 L 85,65 Q 75,65 75,75 L 75,122" stroke="#232c36" strokeWidth={2} fill="none" />
                  <Path d="M 150,8 L 150,55 Q 150,65 160,65 L 215,65 Q 225,65 225,75 L 225,122" stroke="#232c36" strokeWidth={2} fill="none" />
                  <AnimatedPath d="M 150,8 L 150,55 Q 150,65 140,65 L 85,65 Q 75,65 75,75 L 75,122" stroke={COLORS.red} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,10" strokeDashoffset={flowDashOffset} fill="none" opacity={acOutActive ? 1 : 0} />
                  <AnimatedPath d="M 150,8 L 150,55 Q 150,65 160,65 L 215,65 Q 225,65 225,75 L 225,122" stroke={COLORS.red} strokeWidth={2} strokeLinecap="round" strokeDasharray="6,10" strokeDashoffset={flowDashOffset} fill="none" opacity={usbActive ? 1 : 0} />
                </Svg>
                <View style={styles.iconsRowBottom}>
                  <IconCircle emoji="🏠" state={acOutActive ? 'discharging' : 'neutral'} watts={`${status.ac_out_w ?? 0} W`} name="CA" />
                  <IconCircle icon={<UsbIcon color={COLORS.dim} />} state={usbActive ? 'discharging' : 'neutral'} watts={`${status.usb_out_w ?? 0} W`} name="USB" />
                </View>
              </View>

    </>
  ) : null;

  // ETA box: antes mostraba "Llena a las" + (alerta de batería baja O
  // última vez que llegó AC) + Meta. Las tres se mudaron al diagrama
  // principal ("Llena a las" y la alerta de batería baja bajo Tiempo
  // restante en el aro, "última vez que llegó AC" al nodo AC) a pedido del
  // usuario, para no repetir el mismo dato en dos lugares de la misma
  // pantalla. Acá solo queda la Meta.
  const etaBoxSection = status && status.ready && status.goal_label ? (
    <View style={styles.etaBox}>
      <Text style={[styles.etaGoal, { color: status.goal_met ? COLORS.green : COLORS.red }]}>
        {status.goal_met ? '✅' : '⚠️'} Meta: {status.goal_floor}% para {status.goal_label} (proyectás {status.goal_projected?.toFixed(0)}%)
      </Text>
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
          {notReadyCard}
          {centerFlow}
          {updatedRowSection}
          {etaBoxSection}
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
  emojiWrap: { marginTop: 2 },
  sourceEmojiRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  flowTopWrap: { width: 300, maxWidth: '100%', alignSelf: 'center', paddingBottom: 122 },
  iconsRowTop: { width: 300, maxWidth: 300, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-around' },
  flowConnectorsTop: { position: 'absolute', left: 0, bottom: 0 },
  flowBottomWrap: { width: 300, maxWidth: '100%', alignSelf: 'center', paddingTop: 122 },
  flowConnectors: { position: 'absolute', top: 0, left: 0 },
  iconsRowBottom: { width: 300, maxWidth: 300, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-around' },

  ringWrap: { width: 240, height: 240, marginTop: 6, marginBottom: 0, alignItems: 'center', justifyContent: 'center' },
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

  pct: { fontSize: 48, fontWeight: '700', color: COLORS.text, fontVariant: ['tabular-nums'] },
  pctSubLabel: { fontSize: 13, color: COLORS.dim, marginTop: 8 },
  pctSubDur: { fontSize: 22, color: '#e5e7eb', fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  pctEta: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  pctThreshold: { fontSize: 12, fontWeight: '600', marginTop: 3, color: COLORS.red },

  etaBox: {
    marginTop: 4, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 16, backgroundColor: COLORS.card,
    alignItems: 'center', maxWidth: 340, width: '100%',
  },
  etaGoal: {
    fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'], textAlign: 'center',
  },

  updatedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  liveDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  updatedText: { fontSize: 12, color: '#7b8794' },
});
