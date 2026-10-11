import { test, expect } from '@playwright/test'
import { gotoApp } from './helpers/app'

/** `YYYY-MM` of the month before `date`. */
function previousMonthKey(date: Date): string {
	const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1)
	return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
}

test.describe('Analysis', () => {
	test('shows the report and navigates periods through the URL', async ({ page }) => {
		await gotoApp(page)

		// --- 1. Navigate to the Analysis page ---
		await page.locator('a[href="/app/analysis"]').first().click()
		await page.waitForURL('**/app/analysis**')
		await expect(page.getByRole('heading', { level: 1, name: /Analíticas|Analytics/i })).toBeVisible({ timeout: 10000 })

		// --- 2. The report (or its empty state) renders for the current month ---
		const hero = page.getByRole('heading', { level: 2, name: /Gastaste|You spent/i })
		const empty = page.getByRole('heading', { name: /No hay datos para este período|No data for this period/i })
		await expect(hero.or(empty).first()).toBeVisible({ timeout: 15000 })

		if (await hero.isVisible()) {
			for (const name of [/Qué cambió|What changed/i, /Últimos 6 meses|Last 6 months/i, /Gastos más grandes|Largest expenses/i]) {
				await expect(page.getByRole('region', { name })).toBeVisible()
			}
		}

		// --- 3. "Next month" is disabled on the current month ---
		const periodGroup = page.getByRole('group', { name: /^Período$|^Period$/ }).filter({ visible: true })
		await expect(periodGroup.getByRole('button', { name: /Mes siguiente|Next month/i })).toBeDisabled()

		// --- 4. "Previous month" moves the report back one month and writes it to the URL ---
		const expected = previousMonthKey(new Date())
		await periodGroup.getByRole('button', { name: /Mes anterior|Previous month/i }).click()
		await expect(page).toHaveURL(new RegExp(`[?&]period=${expected}(&|$)`))
		await expect(periodGroup.getByRole('button', { name: /Mes siguiente|Next month/i })).toBeEnabled()
		await expect(hero.or(empty).first()).toBeVisible({ timeout: 15000 })

		// --- 5. The period survives a reload ---
		await page.reload()
		await expect(page).toHaveURL(new RegExp(`[?&]period=${expected}(&|$)`))
		await expect(hero.or(empty).first()).toBeVisible({ timeout: 15000 })

		// --- 6. The old floating tools are gone ---
		await expect(page.getByRole('button', { name: /^Herramientas$|^Tools$/i })).toHaveCount(0)
	})
})
