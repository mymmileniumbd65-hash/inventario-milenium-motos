import { test, expect } from '@playwright/test';

// Reuses the same account as `npm run db:seed` (SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD
// in .env.local) rather than introducing a separate throwaway test user.
const EMAIL = process.env.SEED_ADMIN_EMAIL;
const PASSWORD = process.env.SEED_ADMIN_PASSWORD;

test.beforeAll(() => {
  if (!EMAIL || !PASSWORD) {
    throw new Error('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set in .env.local to run this suite.');
  }
});

test('redirects an unauthenticated visitor to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

test('rejects invalid credentials with an error message', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#email').fill(EMAIL!);
  await page.locator('#password').fill('wrong-password-123');
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await expect(page.getByText(/credenciales|inválid|incorrect/i)).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/login/);
});

test('logs in, navigates the main sections, and logs out', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#email').fill(EMAIL!);
  await page.locator('#password').fill(PASSWORD!);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();

  await expect(page).toHaveURL('http://localhost:3000/');
  await expect(page.getByText(EMAIL!)).toBeVisible();

  for (const [href, label] of [
    ['/inventario', 'Inventario'],
    ['/alertas', 'Alertas'],
    ['/movimientos', 'Movimientos'],
    ['/reportes', 'Reportes'],
  ] as const) {
    await page.getByRole('navigation').getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  }

  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/login/);
});
