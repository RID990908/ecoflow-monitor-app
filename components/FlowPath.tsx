import { Animated } from 'react-native';
import { Path } from 'react-native-svg';
import { COLORS } from '../theme';

// react-native-svg no trae Animated.createAnimatedComponent aplicado a Path
// por defecto; se arma acá porque no hay reanimated como dependencia — se
// anima strokeDashoffset con la Animated API de RN.
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Línea conectora del diagrama: pista tenue siempre visible + (si está
// activa) un halo suave y el trazo animado que viaja por el path. El halo
// es un segundo trazo más ancho y translúcido, porque los filtros SVG
// (drop-shadow) no existen en react-native-svg nativo.
export function FlowPath({
  d,
  color,
  active,
  dashOffset,
  dash = '6,10',
  width = 2.5,
  trackWidth = 2,
}: {
  d: string;
  color: string;
  active: boolean;
  dashOffset: Animated.AnimatedInterpolation<string | number>;
  dash?: string;
  width?: number;
  trackWidth?: number;
}) {
  return (
    <>
      <Path d={d} stroke={COLORS.track} strokeWidth={trackWidth} strokeLinecap="round" fill="none" />
      {active ? <Path d={d} stroke={color} strokeWidth={width + 5} strokeLinecap="round" fill="none" opacity={0.16} /> : null}
      <AnimatedPath
        d={d}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dash}
        strokeDashoffset={dashOffset}
        fill="none"
        opacity={active ? 1 : 0}
      />
    </>
  );
}
