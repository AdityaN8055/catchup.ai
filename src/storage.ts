/**
 * The only things ever written to the device: preferences and opaque item IDs.
 * Conversation text lives in memory only and disappears when the tab closes.
 */
const PREFIX = 'catchup:';

export const KEYS = {
  theme: `${PREFIX}theme`,
  consent: `${PREFIX}consent`,
  names: `${PREFIX}names`,
  done: `${PREFIX}done`
} as const;

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — the app still works */
  }
}

export function wipeAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}
