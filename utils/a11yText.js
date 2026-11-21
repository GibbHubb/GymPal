// G61 — safe pieces for screen-reader labels built from data. A label must never read
// "undefined", "null", "NaN" or "Invalid Date" aloud, so every interpolated field goes through
// one of these with the same fallback word.

export const UNKNOWN = 'unknown';

/** A text field for a label, or UNKNOWN when it is missing/blank. */
export function say(value) {
  if (value === null || value === undefined) return UNKNOWN;
  if (typeof value === 'number' && !Number.isFinite(value)) return UNKNOWN;
  const s = String(value).trim();
  return s === '' ? UNKNOWN : s;
}

/** "1 week" / "3 weeks", or "unknown number of weeks" when n is not a finite number. */
export function sayCount(n, unit) {
  const num = typeof n === 'string' && n.trim() !== '' ? Number(n) : n;
  if (typeof num !== 'number' || !Number.isFinite(num)) return `${UNKNOWN} number of ${unit}s`;
  return `${num} ${unit}${num === 1 ? '' : 's'}`;
}

/** A locale date for a label, or "unknown date" for a missing or unparseable value. */
export function sayDate(value) {
  if (value === null || value === undefined || value === '') return `${UNKNOWN} date`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? `${UNKNOWN} date` : d.toLocaleDateString();
}
