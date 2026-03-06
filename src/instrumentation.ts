export async function register() {
  // Validate env vars at server startup (not during build)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env-check');
    validateEnv();
  }
}
