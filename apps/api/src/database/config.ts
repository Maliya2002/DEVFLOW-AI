export function parseDatabaseUrl(
  value: string | undefined,
  name = 'DATABASE_URL',
): string | undefined {
  if (value === undefined) return undefined;
  const invalid = () =>
    new Error(
      `${name} must be a PostgreSQL URL with credentials, database name, and verified TLS for remote hosts.`,
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalid();
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    !url.username ||
    !url.password ||
    url.pathname.length < 2 ||
    url.hash
  )
    throw invalid();
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const allowed = new Set(['sslmode', 'channel_binding']);
  for (const key of url.searchParams.keys()) if (!allowed.has(key)) throw invalid();
  for (const key of allowed) if (url.searchParams.getAll(key).length > 1) throw invalid();
  const ssl = url.searchParams.get('sslmode');
  if (!local && ssl !== 'require' && ssl !== 'verify-full') throw invalid();
  if (ssl && !['disable', 'require', 'verify-full'].includes(ssl)) throw invalid();
  // Keep hostname and CA verification enabled with node-postgres.
  if (!local) url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}
