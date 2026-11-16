// Pure sky maths for SkyPanel (port of design/sky-background/23-ventana-abajo-vivo.html).
// Everything derives from `now` (ms, device clock) and the backend `sky` payload;
// nothing here depends on the device timezone or on hardcoded times.

export type Sky = {
  cloud_pct: number;
  code: number;
  is_day: boolean;
  sunrise_ts: number; // epoch seconds
  sunset_ts: number; // epoch seconds
  updated_ts: number; // epoch seconds
};

type RGB = number[];

const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => v + (b[i] - v) * t);
export const rgb = (c: RGB) =>
  'rgb(' + c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(',') + ')';
const sm = (t: number) => {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Key = [number, string, string];

function keys(sr: number, ss: number): Key[] {
  const mid = (sr + ss) / 2;
  return [
    [0, '#030712', '#0a1030'],
    [sr - 1.9, '#0a1030', '#1c2150'],
    [sr - 0.9, '#2a2c66', '#c06a6a'],
    [sr, '#3b64a8', '#f6b26b'],
    [sr + 1.8, '#2f6db5', '#8cc2ee'],
    [mid, '#1f5fae', '#6fb4ea'],
    [ss - 2, '#2a62ab', '#9cc7ea'],
    [ss - 0.4, '#3b4a92', '#f59e5b'],
    [ss, '#4a3a7a', '#f2784b'],
    [ss + 1, '#1d1f4b', '#5a3a6e'],
    [ss + 2, '#070c22', '#121a3e'],
    [24, '#030712', '#0a1030'],
  ];
}

function skyAt(h: number, K: Key[]): [RGB, RGB] {
  let i = 0;
  while (i < K.length - 2 && h > K[i + 1][0]) i++;
  const a = K[i];
  const b = K[i + 1];
  const t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  return [mix(hex(a[1]), hex(b[1]), t), mix(hex(a[2]), hex(b[2]), t)];
}

const gray = (c: RGB, a: number, dk: number): RGB => {
  const L = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  return mix(c, [L + 8, L + 10, L + 14], a).map((v) => v * dk);
};

const daylight = (h: number, sr: number, ss: number) =>
  Math.min(sm((h - (sr - 1)) / 1.7), 1 - sm((h - (ss - 0.5)) / 2));

// Point on the higher arc, p in 0..1 (same ellipse as the artboard, viewBox 390 wide).
// The endpoints stay at the horizon while late-morning/noon positions rise higher.
export const pos = (p: number): [number, number] => [
  195 - 130 * Math.cos(Math.PI * p),
  120 - 60 * Math.sin(Math.PI * p),
];

// Fraction of the synodic month: 0 = new, .5 = full.
export function moonPhase(nowMs: number): number {
  const jd = nowMs / 86400000 + 2440587.5;
  const a = ((jd - 2451550.26) / 29.530588853) % 1;
  return a < 0 ? a + 1 : a;
}

// Lit part of the moon disc (radius r, centered at 0,0); waxing = lit on the right.
export function litPath(f: number, r: number): string {
  const c = Math.cos(2 * Math.PI * f);
  const rx = (r * Math.abs(c)).toFixed(2);
  const waxing = f < 0.5;
  const first = waxing
    ? `M0 ${-r} A${r} ${r} 0 0 1 0 ${r}`
    : `M0 ${-r} A${r} ${r} 0 0 0 0 ${r}`;
  const sw = waxing ? (c > 0 ? 0 : 1) : c > 0 ? 1 : 0;
  return `${first} A${rx} ${r} 0 0 ${sw} 0 ${-r} Z`;
}

// Elapsed part of the arc as a real partial elliptical arc (no pathLength needed).
export function elapsedPath(p: number): string | null {
  if (p < 0.005) return null;
  const [x, y] = pos(Math.min(p, 1));
  return `M65 120 A130 60 0 ${p > 0.5 ? 1 : 0} 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
}

export type CondKind = 'storm' | 'rain' | 'fog' | 'none';
export function cond(c: number): { k: CondKind; r: number; n: string | null } {
  if (c >= 95) return { k: 'storm', r: 90, n: 'Tormenta' };
  if (c >= 80) return { k: 'rain', r: c >= 82 ? 90 : 60, n: c >= 82 ? 'Chubascos fuertes' : 'Chubascos' };
  if (c >= 61 && c <= 67)
    return { k: 'rain', r: c >= 65 ? 90 : 55, n: c >= 65 ? 'Lluvia fuerte' : 'Lluvia' };
  if (c >= 51 && c <= 57) return { k: 'rain', r: 25, n: 'Llovizna' };
  if (c === 45 || c === 48) return { k: 'fog', r: 0, n: 'Niebla' };
  return { k: 'none', r: 0, n: null };
}

const cloudName = (c: number) => (c < 25 ? 'Despejado' : c < 60 ? 'Parcialmente nublado' : 'Nublado');

// Deterministic PRNG (mulberry32) so stars/rain look the same on every render.
export function rnd(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SkyView = {
  body: 'sun' | 'moon';
  p: number; // position on the arc, 0..1
  xy: [number, number];
  bodyOpacity: number;
  sunHalo: string;
  sunCore: string;
  moonPhase: number;
  elapsed: string | null;
  elapsedColor: string;
  top: string;
  bottom: string;
  ridge1: string;
  ridge2: string;
  overlay: number; // artboard --sc
  starsOpacity: number;
  kind: CondKind;
  name: string;
  night: boolean;
  cc: number; // effective cloud cover 0..1
  cloudCount: number; // 0..6
  cloudFill: string;
  cloudOpacity: number;
  rainCount: number; // artboard streak intensity (0..90)
  rainOpacity: number;
  fogOpacity: number;
  haze: string;
};

export function computeSky(sky: Sky, nowMs: number): SkyView {
  const nowS = nowMs / 1000;
  let sr = Number(sky.sunrise_ts);
  let ss = Number(sky.sunset_ts);
  if (!Number.isFinite(sr) || !Number.isFinite(ss) || ss <= sr) {
    // Defensive fallback: a 12 h day centered on the server's sunrise (or now).
    sr = Number.isFinite(sr) ? sr : nowS - 21600;
    ss = sr + 43200;
  }
  // Shift by whole days so the day brackets `now` (timezone independent).
  const k = Math.round((nowS - (sr + ss) / 2) / 86400);
  sr += k * 86400;
  ss += k * 86400;

  const dayLen = clamp((ss - sr) / 3600, 6, 18);
  // Synthetic local hours: the day is centered on 12 so the artboard keyframes fit.
  const srH = 12 - dayLen / 2;
  const ssH = 12 + dayLen / 2;
  const dt = (((nowS - sr) / 3600) % 24 + 24) % 24;
  const h = (srH + dt) % 24;

  const code = Number.isFinite(sky.code) ? sky.code : 0;
  const cloud = clamp(Number.isFinite(sky.cloud_pct) ? sky.cloud_pct : 0, 0, 100);
  const cd = cond(code);
  const wet = cd.k === 'rain' || cd.k === 'storm';
  let cc = cloud / 100;
  if (wet) cc = Math.max(cc, 0.9);
  if (cd.k === 'fog') cc = Math.max(cc, 0.4);
  const dk = (1 - 0.18 * cc) * (cd.k === 'storm' ? 0.7 : 1);
  const fg = cd.k === 'fog' ? 0.5 : 1;

  const s = skyAt(h, keys(srH, ssH));
  const top = gray(s[0], 0.7 * cc, dk);
  const bottom = gray(s[1], 0.7 * cc, dk);
  const D = [8, 12, 20];
  const lin = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const a = mix(top, bottom, 0.6);
  const L = 0.2126 * lin(a[0]) + 0.7152 * lin(a[1]) + 0.0722 * lin(a[2]);
  const overlay = clamp((L - 0.06) / (L - 0.004), 0.3, 0.9);

  const d = daylight(h, srH, ssH);
  let body: 'sun' | 'moon';
  let p: number;
  if (nowS >= sr && nowS <= ss) {
    body = 'sun';
    p = (nowS - sr) / (ss - sr);
  } else if (nowS > ss) {
    body = 'moon';
    p = (nowS - ss) / (sr + 86400 - ss);
  } else {
    body = 'moon';
    p = (nowS - (ss - 86400)) / (sr - (ss - 86400));
  }
  p = clamp(p, 0, 1);
  const vis = Math.min(1, p * 14, (1 - p) * 14);

  let sunHalo = '#fff2b8';
  let sunCore = '#fff6d0';
  let bodyOpacity: number;
  if (body === 'sun') {
    const alt = Math.sin(Math.PI * p);
    const c = mix(hex('#ff8a3c'), hex('#fff2b8'), Math.min(1, alt * 1.6));
    sunHalo = rgb(c);
    sunCore = rgb(mix(c, [255, 255, 255], 0.45));
    bodyOpacity = vis * (1 - 0.65 * cc) * fg;
  } else {
    bodyOpacity = vis * (1 - 0.6 * cc) * fg;
  }

  const hz = mix(hex('#3a4766'), hex('#eef3f8'), d);
  return {
    body,
    p,
    xy: pos(p),
    bodyOpacity: clamp(bodyOpacity, 0, 1),
    sunHalo,
    sunCore,
    moonPhase: moonPhase(nowMs),
    elapsed: elapsedPath(p),
    elapsedColor: body === 'sun' ? '#ffe9a8' : '#dfe7ff',
    top: rgb(top),
    bottom: rgb(bottom),
    ridge1: rgb(mix(bottom, D, 0.55)),
    ridge2: rgb(mix(bottom, D, 0.72)),
    overlay,
    starsOpacity: clamp((1 - d) * (1 - 0.85 * cc) * (cd.k === 'fog' ? 0.3 : 1), 0, 1),
    kind: cd.k,
    name: cd.n ?? cloudName(cloud),
    night: body === 'moon',
    cc,
    cloudCount: Math.round(cc * 6),
    cloudFill: rgb(mix(hex('#3a4766'), hex('#f5f8fc'), d)),
    cloudOpacity: d > 0.1 ? 0.6 + 0.32 * cc : 0.45,
    rainCount: wet ? cd.r : 0,
    rainOpacity: wet ? 0.25 + (0.35 * cd.r) / 100 : 0,
    fogOpacity: cd.k === 'fog' ? 0.55 + 0.35 * d : 0,
    haze: rgb(hz),
  };
}
