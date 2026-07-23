import { describe, it, expect } from 'vitest';
import { metadata, viewport } from './pwa-metadata';

describe('pwa-metadata', () => {
  it('keeps the existing page title', () => {
    expect(metadata.title).toBe('Milenium Motos · Inventario de Repuestos');
  });

  it('marks the app as an iOS standalone web app', () => {
    expect(metadata.appleWebApp).toMatchObject({
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'Milenium Motos',
    });
  });

  it('sets the brand theme color for browser chrome and the install splash screen', () => {
    expect(viewport.themeColor).toBe('#1b2230');
  });
});
