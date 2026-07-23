import { describe, it, expect } from 'vitest';
import { config } from './proxy';

describe('proxy config.matcher', () => {
  const pattern = config.matcher[0];
  const regex = new RegExp(`^${pattern}$`);

  it('excludes the service worker and web app manifest from session middleware', () => {
    expect(regex.test('/sw.js')).toBe(false);
    expect(regex.test('/manifest.webmanifest')).toBe(false);
  });

  it('still matches authenticated app routes', () => {
    expect(regex.test('/inventario')).toBe(true);
    expect(regex.test('/')).toBe(true);
  });

  it('still excludes existing static asset paths', () => {
    expect(regex.test('/_next/static/chunk.js')).toBe(false);
    expect(regex.test('/_next/image')).toBe(false);
    expect(regex.test('/favicon.ico')).toBe(false);
    expect(regex.test('/assets/logo.svg')).toBe(false);
  });

  it('excludes PWA icon paths so iOS/Android can fetch them unauthenticated', () => {
    expect(regex.test('/apple-icon.png')).toBe(false);
    expect(regex.test('/icons/icon-192.png')).toBe(false);
    expect(regex.test('/icons/icon-512.png')).toBe(false);
  });
});
