/**
 * Debug logging utility — toggleable via DEBUG_ENABLED flag.
 * Set to `true` to enable extensive console logging for diagnosing
 * duplicate key issues and tree-building problems.
 */

export const DEBUG_ENABLED = true;

const PREFIX = "[DEBUG]";

export function debugLog(area: string, message: string, ...data: unknown[]) {
  if (!DEBUG_ENABLED) return;
  console.log(`${PREFIX} [${area}]`, message, ...data);
}

export function debugWarn(area: string, message: string, ...data: unknown[]) {
  if (!DEBUG_ENABLED) return;
  console.warn(`${PREFIX} [${area}]`, message, ...data);
}

export function debugError(area: string, message: string, ...data: unknown[]) {
  if (!DEBUG_ENABLED) return;
  console.error(`${PREFIX} [${area}]`, message, ...data);
}

/**
 * Check an array for duplicate keys and log any duplicates found.
 * Returns the list of duplicate keys (empty if none).
 */
export function checkDuplicateKeys<T>(
  area: string,
  label: string,
  items: T[],
  keyFn: (item: T) => string | number | null | undefined,
): (string | number)[] {
  if (!DEBUG_ENABLED) return [];

  const seen = new Map<string | number, number[]>();
  items.forEach((item, index) => {
    const key = keyFn(item);
    if (key == null) return;
    const indices = seen.get(key);
    if (indices) {
      indices.push(index);
    } else {
      seen.set(key, [index]);
    }
  });

  const duplicates: (string | number)[] = [];
  for (const [key, indices] of seen) {
    if (indices.length > 1) {
      duplicates.push(key);
      debugError(
        area,
        `DUPLICATE KEY in ${label}: key=${key} at indices [${indices.join(", ")}]`,
        items.filter((_, i) => indices.includes(i)),
      );
    }
  }

  if (duplicates.length > 0) {
    debugError(area, `Found ${duplicates.length} duplicate key(s) in ${label}`, duplicates);
  } else {
    debugLog(area, `No duplicate keys in ${label} (${items.length} items)`);
  }

  return duplicates;
}
