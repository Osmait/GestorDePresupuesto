import { test, expect } from '@playwright/test'
import { gotoApp } from './helpers/app'

test.describe('Analysis', () => {
	test('loads and filters analytics', async ({ page }) => {
		await gotoApp(page)

		// --- 1. Navigate to the Analysis page ---
		await page.locator('a[href="/app/analysis"]').first().click()
		await page.waitForURL('**/app/analysis')

		// --- 2. Assert the page heading is visible ---
		await expect(page.getByRole('heading', { level: 1, name: /Analíticas|Analytics/i })).toBeVisible({ timeout: 10000 })

		// --- 3. Assert summary cards with income/expenses are visible ---
		await expect(page.getByText(/Ingresos|Income|Gastos|Expenses/i).first()).toBeVisible({ timeout: 10000 })

		// --- 4. Open the filter dialog ---
		await page.getByRole('button', { name: /^Filtrar$|^Filter$/i }).click()

		const filterDialog = page.getByRole('dialog', { name: /Filtrar Analíticas|Filter Analytics/i })
		await expect(filterDialog).toBeVisible()

		// --- 5. Clear filters and close the dialog ---
		await filterDialog.getByRole('button', { name: /Limpiar Filtros|Clear Filters/i }).click()
		await filterDialog.getByRole('button', { name: /Cerrar|Close/i }).click()

		// --- 6. Assert the dialog is dismissed ---
		await expect(filterDialog).not.toBeVisible()
	})
})
