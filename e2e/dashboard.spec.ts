import { test, expect } from '@playwright/test';

// Helper to login as demo user
async function loginAsDemo(page: any) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('demo@futuresight.app');
  await page.getByLabel(/password/i).fill('Demo1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test('should display stat cards', async ({ page }) => {
    await expect(page.getByText('Net Worth')).toBeVisible();
    await expect(page.getByText('Monthly Income')).toBeVisible();
    await expect(page.getByText('Monthly Spending')).toBeVisible();
    await expect(page.getByText('Net Savings')).toBeVisible();
  });

  test('should display spending by category chart', async ({ page }) => {
    await expect(page.getByText('Spending by Category')).toBeVisible();
  });

  test('should display savings goals', async ({ page }) => {
    await expect(page.getByText('Savings Goals')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test('should navigate to transactions', async ({ page }) => {
    await page.getByRole('button', { name: /transactions/i }).first().click();
    await expect(page).toHaveURL(/transactions/);
    await expect(page.getByText('Transactions')).toBeVisible();
  });

  test('should navigate to goals', async ({ page }) => {
    await page.getByRole('button', { name: /goals/i }).first().click();
    await expect(page).toHaveURL(/goals/);
    await expect(page.getByText('Savings Goals')).toBeVisible();
  });

  test('should navigate to budget', async ({ page }) => {
    await page.getByRole('button', { name: /budget/i }).first().click();
    await expect(page).toHaveURL(/budget/);
    await expect(page.getByText('Budget')).toBeVisible();
  });

  test('should navigate to settings', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).first().click();
    await expect(page).toHaveURL(/settings/);
    await expect(page.getByText('Settings')).toBeVisible();
  });
});
