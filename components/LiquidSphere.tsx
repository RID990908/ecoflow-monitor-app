import { useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { COLORS } from '../theme';
import { sphereFill } from '../lib/sphere';


// Ring between the outer border and the glass disc (design: 02-cristal-con-volumen).
const BORDER = 2;
const RIM_BG = '#0b1118';
const RIM_BORDER = '#2a3646';

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

// Glass over the liquid: light from the upper left, darker edge, soft glow at the
// bottom, a glossy reflection and a thin rim. Static (no animation), whole disc.
function GlassOverlay({
  d, light, uid,
}: { d: number; light: string; uid: string }) {
  const c = d / 2;
  const hx = d * 0.357;
  const hy = d * 0.259;
  const hrx = d * 0.241;
  const hry = d * 0.098;
  const id = (name: string) => `ls${name}${uid}`;
  return (
    <Svg width={d} height={d} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id={id('Light')} cx="38%" cy="28%" r="72%">
          <Stop offset="0%" stopColor={light} stopOpacity={0.4} />
          <Stop offset="45%" stopColor={light} stopOpacity={0.1} />
          <Stop offset="100%" stopColor={light} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={id('Edge')} cx="50%" cy="46%" r="56%">
          <Stop offset="0%" stopColor="#000" stopOpacity={0} />
          <Stop offset="58%" stopColor="#000" stopOpacity={0} />
          <Stop offset="100%" stopColor="#000" stopOpacity={0.5} />
        </RadialGradient>
        <RadialGradient id={id('Bottom')} cx="50%" cy="100%" r="62%">
          <Stop offset="0%" stopColor={light} stopOpacity={0.38} />
          <Stop offset="100%" stopColor={light} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient
          id={id('Gloss')}
          x1="0"
          y1={hy - hry}
          x2="0"
          y2={hy + hry}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0%" stopColor="#fff" stopOpacity={0.4} />
          <Stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Circle cx={c} cy={c} r={c} fill={`url(#${id('Light')})`} />
      <Circle cx={c} cy={c} r={c} fill={`url(#${id('Edge')})`} />
      <Circle cx={c} cy={c} r={c} fill={`url(#${id('Bottom')})`} />
      <Ellipse
        cx={hx}
        cy={hy}
        rx={hrx}
        ry={hry}
        fill={`url(#${id('Gloss')})`}
        transform={`rotate(-26 ${hx} ${hy})`}
      />
      <Circle cx={c} cy={c} r={c - 0.5} fill="none" stroke="#fff" strokeOpacity={0.2} strokeWidth={1} />
    </Svg>
  );
}

// Liquid battery sphere. Square `size` x `size`, absolutely positioned (the
// parent centres it); only draws the sphere, text goes on top.
export function LiquidSphere({
  pct,
  size = 224,
}: {
  pct: number;
  size?: number;
}) {
  const level = Math.min(Math.max(Number.isFinite(pct) ? pct : 0, 0), 100);
  const inset = Math.round(size * 0.027);
  const d = size - BORDER * 2 - inset * 2; // diameter of the glass disc
  const amp = d * 0.025;
  const { stops, glow, light } = sphereFill(level);
  const rgb = hexRgb(glow);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const native = Platform.OS !== 'web';
  const reduce = useReduceMotion();

  const levelAnim = useRef(new Animated.Value(level)).current;
  const front = useRef(new Animated.Value(0)).current;
  const back = useRef(new Animated.Value(-d / 2)).current;

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
      back.setValue(-d / 2);
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
    const f = loop(front, 0, -d, 6000);
    const b = loop(back, -d, 0, 9000); // opposite direction/phase
    return () => {
      f.stop();
      b.stop();
    };
  }, [reduce, d, front, back, native]);

  const translateY = levelAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [d, -amp * 2],
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
          backgroundColor: RIM_BG,
          borderWidth: BORDER,
          borderColor: RIM_BORDER,
        },
        Platform.OS === 'web'
          ? ({ boxShadow: `0 0 24px rgba(${rgb},0.3)` } as object)
          : { shadowColor: glow, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
      ]}
    >
      <View
        style={{
          position: 'absolute',
          left: inset,
          top: inset,
          width: d,
          height: d,
          borderRadius: d / 2,
          overflow: 'hidden',
          backgroundColor: COLORS.disc,
        }}
      >
        <Animated.View
          style={{ position: 'absolute', left: 0, top: 0, width: d, height: d + amp * 2, transform: [{ translateY }] }}
        >
          <Wave size={d} amp={amp} gradId={`lsb${uid}`} stops={stops} x={back} opacity={0.38} />
          <Wave size={d} amp={amp} gradId={`lsf${uid}`} stops={stops} x={front} opacity={1} />
        </Animated.View>
        <GlassOverlay d={d} light={light} uid={uid} />
      </View>
    </View>
  );
}
