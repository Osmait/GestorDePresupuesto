
import { test, expect } from '@playwright/test';

test.describe('Appearance & Settings', () => {
    test.beforeEach(async ({ page }) => {
        console.log("$E2E_TARGET_URL", process.env.E2E_TARGET_URL);
        // Go to dashboard
        await page.goto('/app');

        // Handle Demo Welcome Modal
        try {
            const welcomeDialog = page.getByRole('dialog', { name: /Bienvenido al Modo Demo|Welcome to Demo/i });
            await welcomeDialog.waitFor({ state: 'visible', timeout: 5000 });
            await welcomeDialog.getByRole('button', { name: /close|cerrar|×/i }).click();
            await expect(welcomeDialog).not.toBeVisible();
        } catch (e) {
            // console.log('Demo welcome modal did not appear or was missed.');
        }
    });

    test('Toggle Dark Mode', async ({ page }) => {
        // Open User Dropdown
        const userAvatarBtn = page.getByRole('button').filter({ has: page.locator('span.relative.h-8.w-8') });
        // Or closer selector: UserNav renders a Button with variant ghost and relative h-8 w-8

        // Let's rely on the structure or the fact it's likely the only avatar button in header?
        // UserNav shows initials. 
        await page.locator('header').getByRole('button').last().click(); // Usually UserNav is last

        // Check for "Tema" text
        await expect(page.getByText('Tema', { exact: true })).toBeVisible();

        // Click Mode Toggle. It's inside the dropdown.
        // The component <ModeToggle /> usually renders a button with Sun/Moon icon.
        // Let's look for the dropdown item containing it or the button itself.
        // In UserNav, it's: <div className="flex items-center justify-center gap-2"><ModeToggle /></div>
        // ModeToggle usually has "Toggle theme" aria-label? Or just icons.

        // We can assume the dropdown is open. Look for button with Moon/Sun.

        // 1. Click the toggle button to open the Theme menu
        await page.locator('.px-2').filter({ has: page.getByText('Tema', { exact: true }) }).getByRole('button').click();

        // 2. Click "Dark" option from the dropdown
        await page.getByRole('menuitem', { name: /Dark|Oscuro/i }).click();

        // Check HTML class
        // Wait for class change
        await expect(page.locator('html')).toHaveClass(/dark/);

        // Toggle back
        await page.locator('.px-2').filter({ has: page.getByText('Tema', { exact: true }) }).getByRole('button').click();
        await page.getByRole('menuitem', { name: /Light|Claro/i }).click();
        await expect(page.locator('html')).not.toHaveClass(/dark/);
    });

    test('Switch Language', async ({ page }) => {
        // Initial check (assuming ES default or current)
        // Sidebar should have "Presupuestos" or "Budgets".
        // Let's check the Header Title or a generic text.
        // "Dashboard" is same in both? No.
        // ES: "Panel"? "Dashboard" seems used in ES too in snapshot.
        // Let's check "Gastos por Categoría" (ES) vs "Expenses by Category" (EN).

        // Note: The app might persist language in cookie. 
        // If previous test changed it, it might stick.
        // But Incognito/new Context usually clears cookies unless persisted?
        // Playwright creates new context per test.

        // Open User Dropdown
        await page.locator('header').getByRole('button').last().click();

        // Find Language buttons
        const enBtn = page.getByRole('button', { name: 'EN', exact: true });

        await enBtn.click();

        // Wait for reload
        await page.waitForLoadState('domcontentloaded');
        try {
            // Handle Demo Welcome Modal AGAIN because reload happens
            const welcomeDialog = page.getByRole('dialog', { name: /Welcome to Demo/i });
            await welcomeDialog.waitFor({ state: 'visible', timeout: 5000 });
            await welcomeDialog.getByRole('button', { name: /close/i }).click();
        } catch { }

        // Verify English text
        await expect(page.locator('h3', { hasText: /Expenses by Category/i }).first()).toBeVisible();

        // Switch back to ES
        await page.locator('header').getByRole('button').last().click();
        await page.getByRole('button', { name: 'ES', exact: true }).click();

        await page.waitForLoadState('domcontentloaded');
        // Handle modal
        try {
            const welcomeDialog = page.getByRole('dialog', { name: /Bienvenido al Modo Demo/i });
            await welcomeDialog.waitFor({ state: 'visible', timeout: 5000 });
            await welcomeDialog.getByRole('button', { name: /cerrar|×/i }).click();
        } catch { }

        // Verify Spanish text
        await expect(page.locator('h3', { hasText: /Gastos por Categoría/i }).first()).toBeVisible();
    });
});
