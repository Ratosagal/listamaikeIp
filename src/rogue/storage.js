import { KEY, freshState, restore } from "./simulation.js";
export const RELEASE = "1.0.0";
export const BACKUP = KEY + "-backup";
const MAX_SIZE = 1024 * 1024;
export function readProgress(storage, seed = Date.now() >>> 0) {
  let primary = null,
    backup = null;
  try {
    primary = storage.getItem(KEY);
    backup = storage.getItem(BACKUP);
  } catch {
    return { state: freshState(seed), source: "unavailable", recovered: false };
  }
  if (primary) {
    try {
      return { state: restore(primary), source: "primary", recovered: false };
    } catch {
      try {
        storage.setItem(KEY + "-recovery", primary);
      } catch {}
    }
  }
  if (backup) {
    try {
      return { state: restore(backup), source: "backup", recovered: true };
    } catch {}
  }
  return { state: freshState(seed), source: "new", recovered: !!primary };
}
export function writeProgress(storage, state) {
  const raw = JSON.stringify(state);
  restore(raw);
  const previous = storage.getItem(KEY);
  if (previous) {
    try {
      restore(previous);
      storage.setItem(BACKUP, previous);
    } catch {
      /* Never replace a healthy backup with invalid data. */
    }
  }
  storage.setItem(KEY, raw);
  return raw;
}
export function exportProgress(state) {
  return JSON.stringify(
    {
      game: "gisele-veil",
      release: RELEASE,
      exportedAt: new Date().toISOString(),
      state,
    },
    null,
    2,
  );
}
export function importProgress(raw) {
  if (typeof raw !== "string" || raw.length > MAX_SIZE)
    throw Error("O arquivo deve ser um save JSON de até 1 MB.");
  const parsed = JSON.parse(raw);
  if (parsed?.game && parsed.game !== "gisele-veil")
    throw Error("Este arquivo pertence a outro jogo.");
  return restore(
    JSON.stringify(parsed?.game === "gisele-veil" ? parsed.state : parsed),
  );
}
