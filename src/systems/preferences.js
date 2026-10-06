export const defaults = {
  quality: "medium",
  music: 0.35,
  effects: 0.7,
  sensitivity: 1,
  invert: false,
  shake: false,
  flashes: true,
  particles: true,
  highContrast: false,
};
export function loadPreferences() {
  try {
    const s = JSON.parse(localStorage.getItem("vigilia-settings")) || {};
    return {
      ...defaults,
      ...Object.fromEntries(
        Object.entries(s).filter(
          ([k, v]) => k in defaults && typeof v === typeof defaults[k],
        ),
      ),
      quality: ["low", "medium", "high"].includes(s.quality)
        ? s.quality
        : defaults.quality,
    };
  } catch {
    return { ...defaults };
  }
}
export function storePreferences(settings) {
  try {
    localStorage.setItem("vigilia-settings", JSON.stringify(settings));
  } catch {}
}

export function clampPreferences(settings) {
  for (const k of ["music", "effects"])
    settings[k] = Math.max(0, Math.min(1, settings[k]));
  settings.sensitivity = Math.max(0.2, Math.min(2.5, settings.sensitivity));
  return settings;
}
