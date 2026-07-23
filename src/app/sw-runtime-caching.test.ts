import { describe, it, expect } from 'vitest';
import { runtimeCaching } from './sw-runtime-caching';
import type { RuntimeCaching } from 'serwist';

function callMatcher(rule: RuntimeCaching, input: Record<string, unknown>): boolean {
  const result = (rule.matcher as (opts: unknown) => boolean)(input);
  return result;
}

describe('sw-runtime-caching', () => {
  it('never caches page navigations (HTML documents) — always network-only', () => {
    const docRule = runtimeCaching[0];
    expect(callMatcher(docRule, { request: { destination: 'document' } })).toBe(true);
    expect(docRule.handler.constructor.name).toBe('NetworkOnly');
  });

  it('never caches API routes — live stock/movement data is never served stale', () => {
    const apiRule = runtimeCaching[1];
    expect(callMatcher(apiRule, { url: new URL('http://localhost/api/parts/1/movements') })).toBe(true);
    expect(callMatcher(apiRule, { url: new URL('http://localhost/inventario') })).toBe(false);
    expect(apiRule.handler.constructor.name).toBe('NetworkOnly');
  });

  it('still includes the Next.js defaultCache rules for genuinely static build assets', () => {
    expect(runtimeCaching.length).toBeGreaterThan(2);
  });
});
