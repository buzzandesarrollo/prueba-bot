import type { DbReward } from "../types/index.js";

export interface WeightedItem {
  weight: number;
}

export function weightedRandom<T extends WeightedItem>(items: T[] | null | undefined): T | null {
  if (!items || items.length === 0) {
    return null;
  }

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight <= 0) {
    return items[0];
  }

  let random = Math.random() * totalWeight;

  for (const item of items) {
    if (random < item.weight) {
      return item;
    }
    random -= item.weight;
  }

  return items[items.length - 1];
}

export function getRarityColor(rarity: string): number {
  switch (rarity) {
    case "comun": return 0x95a5a6;
    case "raro": return 0x3498db;
    case "epico": return 0x9b59b6;
    case "legendario": return 0xf1c40f;
    case "mitico": return 0xe74c3c;
    default: return 0xffffff;
  }
}

export function getRarityEmoji(rarity: string): string {
  switch (rarity) {
    case "comun": return "⚪";
    case "raro": return "🔵";
    case "epico": return "🟣";
    case "legendario": return "🟡";
    case "mitico": return "🔴";
    default: return "⚪";
  }
}
