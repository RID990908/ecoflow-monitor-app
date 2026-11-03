import type { FlowState } from './types';

export const COLORS = {
  bg: '#090d12',
  card: '#121921',
  border: '#232c36',
  text: '#f5f7fa',
  dim: '#9aa6b3',
  faint: '#8593a3',
  green: '#4ade80',
  red: '#f87171',
  yellow: '#eab308',
  ringTrack: '#1a222b',
  track: '#26303b',
  nodeBg: '#18202a',
  nodeBorder: '#232c36',
  chargingBg: '#112d1c',
  dischargingBg: '#331616',
  disc: '#0c1117',
};

export function flowColor(state: FlowState) {
  return state === 'charging' ? COLORS.green : state === 'discharging' ? COLORS.red : COLORS.faint;
}

export function flowBg(state: FlowState) {
  return state === 'charging' ? COLORS.chargingBg : state === 'discharging' ? COLORS.dischargingBg : COLORS.nodeBg;
}

// Borde y halo de un nodo según su estado: solo los nodos activos brillan.
export function flowNodeStyle(state: FlowState) {
  if (state === 'neutral') return { borderColor: COLORS.nodeBorder };
  const rgb = state === 'charging' ? '74,222,128' : '248,113,113';
  return {
    borderColor: `rgba(${rgb},0.6)`,
    boxShadow: `0 0 0 4px rgba(${rgb},0.08), 0 0 22px rgba(${rgb},0.28)`,
  };
}

// Plant verdict tone -> text/dot color.
export const PLANT_TONE_COLOR = {
  ok: COLORS.green,
  warn: COLORS.yellow,
  bad: COLORS.red,
};
