/** Chip color by denomination tier */
export const CHIP_COLORS: Record<number, string> = {
  2: '#e5e5e5',   // white
  5: '#e74c3c',   // red
  10: '#2980b9',  // blue
  20: '#27ae60',  // green
  25: '#27ae60',  // green
  50: '#2c3e50',  // black
  100: '#8e44ad', // purple
  500: '#e67e22', // orange
};

/** Get chip color — falls back gracefully for custom denominations */
export function getChipColor(denom: number): string {
  if (CHIP_COLORS[denom]) return CHIP_COLORS[denom];
  // Pick by magnitude
  if (denom >= 500) return '#e67e22';
  if (denom >= 100) return '#8e44ad';
  if (denom >= 50) return '#2c3e50';
  if (denom >= 20) return '#27ae60';
  if (denom >= 10) return '#2980b9';
  if (denom >= 5) return '#e74c3c';
  return '#e5e5e5';
}

export interface ChipCount {
  denom: number;
  count: number;
  color: string;
}

/**
 * Break an amount into chip denomination stacks (greedy, largest first).
 * Returns only denominations with count > 0, capped at 5 chips per denom for display.
 */
export function breakdownChips(amount: number, denominations: number[]): ChipCount[] {
  const sorted = [...denominations].sort((a, b) => b - a); // largest first
  let remaining = amount;
  const result: ChipCount[] = [];

  for (const denom of sorted) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / denom);
    if (count > 0) {
      result.push({ denom, count: Math.min(count, 5), color: getChipColor(denom) });
      remaining -= count * denom;
    }
  }

  return result;
}
