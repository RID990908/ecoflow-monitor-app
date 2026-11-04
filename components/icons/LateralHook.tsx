import { Animated, StyleSheet } from 'react-native';
import Svg from 'react-native-svg';
import { COLORS } from '../../theme';
import { FlowPath } from '../FlowPath';

// Conector "hook" lateral: sale del anillo (borde derecho o izquierdo, punto
// medio vertical), va horizontal y dobla 90° con esquina redondeada hacia el
// nodo. Carga = el flujo viaja anillo -> nodo; descarga = nodo -> anillo
// (path invertido). KEEP IN SYNC WITH ecoflow_telegram_monitor.py
// .flow-connectors.lateral.
const REACH = 44; // tramo horizontal desde el borde del anillo
const DROP = 34; // tramo vertical hasta el nodo (queda tapado por su círculo)
const PAD = 8;
const W = 64 + PAD * 2;
const H = 44 + PAD * 2;

export function LateralHook({
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
  // izquierda del anillo): el viewBox y la posición del propio Svg coinciden
  // con el rango de coordenadas que cada lado realmente usa, sin depender de
  // overflow (que en nativo no es confiable).
  const sx = side === 'right' ? 1 : -1;
  const out = `M 0,0 L ${sx * REACH},0 Q ${sx * (REACH + 8)},0 ${sx * (REACH + 8)},8 L ${sx * (REACH + 8)},${DROP}`;
  const back = `M ${sx * (REACH + 8)},${DROP} L ${sx * (REACH + 8)},8 Q ${sx * (REACH + 8)},0 ${sx * REACH},0 L 0,0`;
  const active = charging || discharging;
  const color = discharging ? COLORS.red : COLORS.green;
  // PAD of empty room on every side: native SVG clips anything outside its box,
  // and the horizontal run sits at y=0, so without it the top half of the
  // stroke and halo were cut off.
  const viewBox = side === 'right' ? `${-PAD} ${-PAD} ${W} ${H}` : `${-64 - PAD} ${-PAD} ${W} ${H}`;
  const svgStyle = side === 'right' ? styles.lateralSvg : [styles.lateralSvg, styles.lateralSvgLeft];
  return (
    <Svg width={W} height={H} viewBox={viewBox} style={svgStyle}>
      <FlowPath d={discharging ? back : out} color={color} active={active} dashOffset={dashOffset} dash="6,8" width={2.5} trackWidth={3} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  lateralSvg: { overflow: 'visible', marginLeft: -PAD, marginTop: -PAD },
  // Con viewBox "-64 0 64 44" el contenido (x entre -60 y 0) queda pegado
  // al borde DERECHO de la caja renderizada del Svg — sin mover la caja,
  // el gancho se vería 64px más a la derecha de lo que corresponde. Se
  // corre la caja misma 64px a la izquierda para compensar.
  lateralSvgLeft: { marginLeft: -64 - PAD },
});
