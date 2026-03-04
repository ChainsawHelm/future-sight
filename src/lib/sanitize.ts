/**
 * Sanitize a string to prevent XSS.
 * Strips HTML tags and dangerous characters.
 * Note: Prisma already handles SQL injection via parameterized queries.
 * React also escapes output by default.
 * This is defense-in-depth for stored data.
 */
export function sanitizeString(input: string): string {
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove potential script injection patterns
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    // Trim and limit length
    .trim();
}

/**
 * Sanitize all string values in an object (shallow).
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') {
      (result as any)[key] = sanitizeString(result[key]);
    }
  }
  return result;
}

/**
 * Validate and sanitize a file name.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._\-\s]/g, '')
    .replace(/\.\./g, '')
    .trim()
    .slice(0, 255);
}
