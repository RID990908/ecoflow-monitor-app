import { useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { COLORS } from '../theme';
import { sphereFill, type SphereState } from '../lib/sphere';

export type { SphereState };

function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
}

function wavePath(size: number, amp: number, height: number) {
  const half = size / 2;
  return (
    `M0,${amp} Q${size / 4},${-amp} ${half},${amp} T${size},${amp} ` +
    `T${size * 1.5},${amp} T${size * 2},${amp} L${size * 2},${height} L0,${height} Z`
  );
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

function Wave({
  size, amp, gradId, stops, x, opacity,
}: {
  size: number; amp: number; gradId: string; stops: { offset: number; color: string }[];
  x: Animated.Value; opacity: number;
}) {
  const h = size + amp * 2;
  return (
    <Animated.View
      style={{ position: 'absolute', left: 0, top: 0, width: size * 2, height: h, opacity, transform: [{ translateX: x }] }}
    >
      <Svg width={size * 2} height={h}>
        <Defs>
          <LinearGradient
            id={gradId}
            x1="0"
            y1="0"
            x2="0"
            y2={h}
            gradientUnits="userSpaceOnUse"
          >
            {stops.map((s, i) => (
              <Stop key={i} offset={`${s.offset * 100}%`} stopColor={s.color} />
            ))}
          </LinearGradient>
        </Defs>
        <Path
          d={wavePath(size, amp, h)}
          fill={`url(#${gradId})`}
          stroke={stops[0]?.color}
          strokeOpacity={0.3}
          strokeWidth={1.5}
        />
      </Svg>
    </Animated.View>
  );
}

// Liquid battery sphere. Square `size` x `size`, absolutely positioned (the
// parent centres it); only draws the sphere, text goes on top.
export function LiquidSphere({
  pct,
  state,
  targetPct = null,
  size = 224,
}: {
  pct: number;
  state: SphereState;
  targetPct?: number | null;
  size?: number;
}) {
  const level = Math.min(Math.max(Number.isFinite(pct) ? pct : 0, 0), 100);
  const amp = size * 0.025;
  const { stops, glow } = sphereFill(state, level, targetPct);
  const rgb = hexRgb(glow);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const native = Platform.OS !== 'web';
  const reduce = useReduceMotion();

  const levelAnim = useRef(new Animated.Value(level)).current;
  const front = useRef(new Animated.Value(0)).current;
  const back = useRef(new Animated.Value(-size / 2)).current;

  useEffect(() => {
    if (reduce) {
      levelAnim.setValue(level);
      return;
    }
    const a = Animated.timing(levelAnim, {
      toValue: level, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: native,
    });
    a.start();
    return () => a.stop();
  }, [level, reduce, levelAnim, native]);

  useEffect(() => {
    if (reduce) {
      front.setValue(0);
      back.setValue(-size / 2);
      return;
    }
    const loop = (v: Animated.Value, from: number, to: number, ms: number) => {
      v.setValue(from);
      const l = Animated.loop(
        Animated.timing(v, { toValue: to, duration: ms, easing: Easing.linear, useNativeDriver: native }),
      );
      l.start();
      return l;
    };
    const f = loop(front, 0, -size, 6000);
    const b = loop(back, -size, 0, 9000); // opposite direction/phase
    return () => {
      f.stop();
      b.stop();
    };
  }, [reduce, size, front, back, native]);

  const translateY = levelAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [size, -amp * 2],
  });

  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Batería al ${Math.round(level)}%`}
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS.disc,
        },
        Platform.OS === 'web'
          ? ({ boxShadow: `0 0 28px rgba(${rgb},0.22)` } as object)
          : { shadowColor: glow, shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
      ]}
    >
      <View
        style={{
          ...StyleSheet.absoluteFill,
          borderRadius: size / 2,
          overflow: 'hidden',
        }}
      >
        <View
          style={{ ...StyleSheet.absoluteFill, backgroundColor: `rgba(${rgb},0.14)` }}
        />
        <Animated.View
          style={{ position: 'absolute', left: 0, top: 0, width: size, height: size + amp * 2, transform: [{ translateY }] }}
        >
          <Wave size={size} amp={amp} gradId={`lsb${uid}`} stops={stops} x={back} opacity={0.38} />
          <Wave size={size} amp={amp} gradId={`lsf${uid}`} stops={stops} x={front} opacity={1} />
        </Animated.View>
      </View>
      <View
        style={{
          ...StyleSheet.absoluteFill,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      />
    </View>
  );
}
