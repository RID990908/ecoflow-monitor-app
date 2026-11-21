// Icon for the Solar node: reflects the weather and day/night from the backend `sky` payload.
// Pure: no React, no I/O. WMO weather codes as sent by the backend.

export type Sky = {
  cloud_pct: number;
  code: number;
  is_day: boolean;
};

export function weatherEmoji(sky: Sky | null | undefined): string {
  if (!sky) return '☀️';
  const { code, cloud_pct: cloud, is_day: isDay } = sky;
  if (code >= 95) return '⛈️';
  if (code >= 80 || (code >= 51 && code <= 67)) return '🌧️';
  if (code === 45 || code === 48) return '🌫️';
  if (!isDay) return '🌙';
  if (cloud < 25) return '☀️';
  return cloud < 60 ? '⛅' : '☁️';
}
