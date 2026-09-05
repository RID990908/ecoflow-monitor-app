import Svg, { Circle, Path } from 'react-native-svg';
import { COLORS } from '../../theme';

// Ventilador de mesa: aro exterior + 3 aspas tipo paisley (gota curva,
// gruesa y redondeada) + hub con punto central — mismo patrón de forma
// repetida + rotation/origin que ya usa PercentRing para el aro. Las
// cápsulas rectas con aro alrededor se leían como los rayos de un timón de
// auto; una gota curva y llena (más ancha que el primer intento, que era
// una curva fina asimétrica) se lee mejor como aspa real. Sin base: a este
// tamaño (15-16px) el pie no se leería, así que se deja solo la cabeza (aro
// + aspas), que es lo reconocible.
export function FanIcon({ color = '#e5e7eb', size = 15 }: { color?: string; size?: number }) {
  const blade = 'M12,12 Q4,9 7,3 Q9,0 12,2 Q13,5 12,12 Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10.5} stroke={color} strokeWidth={1.6} fill="none" />
      <Path d={blade} fill={color} />
      <Path d={blade} fill={color} rotation={120} origin="12,12" />
      <Path d={blade} fill={color} rotation={240} origin="12,12" />
      <Circle cx={12} cy={12} r={2.3} fill={COLORS.bg} stroke={color} strokeWidth={1.4} />
      <Circle cx={12} cy={12} r={0.8} fill={color} />
    </Svg>
  );
}
