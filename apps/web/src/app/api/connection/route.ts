export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const origin = new URL(process.env.API_BASE_URL ?? 'http://127.0.0.1:3001');
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) {
      throw new Error('Invalid API origin');
    }
    const response = await fetch(new URL('/api/v1/health', origin), {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
      redirect: 'error',
    });
    const body: unknown = response.ok ? await response.json() : null;
    if (
      typeof body === 'object' &&
      body !== null &&
      'status' in body &&
      body.status === 'ok' &&
      'service' in body &&
      body.service === 'devflow-api'
    ) {
      return Response.json({ status: 'available' }, { headers });
    }
  } catch {
    // Only return a generic availability result; never expose internal URLs or errors.
  }
  return Response.json({ status: 'unavailable' }, { status: 503, headers });
}
