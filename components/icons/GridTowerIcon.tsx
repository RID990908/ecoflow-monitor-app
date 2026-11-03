import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

// Red (street grid) node icon from the 04 artboard (#nRed): steel lattice
// tower, cyan insulators and a yellow badge with a dark bolt. Fixed palette
// (no currentColor), same as TowerIcon.
export function GridTowerIcon({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="gridSteel" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#d3dde5" />
          <Stop offset="1" stopColor="#7f93a4" />
        </LinearGradient>
      </Defs>
      <G fill="none" stroke="url(#gridSteel)" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M10.5 2 5 21M10.5 2 16 21" strokeWidth={1.7} />
        <Path d="M8.6 10h3.8M7 15.5h7" strokeWidth={1.2} />
        <Path d="M8.6 10l5.4 5.5M12.4 10 7 15.5" strokeWidth={1} />
        <Path d="M3.6 6.2h13.8M2.6 10.6h15.8" strokeWidth={1.5} />
      </G>
      <G fill="#7ee3f2">
        <Circle cx={3.6} cy={8} r={0.9} />
        <Circle cx={17.4} cy={8} r={0.9} />
      </G>
      <Circle cx={18.6} cy={18.4} r={5} fill="#eab308" />
      <Path d="M19.6 14.6 16.6 19h2l-.8 3.4 3.2-4.6h-2z" fill="#1b1405" />
    </Svg>
  );
}
