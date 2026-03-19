import { expect, type Page } from '@playwright/test'

export async function closeDemoWelcomeModal(page: Page): Promise<void> {
	try {
		const welcomeDialog = page.getByRole('dialog', { name: /Bienvenido al Modo Demo|Welcome to Demo/i })
		await welcomeDialog.waitFor({ state: 'visible', timeout: 3000 })
		await welcomeDialog.getByRole('button', { name: /close|cerrar|×/i }).click()
		await expect(welcomeDialog).not.toBeVisible()
	} catch {
		// Modal is not always present
	}
}

/** Marks all demo tour keys as seen so driver.js never shows the overlay */
const DISABLE_DEMO_TOUR_SCRIPT = () => {
	const tourKeys = [
		'hasSeenDemoTour_dashboard',
		'hasSeenDemoTour_accounts',
		'hasSeenDemoTour_categories',
		'hasSeenDemoTour_budgets',
		'hasSeenDemoTour_transactions',
		'hasSeenDemoTour_investments',
		'hasSeenDemoTour_recurring',
	]
	tourKeys.forEach(key => sessionStorage.setItem(key, 'true'))
}

export async function gotoApp(page: Page): Promise<void> {
	// Prevent driver.js demo tours from covering the page — the demo user always triggers them
	await page.addInitScript(DISABLE_DEMO_TOUR_SCRIPT)
	await page.goto('/app')
	await expect(page.locator('header')).toBeVisible({ timeout: 120000 })
	await closeDemoWelcomeModal(page)
}

export async function openQuickActions(page: Page): Promise<void> {
	const quickActionsBtn = page.locator('header button').filter({ has: page.locator('svg.lucide-plus') }).first()
	await quickActionsBtn.click()
}

export async function createBankAccountFromQuickActions(page: Page, accountName: string): Promise<void> {
	await openQuickActions(page)
	await page.getByRole('menuitem').filter({ hasText: /Account|Cuenta/i }).click()

	const accountModal = page.getByRole('dialog', { name: /Account|Cuenta/i })
	await expect(accountModal).toBeVisible()

	await accountModal.locator('input[name="name"]').fill(accountName)
	await accountModal.locator('input[name="bank"]').fill('E2E Bank')
	await accountModal.locator('input[name="initial_balance"]').fill('5000')

	await accountModal.locator('button[type="submit"]').click()
	await expect(accountModal).not.toBeVisible({ timeout: 15000 })
}
