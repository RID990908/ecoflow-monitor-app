import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

// USB-C node icon: front view of the port, a steel capsule with a dark
// opening and the cyan contact tongue. Fixed palette (no currentColor), same
// family as GridTowerIcon and GeneratorIcon.
export function UsbIcon({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="usbSteel" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#d3dde5" />
          <Stop offset="1" stopColor="#7f93a4" />
        </LinearGradient>
      </Defs>
      <Rect x={2} y={6.5} width={20} height={11} rx={5.5} fill="url(#usbSteel)" />
      <Rect x={4} y={8.5} width={16} height={7} rx={3.5} fill="#0c1117" />
      <Rect x={7} y={11} width={10} height={2} rx={1} fill="#7ee3f2" />
    </Svg>
  );
}
