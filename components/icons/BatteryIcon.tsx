import { Fragment } from 'react';
import Svg, { Rect } from 'react-native-svg';
import type { FlowState } from '../../types';
import { flowColor } from '../../theme';

// Vertical glass-style cell. Each of its four separated compartments is 25%.
export function BatteryIcon({
  state,
  pct,
  size = 17,
}: {
  state: FlowState;
  pct?: number | null;
  size?: number;
}) {
  const color = flowColor(state);
  const level = pct == null || !Number.isFinite(pct) ? null : Math.min(100, Math.max(0, pct));
  const segmentFill = (segment: number) =>
    level == null ? 0 : Math.min(1, Math.max(0, (level - segment * 25) / 25));

  return (
    <Svg width={size} height={size * (28 / 18)} viewBox="0 0 18 28">
      <Rect x={6.5} y={1} width={5} height={2.5} rx={1} fill={color} opacity={0.85} />
      <Rect x={2} y={3.5} width={14} height={23} rx={4} fill="none" stroke={color} strokeWidth={1.5} />
      {[0, 1, 2, 3].map((segment) => {
        const y = 20.3 - segment * 5.2;
        const width = 10 * segmentFill(segment);
        return (
          <Fragment key={segment}>
            <Rect x={4} y={y} width={10} height={4.2} rx={1.2} fill={color} opacity={0.16} />
            {width > 0 ? <Rect x={4} y={y} width={width} height={4.2} rx={1.2} fill={color} /> : null}
          </Fragment>
        );
      })}
    </Svg>
  );
}
