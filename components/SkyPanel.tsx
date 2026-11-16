import { memo, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { computeSky, litPath, rnd, type CondKind, type Sky } from '../lib/sky';

// Weather/sun panel below the diagram (design/sky-background/23-ventana-abajo-vivo.html).
// Layers live in a 390x150 "stage" centered in the card, same coordinates as the artboard
// (the card shows stage y 32..132). Gradients only, no filters/blur: light on low-end Android.
const STAGE_W = 390;
const STAGE_H = 150;
// Give the arc room to breathe: the original 100px card clipped the sky scene.
const STAGE_TOP = -12;
const CARD_H = 116;
const TILE = 40; // rain tile height (vertical period)
const USE_NATIVE = Platform.OS !== 'web';

const CLOUD_SPOTS: [number, number, number][] = [
  [60, 88, 0.7],
  [250, 72, 0.8],
  [140, 102, 0.6],
  [330, 98, 0.6],
  [195, 86, 0.9],
  [30, 106, 0.55],
];
const CLOUD_PARTS = [
  [0, 0, 40, 14],
  [-22, -8, 20, 12],
  [14, -12, 26, 14],
  [34, -3, 18, 10],
];
const FOG_BLOBS: [number, number, number, number][] = [
  [90, 70, 150, 16],
  [290, 92, 170, 18],
  [190, 112, 200, 20],
];

const STARS = (() => {
  const r = rnd(11);
  return Array.from({ length: 36 }, () => ({
    cx: Math.round(r() * 388),
    cy: Math.round(34 + r() * 78),
    r: +(r() * 1.1 + 0.4).toFixed(1),
    o: +(r() * 0.5 + 0.4).toFixed(2),
  }));
})();

const stageStyle = {
  position: 'absolute' as const,
  top: STAGE_TOP,
  left: '50%' as const,
  marginLeft: -STAGE_W / 2,
  width: STAGE_W,
  height: STAGE_H,
};

const Stars = memo(function Stars() {
  return (
    <G>
      {STARS.map((s, i) => (
        <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#fff" opacity={s.o} />
      ))}
    </G>
  );
});

const Cloud = memo(function Cloud({
  i,
  fill,
  opacity,
  drift,
}: {
  i: number;
  fill: string;
  opacity: number;
  drift: Animated.Value;
}) {
  const [x, y, s] = CLOUD_SPOTS[i];
  const tx = drift.interpolate({ inputRange: [0, 1], outputRange: [-12, 14] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 44 * s,
        top: y - 24 * s,
        opacity,
        transform: [{ translateX: tx }],
      }}
    >
      <Svg width={100 * s} height={40 * s} viewBox="-44 -24 100 40">
        {CLOUD_PARTS.map((e, k) => (
          <Ellipse key={k} cx={e[0]} cy={e[1]} rx={e[2]} ry={e[3]} fill={fill} />
        ))}
      </Svg>
    </Animated.View>
  );
});

function rainPath(count: number) {
  const r = rnd(5);
  const per = Math.max(1, Math.round((count / 90) * 26));
  let d = '';
  for (let i = 0; i < per; i++) {
    const x = Math.round(r() * 400 - 5);
    const y = r() * TILE;
    for (let yy = y; yy < CARD_H + TILE; yy += TILE) d += `M${x} ${yy.toFixed(0)}l-4 14`;
  }
  return d;
}

function ChipIcon({ kind, cc, night }: { kind: CondKind; cc: number; night: boolean }) {
  const sun = (
    <>
      <Circle cx={12} cy={12} r={5} fill="#fbbf24" />
      <Path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
        stroke="#fbbf24"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </>
  );
  const moon = <Path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" fill="#dfe7ff" />;
  const cloudD = 'M7 19a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 9.5 4.5 4.5 0 0 1 17 19z';
  const cloud = <Path d={cloudD} fill="#cbd5e1" />;
  const wet = kind === 'rain' || kind === 'storm';
  let icon;
  if (kind === 'storm')
    icon = (
      <>
        {cloud}
        <Path d="M12 12l-3 5h3l-1 4 4-6h-3z" fill="#fbbf24" />
      </>
    );
  else if (wet)
    icon = (
      <>
        {cloud}
        <Path d="M9 22l1-2M13 22l1-2M17 22l1-2" stroke="#7dd3fc" strokeWidth={2} strokeLinecap="round" />
      </>
    );
  else if (kind === 'fog')
    icon = <Path d="M4 9h16M6 13h14M4 17h12" stroke="#cbd5e1" strokeWidth={2} strokeLinecap="round" />;
  else if (cc >= 0.6) icon = cloud;
  else if (cc >= 0.25)
    icon = (
      <>
        {night ? moon : sun}
        <G transform="translate(3 4) scale(.8)">{cloud}</G>
      </>
    );
  else icon = night ? moon : sun;
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      {icon}
    </Svg>
  );
}

export function SkyPanel({ sky, now }: { sky: Sky | null | undefined; now: number }) {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const drift = useMemo(() => CLOUD_SPOTS.map((_, i) => new Animated.Value(i / 6)), []);
  const haze = useMemo(() => FOG_BLOBS.map((_, i) => new Animated.Value(0.3 + i * 0.3)), []);
  const rainY = useMemo(() => new Animated.Value(0), []);
  const flash = useMemo(() => new Animated.Value(0), []);

  const v = sky ? computeSky(sky, now) : null;
  const n = v?.cloudCount ?? 0;
  const kind = v?.kind ?? 'none';
  const rainOn = (v?.rainCount ?? 0) > 0;
  const rainCount = v?.rainCount ?? 0;
  const fogOn = kind === 'fog';
  const storm = kind === 'storm';
  const rainDur = Math.round(1100 - (Math.min(90, rainCount) / 90) * 500);

  // Clouds drift: translateX loop alternate, 11-24 s each.
  useEffect(() => {
    if (reduce) {
      drift.forEach((d) => d.setValue(0.5));
      return;
    }
    const anims = drift.slice(0, n).map((d, i) => {
      const dur = 11000 + i * 2400;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(d, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE }),
          Animated.timing(d, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE }),
        ]),
      );
      loop.start();
      return loop;
    });
    return () => anims.forEach((a) => a.stop());
  }, [reduce, n, drift]);

  // Rain: tile of streaks falls one period and restarts seamlessly.
  useEffect(() => {
    rainY.setValue(0);
    if (reduce || !rainOn) return;
    const loop = Animated.loop(
      Animated.timing(rainY, { toValue: 1, duration: rainDur, easing: Easing.linear, useNativeDriver: USE_NATIVE }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, rainOn, rainDur, rainY]);

  // Fog haze drift.
  useEffect(() => {
    if (reduce || !fogOn) return;
    const anims = haze.map((h, i) => {
      const dur = 14000 + i * 4000;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(h, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE }),
          Animated.timing(h, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE }),
        ]),
      );
      loop.start();
      return loop;
    });
    return () => anims.forEach((a) => a.stop());
  }, [reduce, fogOn, haze]);

  // Storm flash: one soft cluster (3 pulses, max .2) every ~9 s. Never rapid.
  useEffect(() => {
    flash.setValue(0);
    if (reduce || !storm) return;
    const pulse = (peak: number, up: number, down: number) => [
      Animated.timing(flash, { toValue: peak, duration: up, useNativeDriver: USE_NATIVE }),
      Animated.timing(flash, { toValue: 0, duration: down, useNativeDriver: USE_NATIVE }),
    ];
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(7800),
        ...pulse(0.2, 160, 260),
        Animated.delay(180),
        ...pulse(0.12, 140, 240),
        Animated.delay(220),
        ...pulse(0.16, 160, 400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, storm, flash]);

  const rainD = useMemo(() => (rainOn ? rainPath(rainCount) : ''), [rainOn, rainCount]);

  if (!sky || !v) return null;

  const [bx, by] = v.xy;
  const rainTranslate = reduce
    ? 0
    : rainY.interpolate({ inputRange: [0, 1], outputRange: [0, TILE] });
  const hazeA = v.haze;

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Clima: ${v.name}`}
    >
      {/* Sky gradient + legibility overlay (full card width) */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={v.top} />
            <Stop offset="1" stopColor={v.bottom} />
          </LinearGradient>
          <LinearGradient id="skyO" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#080c14" stopOpacity={v.overlay * 0.5} />
            <Stop offset="1" stopColor="#080c14" stopOpacity={v.overlay * 0.18} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#skyG)" />
        <Rect width="100%" height="100%" fill="url(#skyO)" />
      </Svg>

      {/* Scene: stars, arc, sun/moon */}
      <View style={stageStyle} pointerEvents="none">
        <Svg width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}>
          <Defs>
            <RadialGradient id="skyHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={v.sunHalo} stopOpacity={0.9} />
              <Stop offset="0.35" stopColor="#ffd27a" stopOpacity={0.35} />
              <Stop offset="1" stopColor="#ffd27a" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="skyMoonG" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#e8eeff" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#e8eeff" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <G opacity={v.starsOpacity}>
            <Stars />
          </G>
          <Path
            d="M65 120 A130 60 0 0 1 325 120"
            fill="none"
            stroke="#fff"
            strokeOpacity={0.35}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="0.1 8"
          />
          {v.elapsed && (
            <Path
              d={v.elapsed}
              fill="none"
              stroke={v.elapsedColor}
              strokeOpacity={0.8}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          )}
          {v.body === 'sun' ? (
            <G transform={`translate(${bx.toFixed(1)} ${by.toFixed(1)})`} opacity={v.bodyOpacity}>
              <Circle r={44} fill="url(#skyHalo)" />
              <Circle r={13} fill={v.sunCore} />
            </G>
          ) : (
            <G transform={`translate(${bx.toFixed(1)} ${by.toFixed(1)})`} opacity={v.bodyOpacity}>
              <Circle r={30} fill="url(#skyMoonG)" />
              <Circle r={12} fill="#fff" fillOpacity={0.08} />
              <Path d={litPath(v.moonPhase, 12)} fill="#f4efd0" />
            </G>
          )}
        </Svg>

        {/* Clouds */}
        {drift.slice(0, n).map((d, i) => (
          <Cloud key={i} i={i} fill={v.cloudFill} opacity={v.cloudOpacity} drift={d} />
        ))}

        {/* Rain */}
        {rainOn && (
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              top: 32 - TILE,
              width: STAGE_W,
              height: CARD_H + TILE,
              opacity: v.rainOpacity,
              transform: [{ translateY: rainTranslate }],
            }}
          >
            <Svg width={STAGE_W} height={CARD_H + TILE}>
              <Path d={rainD} stroke="#cfe3ff" strokeWidth={1.2} strokeLinecap="round" fill="none" />
            </Svg>
          </Animated.View>
        )}

        {/* Fog */}
        {fogOn && (
          <View style={[StyleSheet.absoluteFill, { opacity: v.fogOpacity }]}>
            <Svg width={STAGE_W} height={STAGE_H}>
              <Defs>
                <LinearGradient id="skyFog" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="300">
                  <Stop offset="0" stopColor={hazeA} stopOpacity={0.12} />
                  <Stop offset="0.66" stopColor={hazeA} stopOpacity={0.78} />
                  <Stop offset="1" stopColor={hazeA} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect width={STAGE_W} height={300} fill="url(#skyFog)" />
            </Svg>
            {FOG_BLOBS.map((b, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  left: b[0] - b[2],
                  top: b[1] - b[3],
                  transform: [
                    { translateX: haze[i].interpolate({ inputRange: [0, 1], outputRange: [-18, 18] }) },
                  ],
                }}
              >
                <Svg width={b[2] * 2} height={b[3] * 2}>
                  <Defs>
                    <RadialGradient id={`skyHz${i}`} cx="50%" cy="50%" r="50%">
                      <Stop offset="0" stopColor={hazeA} stopOpacity={0.55} />
                      <Stop offset="1" stopColor={hazeA} stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Ellipse cx={b[2]} cy={b[3]} rx={b[2]} ry={b[3]} fill={`url(#skyHz${i})`} />
                </Svg>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Storm flash */}
        {storm && (
          <>
            <Animated.View
              style={[StyleSheet.absoluteFill, { backgroundColor: '#cfd9ff', opacity: flash }]}
            />
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { opacity: flash.interpolate({ inputRange: [0, 0.2], outputRange: [0, 0.5] }) },
              ]}
            >
              <Svg width={STAGE_W} height={STAGE_H}>
                <Path
                  d="M262 0 L238 78 L258 80 L228 168"
                  fill="none"
                  stroke="#fff"
                  strokeWidth={2.6}
                  strokeLinejoin="round"
                />
              </Svg>
            </Animated.View>
          </>
        )}
      </View>

      {/* Low ridges */}
      <Svg
        style={{ position: 'absolute', left: 0, right: 0, top: 60 }}
        width="100%"
        height={40}
        viewBox="0 0 390 40"
        preserveAspectRatio="none"
      >
        <Path fill={v.ridge1} d="M0 18 Q70 6 140 14 T270 10 T390 6 V40 H0Z" />
        <Path fill={v.ridge2} d="M0 30 Q90 22 190 28 T390 24 V40 H0Z" />
      </Svg>

      {/* Weather chip: icon + name only */}
      <View style={styles.chipWrap} pointerEvents="none">
        <View style={styles.chip}>
          <ChipIcon kind={v.kind} cc={v.cc} night={v.night} />
          <Text style={styles.chipText}>{v.name}</Text>
        </View>
      </View>

      <View style={styles.border} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 380,
    height: CARD_H,
    borderRadius: 26,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  border: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chipWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10,15,24,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 11,
  },
  chipText: { fontSize: 11, fontWeight: '600', color: '#e6edf3' },
});
