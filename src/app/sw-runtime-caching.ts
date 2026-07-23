import { defaultCache } from '@serwist/next/worker';
import { NetworkOnly, type RuntimeCaching } from 'serwist';

// This is a live inventory app: stock/movements must always come from the
// network, never a stale cache. @serwist/next's defaultCache applies
// NetworkFirst (not NetworkOnly) to HTML documents and same-origin /api/*
// GETs, which would let a real API response like GET /api/parts/[id]/movements
// be served from cache during an outage. These two rules take precedence
// (Serwist matches routes in array order) and force network-only instead.
export const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ request }) => request.destination === 'document',
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ url }) => url.pathname.startsWith('/api/'),
    handler: new NetworkOnly(),
  },
  ...defaultCache,
];
