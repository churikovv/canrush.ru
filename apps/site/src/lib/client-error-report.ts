'use client';
import { useEffect } from 'react';

/**
 * Tells the site about an error caught by an error page, for `/admin/errors`. An error with a `digest` came from the
 * server, which has recorded it already. The address goes without its query, and the server cleans the rest.
 */
export function useErrorReport(error: Error & { digest?: string }) {
  useEffect(() => {
    if (error.digest) return;
    const body = new Blob([JSON.stringify({ path: location.pathname, message: error.message.slice(0, 2000), stack: error.stack?.slice(0, 8000) })], { type: 'application/json' });
    try { if (navigator.sendBeacon?.('/api/client-errors', body)) return; } catch { /* falls back to fetch */ }
    void fetch('/api/client-errors', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => undefined);
  }, [error]);
}
