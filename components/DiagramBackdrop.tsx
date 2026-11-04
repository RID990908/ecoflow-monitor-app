import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { COLORS } from '../theme';

// Aurora backdrop for the power-flow card: green glow behind the inputs (top)
// and red glow behind the outputs (bottom). Gradients only, no blur, so it is
// cheap on low-end Android. Sits behind the diagram (pointerEvents none).
export function DiagramBackdrop() {
  return (
    <Svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
      <Defs>
        <RadialGradient id="auroraTop" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={COLORS.green} stopOpacity={0.2} />
          <Stop offset="1" stopColor={COLORS.green} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="auroraBottom" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={COLORS.red} stopOpacity={0.16} />
          <Stop offset="1" stopColor={COLORS.red} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={COLORS.card} />
      <Ellipse cx="50%" cy="0%" rx="80%" ry="26%" fill="url(#auroraTop)" />
      <Ellipse cx="50%" cy="100%" rx="80%" ry="26%" fill="url(#auroraBottom)" />
    </Svg>
  );
}
