import { test, expect } from '@playwright/test';

test('serves a valid, installable web app manifest', async ({ page, request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.status()).toBe(200);

  const manifest = await response.json();
  expect(manifest.name).toBe('Milenium Motos · Inventario de Repuestos');
  expect(manifest.display).toBe('standalone');
  expect(Array.isArray(manifest.icons)).toBe(true);
  expect(manifest.icons.length).toBeGreaterThan(0);

  await page.goto('/login');
  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveAttribute('href', /manifest\.webmanifest/);

  const themeColorMeta = page.locator('meta[name="theme-color"]');
  await expect(themeColorMeta).toHaveAttribute('content', '#1b2230');
});
