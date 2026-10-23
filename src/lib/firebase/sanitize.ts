/**
 * Firestore Sanitization Utility
 * Strips all `undefined` fields recursively to prevent Firestore "invalid-argument: Unsupported field value: undefined" errors.
 */
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => (typeof item === 'object' && item !== null && !(item instanceof Date) ? sanitizeForFirestore(item) : item)) as unknown as T;
  }

  if (obj instanceof Date) {
    return obj;
  }

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        clean[key] = sanitizeForFirestore(val);
      } else if (Array.isArray(val)) {
        clean[key] = val
          .filter(item => item !== undefined)
          .map(item => (typeof item === 'object' && item !== null && !(item instanceof Date) ? sanitizeForFirestore(item) : item));
      } else {
        clean[key] = val;
      }
    }
  }
  return clean as T;
}
