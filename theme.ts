import type { FlowState } from './types';

export const COLORS = {
  bg: '#0b0f14',
  card: '#141b22',
  border: '#232b33',
  text: '#f5f5f5',
  dim: '#9aa4af',
  faint: '#6b7684',
  green: '#4ade80',
  red: '#f87171',
  yellow: '#eab308',
  ringTrack: '#1c232b',
  chargingBg: '#14351f',
  dischargingBg: '#3a1616',
};

export function flowColor(state: FlowState) {
  return state === 'charging' ? COLORS.green : state === 'discharging' ? COLORS.red : COLORS.faint;
}
