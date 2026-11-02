// Throws in production instead of falling back to '*': credentials are enabled,
// so a wildcard origin must never be served there.
export function resolveCorsOrigin(
  origin = process.env.ORIGIN,
  nodeEnv = process.env.NODE_ENV,
): string | string[] {
  const origins = origin
    ?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (origins?.length) return origins;
  if (nodeEnv === 'production') {
    throw new Error('ORIGIN must be set when NODE_ENV=production');
  }
  return '*';
}
