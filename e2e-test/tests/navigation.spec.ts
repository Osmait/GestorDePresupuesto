import { test, expect } from '@playwright/test';

test.describe('Navigation & Sections', () => {
    test.beforeEach(async ({ page }) => {
        // Go to dashboard, assuming already logged in via global setup
        await page.goto('/app');
        // Handle Welcome Modal if it appears (might not if auth state persisted visited state)
        // But keep the handler just in case
        try {
            const welcomeDialog = page.getByRole('dialog', { name: /Bienvenido al Modo Demo|Welcome to Demo/i });
            await welcomeDialog.waitFor({ state: 'visible', timeout: 5000 });
            await welcomeDialog.getByRole('button', { name: /close|cerrar|×/i }).click();
        } catch (e) {
            // Ignore
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
            await page.getByRole('link', { name: section.name }).click();

            // Verify URL (fixed glob pattern)
            await page.waitForURL(`**${section.href}`);

            // Verify Heading
            await expect(page.getByRole('heading', { level: 1, name: section.heading })).toBeVisible();
        });
    }
});
