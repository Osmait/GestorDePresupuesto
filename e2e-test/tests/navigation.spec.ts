
import { test, expect } from '@playwright/test';

test.describe('Navigation & Sections', () => {
    test.beforeEach(async ({ page }) => {
        // Login
        await page.goto('/login');
        await page.waitForLoadState('networkidle');
        await page.getByRole('button', { name: /Try Interactive Demo|Probar Demo Interactiva/i }).click();
        await page.waitForURL('**/app', { timeout: 120000 });

        // Handle Demo Welcome Modal
        try {
            const welcomeDialog = page.getByRole('dialog', { name: /Bienvenido al Modo Demo|Welcome to Demo/i });
            await welcomeDialog.waitFor({ state: 'visible', timeout: 5000 });
            await welcomeDialog.getByRole('button', { name: /close|cerrar|×/i }).click();
        } catch (e) {
            console.log('Demo welcome modal did not appear or was missed.');
        }
    });

    const sections = [
        { name: 'Cuentas', href: '/app/accounts', heading: /Cuentas|Accounts/i },
        { name: 'Categorías', href: '/app/category', heading: /Categorías|Categories/i },
        { name: 'Transacciones', href: '/app/transactions', heading: /Transacciones|Transactions/i },
        { name: 'Presupuestos', href: '/app/budget', heading: /Presupuestos|Budgets/i },
        { name: 'Inversiones', href: '/app/investments', heading: /Inversiones|Investments/i },
        { name: 'Analíticas', href: '/app/analysis', heading: /Analíticas|Analytics/i },
    ];

    for (const section of sections) {
        test(`Navigate to ${section.name}`, async ({ page }) => {
            // Click Sidebar link
            // Use a robust selector for sidebar links
            // They are usually in a <nav> or just verify link role
            // Assuming Sidebar is visible on desktop

            await page.getByRole('link', { name: section.name }).click();

            // Verify URL
            await page.waitForURL(`**${section.href}`);

            // Verify Heading
            // The header often contains the title of the section
            await expect(page.getByRole('heading', { level: 1, name: section.heading })).toBeVisible();
        });
    }
});
