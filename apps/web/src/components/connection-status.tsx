'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, LoaderCircle, RefreshCw, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Status = 'checking' | 'available' | 'unavailable';

export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>('checking');
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus('checking');
    try {
      const response = await fetch('/api/connection', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
      const body: unknown = response.ok ? await response.json() : null;
      if (!controller.signal.aborted) setStatus(typeof body === 'object' && body !== null && 'status' in body && body.status === 'available' ? 'available' : 'unavailable');
    } catch {
      if (!controller.signal.aborted) setStatus('unavailable');
    } finally {
      if (!controller.signal.aborted) setCheckedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, []);

  useEffect(() => { void refresh(); return () => request.current?.abort(); }, [refresh]);
  const Icon = status === 'checking' ? LoaderCircle : status === 'available' ? Check : CircleAlert;

  return <section className="connection-card" aria-labelledby="service-title"><div className="connection-top"><span className="feature-icon blue"><Server size={22} aria-hidden="true" /></span><div><h2 id="service-title">DevFlow service</h2><p>Live connection check</p></div></div><div className={`connection-state ${status}`} role="status" aria-live="polite" aria-atomic="true"><Icon size={24} className={status === 'checking' ? 'spinner' : ''} aria-hidden="true" /><div><strong>{status === 'checking' ? 'Checking connection…' : status === 'available' ? 'Service is available' : 'Service is unavailable'}</strong><p>{status === 'checking' ? 'Waiting for a response from the service.' : status === 'available' ? 'The DevFlow service responded successfully.' : 'We couldn’t reach the service. It may be offline. Try again in a moment.'}</p></div></div><div className="connection-actions"><span>{checkedAt ? `Last checked at ${checkedAt} · your local time` : 'No completed check yet'}</span><Button variant="secondary" onClick={() => void refresh()} disabled={status === 'checking'}><RefreshCw size={16} aria-hidden="true" />Check again</Button></div></section>;
}
