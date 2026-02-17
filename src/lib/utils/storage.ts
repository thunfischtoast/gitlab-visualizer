export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function removeFromStorage(key: string): void {
  localStorage.removeItem(key);
}

// --- sessionStorage helpers (for sensitive data like tokens) ---

export function loadFromSession<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveToSession<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessionStorage full or unavailable — silently ignore
  }
}

export function removeFromSession(key: string): void {
  sessionStorage.removeItem(key);
}

// --- Runtime validation ---

/**
 * Validate that a value has the expected shape.
 * Returns the value if valid, or null if not.
 */
export function validateShape<T>(
  value: unknown,
  checks: Record<string, string>, // { propertyName: expectedType }
): value is T {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  for (const [key, type] of Object.entries(checks)) {
    if (type === "array") {
      if (!Array.isArray(obj[key])) return false;
    } else if (typeof obj[key] !== type) {
      return false;
    }
  }
  return true;
}
