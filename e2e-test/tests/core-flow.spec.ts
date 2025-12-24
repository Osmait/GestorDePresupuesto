
import { test, expect } from '@playwright/test';

test('Core Flow: Login (Demo), Create Account, Category, Transaction', async ({ page }) => {
  // 1. Login as Demo User
  await page.goto('/login');

  // Click "Try Interactive Demo" button
  await page.getByRole('button', { name: /Try Interactive Demo|Probar Demo Interactiva/i }).click();

  // Wait for dashboard redirection
  await page.waitForURL('**/app', { timeout: 60000 });

  // --- Handle Demo Welcome Modal ---
  // The demo mode shows a driver.js popover/dialog. We need to close it.
  try {
    const welcomeDialog = page.getByRole('dialog', { name: /Bienvenido al Modo Demo|Welcome to Demo/i });
    // Wait a short time for it to appear
    await welcomeDialog.waitFor({ state: 'visible', timeout: 3000 });
    // Close it
    await welcomeDialog.getByRole('button', { name: /close|cerrar|×/i }).click();
    await expect(welcomeDialog).not.toBeVisible();
  } catch (e) {
    // It might not appear or already be closed, ignore.
    console.log('Demo welcome modal did not appear or was missed.');
  }

  // --- 2. Create Account ---
  // Open Quick Actions menu (Plus icon button)
  // We locate the button inside the header that contains the Plus icon
  const quickActionsBtn = page.locator('header button').filter({ has: page.locator('svg.lucide-plus') });
  await quickActionsBtn.click();

  // Click "New Account" menu item
  // Note: Adjust text if localization differs (e.g. "Nueva Cuenta" vs "New Account"). 
  // We use a lenient text matcher or the specific translated string if known.
  // Assuming Spanish based on "GestorDePresupuesto" and "Juan".
  // Fallback to English if needed. The keys are 'newAccount', 'newCategory', etc.
  // Let's try matching part of the text.
  await page.getByRole('menuitem').filter({ hasText: /Account|Cuenta/i }).click();

  // Account Modal should be open. Use specific name to avoid ambiguity.
  const accountModal = page.getByRole('dialog', { name: /Account|Cuenta/i });
  await expect(accountModal).toBeVisible();

  // Fill Account Form
  const accountName = `TestBank ${Date.now()}`;
  await accountModal.locator('input[name="name"]').fill(accountName);
  await accountModal.locator('input[name="bank"]').fill('TestBank');
  await accountModal.locator('input[name="initial_balance"]').fill('1000');

  // Submit Account
  await accountModal.locator('button[type="submit"]').click();

  // Wait for modal to close
  await expect(accountModal).not.toBeVisible();


  // --- 3. Create Category ---
  await quickActionsBtn.click();
  await page.getByRole('menuitem').filter({ hasText: /Category|Categoría/i }).click();

  const categoryModal = page.getByRole('dialog', { name: /Category|Categoría/i });
  await expect(categoryModal).toBeVisible();

  // Fill Category Form
  const categoryName = `TestCat ${Date.now()}`;
  await categoryModal.locator('input[id="name"]').fill(categoryName); // Using input[id="name"] to be safe of strict variations

  // Select an icon (first one)
  await categoryModal.locator('button.text-2xl').first().click();

  // Select a color (first one)
  await categoryModal.locator('.w-6.h-6.rounded-full').first().click();

  // Submit Category
  // Note: CategoryFormModal button is outside the form and handles click, might not be type="submit"
  await categoryModal.getByRole('button', { name: /Create|Crear/i }).click();

  // Wait for modal to close
  await expect(categoryModal).not.toBeVisible();


  // --- 4. Create Transaction ---
  await quickActionsBtn.click();
  await page.getByRole('menuitem').filter({ hasText: /Transaction|Transacción/i }).click();

  const transactionModal = page.getByRole('dialog', { name: /Transaction|Transacción/i });
  await expect(transactionModal).toBeVisible();

  // Fill Transaction Form
  await transactionModal.locator('input[name="name"]').fill('Test Transaction');
  await transactionModal.locator('input[name="amount"]').fill('50.00');

  // Select Account (combobox)
  // 1st Select: Type (Index 0)
  // 2nd Select: Account (Index 1)
  // 3rd Select: Category (Index 2)

  const selects = transactionModal.locator('button[role="combobox"]');

  // Set Account
  await selects.nth(1).click();
  // Wait for options and select our account
  await page.getByRole('option', { name: accountName }).first().click();

  // Set Category
  await selects.nth(2).click();
  await page.getByRole('option', { name: categoryName }).first().click();

  // Submit Transaction
  await transactionModal.locator('button[type="submit"]').click();

  // Wait for modal to close
  await expect(transactionModal).not.toBeVisible();

  // Basic verification
  await expect(page.locator('header')).toBeVisible();
});
