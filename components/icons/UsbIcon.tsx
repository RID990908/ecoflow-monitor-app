import Svg, { Rect } from 'react-native-svg';
import { COLORS } from '../../theme';

// Conector USB-C: cápsula gruesa + barrita central rellena, como el ícono
// de referencia del usuario (antes solo tenía el contorno, sin la barra).
export function UsbIcon({ color = COLORS.dim }: { color?: string }) {
  return (
    <Svg width={18} height={9} viewBox="0 0 24 12">
      <Rect x={1} y={1} width={22} height={10} rx={5} fill="none" stroke={color} strokeWidth={2} />
      <Rect x={7} y={4} width={10} height={4} rx={2} fill={color} />
    </Svg>
  );
}
