import type { Device } from '../types';

// Agrupa dispositivos del mismo tipo (label sin el número final: "Ventilador
// 1"/"Ventilador 2" -> "Ventilador") preservando el orden de aparición. Los
// grupos de un solo ítem (Nevera, Laptop, Ecoplay) se renderizan como fila
// suelta; solo los grupos con más de un ítem son colapsables.
export function groupByType(devices: Device[]): { key: string; emoji: string; devices: Device[] }[] {
  const order: string[] = [];
  const map = new Map<string, Device[]>();
  for (const d of devices) {
    const key = d.label.replace(/\s*\d+$/, '').trim();
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(d);
  }
  return order.map((key) => ({ key, emoji: map.get(key)![0].emoji, devices: map.get(key)! }));
}
