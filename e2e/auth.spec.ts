import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  const testEmail = `e2e-${Date.now()}@test.com`;
  const testPassword = 'TestPass123!';

  test('should show login page at /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should redirect unauthenticated users to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('should register a new user', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/name/i).fill('E2E Test User');
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).first().fill(testPassword);
    await page.getByRole('button', { name: /create account|register|sign up/i }).click();
    // Should redirect to login or dashboard
    await expect(page).toHaveURL(/login|dashboard/, { timeout: 10000 });
  });

  test('should reject invalid login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('nobody@invalid.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Should stay on login page with error
    await expect(page).toHaveURL(/login/);
  });

  test('should login with demo account after seeding', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('demo@futuresight.app');
    await page.getByLabel(/password/i).fill('Demo1234');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });
});
