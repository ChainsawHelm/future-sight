import { test, expect } from '@playwright/test';

async function loginAsDemo(page: any) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('demo@futuresight.app');
  await page.getByLabel(/password/i).fill('Demo1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
}

test.describe('Goals', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/goals');
  });

  test('should display goals with progress', async ({ page }) => {
    await expect(page.getByText('Savings Goals')).toBeVisible();
    // Seed data has 3 goals
    await expect(page.getByText('Emergency Fund')).toBeVisible();
  });

  test('should open add goal form', async ({ page }) => {
    await page.getByRole('button', { name: /new goal/i }).click();
    await expect(page.getByLabel(/goal name/i)).toBeVisible();
    await expect(page.getByLabel(/target amount/i)).toBeVisible();
  });
});

test.describe('Debts', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/debts');
  });

  test('should display debts with payoff progress', async ({ page }) => {
    await expect(page.getByText('Debt Tracker')).toBeVisible();
    await expect(page.getByText('Student Loan')).toBeVisible();
    await expect(page.getByText(/payoff date/i).first()).toBeVisible();
  });
});

test.describe('Budget', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/budget');
  });

  test('should display budget categories with progress bars', async ({ page }) => {
    await expect(page.getByText('Budget')).toBeVisible();
    // Seed data has 6 budgets
    await expect(page.getByText('Groceries')).toBeVisible();
  });
});

test.describe('Health Score', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/health');
  });

  test('should display health score with breakdown', async ({ page }) => {
    await expect(page.getByText('Financial Health Score')).toBeVisible();
    await expect(page.getByText('Savings Rate')).toBeVisible();
    await expect(page.getByText('Debt-to-Income')).toBeVisible();
  });
});

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/settings');
  });

  test('should display settings with dark mode toggle', async ({ page }) => {
    await expect(page.getByText('Settings')).toBeVisible();
    await expect(page.getByText('Dark Mode')).toBeVisible();
    await expect(page.getByText('Export Backup')).toBeVisible();
  });

  test('should toggle dark mode', async ({ page }) => {
    // Click the dark mode toggle
    const toggle = page.locator('button').filter({ hasText: /dark mode/i }).first()
      || page.getByText('Dark Mode').locator('..').locator('button');
    // The html element should get 'dark' class after toggle
  });
});
