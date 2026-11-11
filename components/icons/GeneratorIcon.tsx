import Svg, { Circle, Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';

// Planta (gas plant) node icon from the 04 artboard (#nGas): wheeled solid
// generator. The body is steel; the two dials, the bolt and the wheel/badge
// gaps are cut out with a Mask. Orange badge with a dark flame bottom-left.
const BODY_TRANSFORM = 'translate(1.6 -1.4) scale(.86)';

export function GeneratorIcon({ size = 36, badge = '#fb923c' }: { size?: number; badge?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="genSteel" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#e4ecf2" />
          <Stop offset="1" stopColor="#8ea2b3" />
        </LinearGradient>
        <Mask id="genMask" maskUnits="userSpaceOnUse" x={0} y={0} width={24} height={24}>
          <Rect width={24} height={24} fill="#fff" />
          <G fill="#000">
            <G transform={BODY_TRANSFORM}>
              <Rect x={4.6} y={10.1} width={6.2} height={2} rx={1} />
              <Circle cx={14.4} cy={11.1} r={1.2} />
              <Circle cx={18.1} cy={11.1} r={1.2} />
              <Path d="M13.54 12.40 L9.21 16.10 L12.10 16.10 L11.03 19.00 L15.74 14.91 L12.70 14.91z" />
            </G>
            <Circle cx={16.6} cy={16.4} r={3.8} />
            <Circle cx={5.2} cy={17.8} r={4.9} />
          </G>
        </Mask>
      </Defs>
      <G mask="url(#genMask)" fill="url(#genSteel)">
        <G transform={BODY_TRANSFORM}>
          <Path d="M5.5 8h13A3 3 0 0 1 21.5 11v5.5a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3V11A3 3 0 0 1 5.5 8z" />
          <Path d="M7.8 8V6a1.6 1.6 0 0 1 1.6-1.6h5.2A1.6 1.6 0 0 1 16.2 6v2h-2V6.4H9.8V8z" />
          <Rect x={17.6} y={5.2} width={2.6} height={2.4} rx={0.7} />
        </G>
      </G>
      <Circle cx={16.6} cy={16.4} r={2.8} fill="url(#genSteel)" />
      <Circle cx={16.6} cy={16.4} r={1} fill="#0c1117" />
      <Circle cx={5.2} cy={17.8} r={4.1} fill={badge} />
      <Path
        d="M12 2c1 3.5 5 5.5 5 10.2A5 5 0 0 1 12 17.5a5 5 0 0 1-5-5.3c0-2 1-3.4 2.2-4.6.3 1.6 1 2.4 1.8 2.8C11 8 11.2 4.6 12 2z"
        fill="#2b1203"
        transform="translate(5.2 18.3) scale(.3) translate(-12 -9.75)"
      />
    </Svg>
  );
}
