import { describe, it, expect } from 'vitest';
import manifest from './manifest';

describe('manifest', () => {
  it('declares the app as an installable standalone PWA', () => {
    const result = manifest();
    expect(result.name).toBe('Milenium Motos · Inventario de Repuestos');
    expect(result.short_name).toBe('Milenium Motos');
    expect(result.display).toBe('standalone');
    expect(result.start_url).toBe('/');
    expect(result.scope).toBe('/');
  });

  it('provides theme and background colors matching the brand palette', () => {
    const result = manifest();
    expect(result.theme_color).toBe('#1b2230');
    expect(result.background_color).toBe('#f6f7f9');
  });

  it('includes 192x192 and 512x512 "any" icons, plus a maskable 512x512 icon', () => {
    const result = manifest();
    const icons = result.icons ?? [];

    const any192 = icons.find((i) => i.sizes === '192x192' && i.purpose !== 'maskable');
    const any512 = icons.find((i) => i.sizes === '512x512' && i.purpose !== 'maskable');
    const maskable = icons.find((i) => i.purpose === 'maskable');

    expect(any192).toBeDefined();
    expect(any512).toBeDefined();
    expect(maskable).toBeDefined();
    expect(maskable?.sizes).toBe('512x512');
  });
});
