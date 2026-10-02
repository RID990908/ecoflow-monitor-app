export type FlowState = 'neutral' | 'charging' | 'discharging';

export type Device = {
  key: string;
  label: string;
  emoji: string;
  watts: number;
  on: boolean;
  fits?: boolean | null;
};
export type DevicesResponse = { devices: Device[] };
