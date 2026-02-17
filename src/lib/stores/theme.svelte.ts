import { loadFromStorage, saveToStorage } from "$lib/utils/storage.js";

const STORAGE_KEY = "theme-preference";

const stored = loadFromStorage<boolean | null>(STORAGE_KEY, null);
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const initialDark = stored ?? prefersDark;

let isDark = $state(initialDark);

// Apply immediately on module load (no flash) — uses plain variable, not $state
document.documentElement.classList.toggle("dark", initialDark);

function applyClass(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

function toggle() {
  isDark = !isDark;
  applyClass(isDark);
  saveToStorage(STORAGE_KEY, isDark);
}

export const themeStore = {
  get isDark() { return isDark; },
  toggle,
};
