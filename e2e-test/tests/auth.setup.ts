import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
    // 1. Perform login steps
    await page.goto('/login');

    // Wait for the specific interactive element 
    const demoButton = page.getByRole('button', { name: /Try Interactive Demo|Probar Demo Interactiva/i });
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // Wait for dashboard redirection
    await page.waitForURL('**/app', { timeout: 120000 });

    // Handle Demo Welcome Modal if present
    try {
        const welcomeDialog = page.getByRole('dialog', { name: /Bienvenido al Modo Demo|Welcome to Demo/i });
        // Short timeout check
        await welcomeDialog.waitFor({ state: 'visible', timeout: 5000 });
        await welcomeDialog.getByRole('button', { name: /close|cerrar|×/i }).click();
    } catch (e) {
        // Ignore if not present
    }

    // 2. Save storage state
    await page.context().storageState({ path: authFile });
});
