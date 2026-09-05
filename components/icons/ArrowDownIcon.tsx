import Svg, { Path } from 'react-native-svg';

export function ArrowDownIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        d="M12 3v10m0 0l-4-4m4 4l4-4M4 19h16"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
