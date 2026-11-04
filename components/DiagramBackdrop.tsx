import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { COLORS } from '../theme';

// Full-screen aurora backdrop (sits behind the whole app): green glow behind the inputs (top)
// and red glow behind the outputs (bottom). Gradients only, no blur, so it is
// cheap on low-end Android. A wrapper View pinned to all four edges gives the
// SVG the screen's exact box (width/height "100%" on the Svg alone left gaps on
// web); the viewBox is stretched to it with preserveAspectRatio="none".
export function DiagramBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="auroraTop" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={COLORS.green} stopOpacity={0.22} />
            <Stop offset="1" stopColor={COLORS.green} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="auroraBottom" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={COLORS.red} stopOpacity={0.18} />
            <Stop offset="1" stopColor={COLORS.red} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill={COLORS.bg} />
        <Ellipse cx={50} cy={0} rx={80} ry={26} fill="url(#auroraTop)" />
        <Ellipse cx={50} cy={100} rx={80} ry={26} fill="url(#auroraBottom)" />
      </Svg>
    </View>
  );
}
