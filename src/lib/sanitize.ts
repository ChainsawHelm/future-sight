/**
 * Sanitize a string to prevent XSS and stored injection attacks.
 * Strips HTML tags, control characters, and dangerous patterns.
 * Note: Prisma already handles SQL injection via parameterized queries.
 * React also escapes output by default.
 * This is defense-in-depth for stored data.
 */
export function sanitizeString(input: string): string {
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove potential script injection patterns
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    // Remove control characters (keep newlines and tabs for notes)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize unicode to NFKC (prevents lookalike character attacks)
    .normalize('NFKC')
    // Trim and collapse internal whitespace
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
