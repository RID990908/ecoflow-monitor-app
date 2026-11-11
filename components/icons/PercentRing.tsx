import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS } from '../../theme';

// Anillo circular por porcentaje — equivalente RN del conic-gradient del CSS web.
// El color del arco sale del umbral (rojo/amarillo/verde) y se dibuja con un
// halo translúcido debajo (los filtros SVG no existen en nativo) y un
// degradado del mismo tono, de más claro a más intenso.
function lighten(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.35);
  return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

// `ghostTo` draws a translucent amber segment from `pct` to that % on the
// track: where the battery will be when the plant stops.
export function PercentRing({
  pct,
  color,
  size = 224,
  ghostTo = null,
}: {
  pct: number;
  color: string;
  size?: number;
  ghostTo?: number | null;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * Math.min(Math.max(pct, 0), 100) / 100;
  const arc = {
    cx: c,
    cy: c,
    r,
    fill: 'none' as const,
    strokeDasharray: `${dash} ${circumference}`,
    strokeLinecap: 'round' as const,
    rotation: -90,
    origin: `${c}, ${c}`,
  };
  const from = Math.min(Math.max(pct, 0), 100);
  const ghostLen = ghostTo != null && ghostTo > from ? (circumference * (ghostTo - from)) / 100 : 0;
  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }}>
      <Defs>
        <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={lighten(color)} />
          <Stop offset="1" stopColor={color} />
        </LinearGradient>
      </Defs>
      <Circle cx={c} cy={c} r={r} stroke={COLORS.ringTrack} strokeWidth={stroke} fill="none" />
      {ghostLen > 0 ? (
        <Circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={COLORS.yellow}
          strokeWidth={stroke}
          opacity={0.45}
          strokeDasharray={`${ghostLen} ${circumference}`}
          rotation={-90 + from * 3.6}
          origin={`${c}, ${c}`}
        />
      ) : null}
      <Circle {...arc} stroke={color} strokeWidth={stroke + 8} opacity={0.14} />
      <Circle {...arc} stroke="url(#ringGrad)" strokeWidth={stroke} />
    </Svg>
  );
}
