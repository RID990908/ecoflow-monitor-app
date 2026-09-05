export type FlowState = 'neutral' | 'charging' | 'discharging';

export type Device = {
  key: string;
  label: string;
  emoji: string;
  watts: number;
  on: boolean;
  charged?: boolean | null;
  fits?: boolean | null;
  deficit_w?: number | null;
  note?: string | null;
};
export type DevicesResponse = { devices: Device[] };
