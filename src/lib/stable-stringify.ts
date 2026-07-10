/**
 * Deterministic JSON Stringification Utility — Addendum E
 *
 * Standard JSON.stringify() does NOT guarantee key order. If the database or ORM
 * reorders the keys in matchDetails, beforeData, afterData, or any hash payload
 * when retrieving a record, the verification hash will not match the stored hash,
 * causing false integrity failures for auditors.
 *
 * This utility sorts all object keys recursively before stringification, ensuring
 * the same logical object always produces the same JSON string regardless of
 * insertion order or runtime key ordering.
 *
 * Used by:
 *   - createAuditLog() (Fix 3 — WORM audit trail hash)
 *   - screening-engine.ts (Fix 5 — SanctionsScreening hash)
 *   - audit-middleware.ts (hash generation)
 *   - Any future WORM/integrity verification endpoint
 */

/**
 * Recursively sort all keys in an object (and nested objects/arrays) to ensure
 * deterministic JSON stringification.
 */
function sortObjectKeys<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys) as T;
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted as T;
  }

  // Primitives (string, number, boolean, Date, etc.) pass through unchanged.
  // Date objects are serialized by JSON.stringify to ISO strings, which is
  // already deterministic.
  return obj;
}

/**
 * Deterministic JSON stringification. Keys are sorted recursively before
 * stringification so the output is stable regardless of object key order.
 *
 * @param obj - The value to serialize
 * @param space - Optional indentation (same as JSON.stringify 3rd param)
 * @returns A deterministic JSON string
 */
export function stableStringify(obj: unknown, space?: string | number): string {
  const sorted = sortObjectKeys(obj);
  return JSON.stringify(sorted, null, space ?? 0);
}
