/**
 * All money in this system is stored and computed as an integer number of fils
 * (1 AED = 100 fils). Never as a float — `0.1 + 0.2 !== 0.3` is not an
 * acceptable property for something that decides what a driver is charged at
 * the exit gate.
 */

export type Fils = number;

export function aedToFils(aed: number): Fils {
  return Math.round(aed * 100);
}

export function filsToAed(fils: Fils): number {
  return fils / 100;
}

/** "1400" -> "14.00" */
export function formatAmount(fils: Fils): string {
  const sign = fils < 0 ? "-" : "";
  const abs = Math.abs(fils);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "1400" -> "AED 14.00" */
export function formatAed(fils: Fils): string {
  return `AED ${formatAmount(fils)}`;
}
