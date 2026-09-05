import { Animated, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../theme';

// react-native-svg no trae Animated.createAnimatedComponent aplicado a Path
// por defecto; se arma acá porque no hay reanimated como dependencia (ver
// package.json) — se anima strokeDashoffset con la Animated API nativa de RN.
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Conector "hook" lateral: sale del anillo (borde derecho o izquierdo, punto
// medio vertical), va horizontal y dobla 90° con esquina redondeada — exacto
// mismo `d` que .lateral-overlay/.lateral-overlay-left en
// ecoflow_telegram_monitor.py (izquierda = mismas coordenadas en x negativo).
// KEEP IN SYNC WITH ecoflow_telegram_monitor.py .flow-connectors.lateral.
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

const styles = StyleSheet.create({
  lateralSvg: { overflow: 'visible' },
  // Con viewBox "-64 0 64 40" el contenido (x entre -62 y 0) queda pegado
  // al borde DERECHO de la caja renderizada del Svg — sin mover la caja,
  // el gancho se vería 64px más a la derecha de lo que corresponde. Se
  // corre la caja misma 64px a la izquierda para compensar.
  lateralSvgLeft: { marginLeft: -64 },
});
