import Svg, { Circle } from 'react-native-svg';
import { COLORS } from '../../theme';

// Anillo circular por porcentaje — equivalente RN del conic-gradient del CSS web.
export function PercentRing({ pct, color, size = 240 }: { pct: number; color: string; size?: number }) {
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
