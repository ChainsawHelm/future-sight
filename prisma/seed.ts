/**
 * Seed script: Creates a demo user with 12 months of realistic financial data.
 * Run with: npx prisma db seed
 * Or: npx tsx prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Helpers ───────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(year: number, month: number): string {
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.floor(Math.random() * daysInMonth) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Transaction Templates ─────────────────

const EXPENSE_TEMPLATES = [
  { desc: 'Whole Foods Market', cat: 'Groceries', min: 25, max: 180 },
  { desc: 'Trader Joe\'s', cat: 'Groceries', min: 20, max: 120 },
  { desc: 'Stop & Shop', cat: 'Groceries', min: 30, max: 150 },
  { desc: 'Chipotle', cat: 'Restaurants', min: 10, max: 25 },
  { desc: 'Starbucks', cat: 'Restaurants', min: 4, max: 8 },
  { desc: 'DoorDash', cat: 'Restaurants', min: 15, max: 55 },
  { desc: 'Uber Eats', cat: 'Restaurants', min: 12, max: 45 },
  { desc: 'Amazon.com', cat: 'Shopping', min: 10, max: 200 },
  { desc: 'Target', cat: 'Shopping', min: 15, max: 100 },
  { desc: 'Netflix', cat: 'Subscriptions', min: 15.49, max: 15.49 },
  { desc: 'Spotify', cat: 'Subscriptions', min: 10.99, max: 10.99 },
  { desc: 'YouTube Premium', cat: 'Subscriptions', min: 13.99, max: 13.99 },
  { desc: 'iCloud Storage', cat: 'Subscriptions', min: 2.99, max: 2.99 },
  { desc: 'Shell Gas Station', cat: 'Transportation', min: 30, max: 65 },
  { desc: 'Exxon', cat: 'Transportation', min: 35, max: 70 },
  { desc: 'MBTA Pass', cat: 'Transportation', min: 90, max: 90 },
  { desc: 'National Grid', cat: 'Utilities', min: 60, max: 180 },
  { desc: 'Comcast Xfinity', cat: 'Utilities', min: 79.99, max: 79.99 },
  { desc: 'Verizon Wireless', cat: 'Utilities', min: 85, max: 85 },
  { desc: 'Rent Payment', cat: 'Housing', min: 1850, max: 1850 },
  { desc: 'Renter\'s Insurance', cat: 'Insurance', min: 25, max: 25 },
  { desc: 'CVS Pharmacy', cat: 'Healthcare', min: 8, max: 45 },
  { desc: 'Planet Fitness', cat: 'Personal Care', min: 25, max: 25 },
  { desc: 'AMC Theatres', cat: 'Entertainment', min: 12, max: 30 },
  { desc: 'Steam Games', cat: 'Entertainment', min: 5, max: 60 },
  { desc: 'Dental Co-pay', cat: 'Healthcare', min: 25, max: 100 },
  { desc: 'TJ Maxx', cat: 'Shopping', min: 20, max: 80 },
  { desc: 'Home Depot', cat: 'Other Expenses', min: 15, max: 120 },
];

const INCOME_TEMPLATES = [
  { desc: 'Payroll Direct Deposit', cat: 'Salary', amount: 3200 },
  { desc: 'Payroll Direct Deposit', cat: 'Salary', amount: 3200 },
];

async function main() {
  console.log('🌱 Seeding database...\n');

  // 1. Create demo user
  const hashedPassword = await bcrypt.hash('Demo1234', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@futuresight.app' },
    update: {},
    create: {
      email: 'demo@futuresight.app',
      name: 'Demo User',
      hashedPassword,
    },
  });
  console.log(`✓ User: ${user.email} (password: Demo1234)`);

  // 2. Seed categories
  const { seedUserDefaults } = await import('../src/lib/defaults');
  await seedUserDefaults(user.id);
  console.log('✓ Default categories created');

  // 3. Generate 12 months of transactions
  const now = new Date();
  const transactions: any[] = [];

  for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    // Salary (2x per month)
    transactions.push({
      userId: user.id,
      date: new Date(`${year}-${String(month).padStart(2, '0')}-01`),
      description: 'Payroll Direct Deposit',
      amount: 3200,
      category: 'Salary',
      account: 'Checking',
    });
    transactions.push({
      userId: user.id,
      date: new Date(`${year}-${String(month).padStart(2, '0')}-15`),
      description: 'Payroll Direct Deposit',
      amount: 3200,
      category: 'Salary',
      account: 'Checking',
    });

    // Side hustle income (occasional)
    if (Math.random() > 0.6) {
      transactions.push({
        userId: user.id,
        date: new Date(randomDate(year, month)),
        description: 'Freelance Payment',
        amount: randomBetween(200, 800),
        category: 'Freelance',
        account: 'Checking',
      });
    }

    // Rent (always on the 1st)
    transactions.push({
      userId: user.id,
      date: new Date(`${year}-${String(month).padStart(2, '0')}-01`),
      description: 'Rent Payment',
      amount: -1850,
      category: 'Housing',
      account: 'Checking',
    });

    // Random expenses: 15-25 per month
    const expenseCount = Math.floor(Math.random() * 11) + 15;
    for (let i = 0; i < expenseCount; i++) {
      const template = pick(EXPENSE_TEMPLATES.filter(t => t.cat !== 'Housing'));
      transactions.push({
        userId: user.id,
        date: new Date(randomDate(year, month)),
        description: template.desc,
        amount: -randomBetween(template.min, template.max),
        category: template.cat,
        account: pick(['Checking', 'Credit Card']),
      });
    }

    // Transfer to savings (monthly)
    if (Math.random() > 0.2) {
      const saveAmt = randomBetween(200, 600);
      transactions.push({
        userId: user.id,
        date: new Date(`${year}-${String(month).padStart(2, '0')}-05`),
        description: 'Transfer to Savings',
        amount: -saveAmt,
        category: 'Savings',
        account: 'Checking',
        transferPairId: `xfer-${year}-${month}`,
      });
      transactions.push({
        userId: user.id,
        date: new Date(`${year}-${String(month).padStart(2, '0')}-05`),
        description: 'Transfer from Checking',
        amount: saveAmt,
        category: 'Savings',
        account: 'Savings',
        transferPairId: `xfer-${year}-${month}`,
      });
    }
  }

  // Bulk insert
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.transaction.createMany({ data: transactions });
  console.log(`✓ ${transactions.length} transactions created (12 months)`);

  // 4. Merchant rules
  const rules = [
    { merchant: 'WHOLE FOODS', category: 'Groceries' },
    { merchant: 'TRADER JOE', category: 'Groceries' },
    { merchant: 'CHIPOTLE', category: 'Restaurants' },
    { merchant: 'STARBUCKS', category: 'Restaurants' },
    { merchant: 'AMAZON', category: 'Shopping' },
    { merchant: 'NETFLIX', category: 'Subscriptions' },
    { merchant: 'SPOTIFY', category: 'Subscriptions' },
    { merchant: 'SHELL', category: 'Transportation' },
    { merchant: 'NATIONAL GRID', category: 'Utilities' },
  ];
  await prisma.merchantRule.deleteMany({ where: { userId: user.id } });
  await prisma.merchantRule.createMany({
    data: rules.map(r => ({ userId: user.id, ...r })),
  });
  console.log(`✓ ${rules.length} merchant rules`);

  // 5. Savings goals
  await prisma.savingsGoal.deleteMany({ where: { userId: user.id } });
  const emergencyGoal = await prisma.savingsGoal.create({
    data: {
      userId: user.id,
      name: 'Emergency Fund',
      targetAmount: 15000,
      currentAmount: 8400,
      deadline: new Date(now.getFullYear() + 1, 5, 30),
      priority: 'high',
      color: '#0EA5E9',
    },
  });
  const vacationGoal = await prisma.savingsGoal.create({
    data: {
      userId: user.id,
      name: 'Japan Vacation',
      targetAmount: 5000,
      currentAmount: 1750,
      deadline: new Date(now.getFullYear() + 1, 2, 15),
      priority: 'medium',
      color: '#8B5CF6',
    },
  });
  await prisma.savingsGoal.create({
    data: {
      userId: user.id,
      name: 'New Laptop',
      targetAmount: 2000,
      currentAmount: 650,
      priority: 'low',
      color: '#F59E0B',
    },
  });
  console.log('✓ 3 savings goals');

  // Goal contributions
  await prisma.goalContribution.createMany({
    data: [
      { goalId: emergencyGoal.id, amount: 400, date: new Date(now.getFullYear(), now.getMonth() - 2, 5), note: 'Monthly auto-save' },
      { goalId: emergencyGoal.id, amount: 400, date: new Date(now.getFullYear(), now.getMonth() - 1, 5), note: 'Monthly auto-save' },
      { goalId: emergencyGoal.id, amount: 500, date: new Date(now.getFullYear(), now.getMonth(), 5), note: 'Bonus deposit' },
      { goalId: vacationGoal.id, amount: 250, date: new Date(now.getFullYear(), now.getMonth() - 1, 10) },
      { goalId: vacationGoal.id, amount: 250, date: new Date(now.getFullYear(), now.getMonth(), 10) },
    ],
  });
  console.log('✓ Goal contributions');

  // 6. Debts
  await prisma.debt.deleteMany({ where: { userId: user.id } });
  await prisma.debt.createMany({
    data: [
      {
        userId: user.id,
        name: 'Student Loan',
        balance: 18500,
        originalBalance: 35000,
        interestRate: 4.5,
        minimumPayment: 350,
        extraPayment: 50,
        type: 'student',
        dueDay: 15,
      },
      {
        userId: user.id,
        name: 'Credit Card',
        balance: 2100,
        originalBalance: 4500,
        interestRate: 19.99,
        minimumPayment: 65,
        extraPayment: 100,
        type: 'credit_card',
        dueDay: 25,
      },
    ],
  });
  console.log('✓ 2 debts');

  // 7. Assets
  await prisma.asset.deleteMany({ where: { userId: user.id } });
  await prisma.asset.createMany({
    data: [
      { userId: user.id, name: 'Checking Account', value: 4200, type: 'checking' },
      { userId: user.id, name: 'Savings Account', value: 12800, type: 'savings' },
      { userId: user.id, name: '401(k)', value: 28500, type: 'retirement' },
      { userId: user.id, name: 'Roth IRA', value: 8200, type: 'investment' },
      { userId: user.id, name: 'Car (2019 Honda Civic)', value: 12000, type: 'vehicle' },
    ],
  });
  console.log('✓ 5 assets');

  // 8. Net worth snapshots (monthly for 6 months)
  await prisma.netWorthSnapshot.deleteMany({ where: { userId: user.id } });
  const snapshots = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const assets = 60000 + (5 - i) * randomBetween(800, 1500);
    const liabilities = 22000 - (5 - i) * randomBetween(300, 500);
    snapshots.push({
      userId: user.id,
      date: d,
      assets: Math.round(assets * 100) / 100,
      liabilities: Math.round(liabilities * 100) / 100,
      netWorth: Math.round((assets - liabilities) * 100) / 100,
    });
  }
  await prisma.netWorthSnapshot.createMany({ data: snapshots });
  console.log('✓ 6 net worth snapshots');

  // 9. Budgets
  await prisma.budget.deleteMany({ where: { userId: user.id } });
  await prisma.budget.createMany({
    data: [
      { userId: user.id, category: 'Groceries', monthlyLimit: 400 },
      { userId: user.id, category: 'Restaurants', monthlyLimit: 200 },
      { userId: user.id, category: 'Shopping', monthlyLimit: 150 },
      { userId: user.id, category: 'Entertainment', monthlyLimit: 100 },
      { userId: user.id, category: 'Transportation', monthlyLimit: 250 },
      { userId: user.id, category: 'Subscriptions', monthlyLimit: 60 },
    ],
  });
  console.log('✓ 6 budgets');

  // 10. Calendar events
  await prisma.calendarEvent.deleteMany({ where: { userId: user.id } });
  await prisma.calendarEvent.createMany({
    data: [
      { userId: user.id, title: 'Rent Due', date: new Date(now.getFullYear(), now.getMonth() + 1, 1), amount: 1850, type: 'bill', recurring: 'monthly' },
      { userId: user.id, title: 'Payday', date: new Date(now.getFullYear(), now.getMonth(), 15), type: 'payday', recurring: 'biweekly' },
      { userId: user.id, title: 'Student Loan Payment', date: new Date(now.getFullYear(), now.getMonth() + 1, 15), amount: 400, type: 'bill', recurring: 'monthly' },
      { userId: user.id, title: 'Car Insurance', date: new Date(now.getFullYear(), now.getMonth() + 1, 20), amount: 125, type: 'bill', recurring: 'monthly' },
    ],
  });
  console.log('✓ 4 calendar events');

  // 11. Subscriptions
  await prisma.subscription.deleteMany({ where: { userId: user.id } });
  await prisma.subscription.createMany({
    data: [
      { userId: user.id, name: 'Netflix', amount: 15.49, frequency: 'monthly', category: 'Subscriptions', isActive: true, isAutoDetected: true },
      { userId: user.id, name: 'Spotify', amount: 10.99, frequency: 'monthly', category: 'Subscriptions', isActive: true, isAutoDetected: true },
      { userId: user.id, name: 'YouTube Premium', amount: 13.99, frequency: 'monthly', category: 'Subscriptions', isActive: true },
      { userId: user.id, name: 'iCloud+', amount: 2.99, frequency: 'monthly', category: 'Subscriptions', isActive: true },
      { userId: user.id, name: 'Adobe Creative Cloud', amount: 54.99, frequency: 'monthly', category: 'Subscriptions', isActive: false },
    ],
  });
  console.log('✓ 5 subscriptions');

  // 12. Settings
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, darkMode: false, currency: 'USD' },
    update: {},
  });
  console.log('✓ User settings');

  console.log('\n🎉 Seed complete!');
  console.log('───────────────────────');
  console.log('Login: demo@futuresight.app');
  console.log('Password: Demo1234');
  console.log('───────────────────────\n');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
