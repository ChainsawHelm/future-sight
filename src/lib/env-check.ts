/**
 * Validate required environment variables at startup.
 * Import this module early (e.g., in instrumentation.ts) to fail fast.
 */

const REQUIRED_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'ENCRYPTION_KEY',
] as const;

const REQUIRED_IN_PRODUCTION = [
  'NEXTAUTH_URL',
] as const;

export function validateEnv() {
  const missing: string[] = [];

  for (const v of REQUIRED_VARS) {
    if (!process.env[v]) missing.push(v);
  }

  if (process.env.NODE_ENV === 'production') {
    for (const v of REQUIRED_IN_PRODUCTION) {
      if (!process.env[v]) missing.push(v);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[SECURITY] Missing required environment variables: ${missing.join(', ')}. ` +
      `The app cannot start without these. Check your .env file or deployment config.`
    );
  }

  // Validate ENCRYPTION_KEY strength (at least 32 chars)
  const ek = process.env.ENCRYPTION_KEY!;
  if (ek.length < 32) {
    throw new Error(
      `[SECURITY] ENCRYPTION_KEY must be at least 32 characters. Current length: ${ek.length}`
    );
  }
}
