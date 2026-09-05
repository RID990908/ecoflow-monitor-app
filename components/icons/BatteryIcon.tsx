import Svg, { Rect } from 'react-native-svg';
import type { FlowState } from '../../types';
import { flowColor } from '../../theme';

// Mismo shape que el ícono de batería del dashboard web (un rect + terminal + relleno).
export function BatteryIcon({ state, size = 15 }: { state: FlowState; size?: number }) {
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
