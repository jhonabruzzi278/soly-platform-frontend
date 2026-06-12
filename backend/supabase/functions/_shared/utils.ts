// ============================================================================
// _shared/utils — Shared utilities for edge functions
// ============================================================================

export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) delete obj[key]
  }
  return obj
}
