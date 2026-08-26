/**
 * §9 — UAE plates carry an emirate. Cars from neighbouring countries use the
 * lot too, so the list ends in an open option rather than pretending these are
 * the only possibilities.
 */
export const EMIRATES = [
  "Dubai",
  "Abu Dhabi",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
  "Other",
] as const;

export const DEFAULT_EMIRATE = "Dubai";
