import { test, expect } from '@playwright/test'
import { gotoApp } from './helpers/app'

test.describe('Monthly Plan @prod-write', () => {
	test('create income and fixed expense, see the totals, then pause and delete', async ({ page }) => {
		await gotoApp(page)

		// --- 1. Navigate to the Monthly Plan page from the sidebar ---
		await page.locator('a[href="/app/monthly"]').first().click()
		await page.waitForURL('**/app/monthly')
		await expect(page.locator('h1').first()).toBeVisible()

		const incomeName = `E2E-INCOME-${Date.now()}`
		const expenseName = `E2E-EXPENSE-${Date.now()}`

		// Fills and submits the plan item dialog.
		async function createItem(name: string, amount: string, type: 'income' | 'bill', day: string) {
			await page.locator('#add-monthly-plan-btn button').click()

			const dialog = page.getByRole('dialog')
			await expect(dialog).toBeVisible()

			await dialog.locator('input[name="name"]').fill(name)

			// The type select is the first combobox in the form.
			await dialog.locator('button[role="combobox"]').first().click()
			await page
				.getByRole('option', { name: type === 'income' ? /Income|Ingreso/i : /Fixed expense|Gasto fijo/i })
				.first()
				.click()

			await dialog.locator('input[name="amount"]').fill(amount)
			await dialog.locator('input[name="day_of_month"]').fill(day)

			await dialog.getByRole('button', { name: /Create|Crear/i }).click()
			await expect(dialog).not.toBeVisible({ timeout: 15000 })
		}

		// --- 2. Create an expected income ---
		await createItem(incomeName, '85000', 'income', '30')
		await expect(page.getByText(incomeName).first()).toBeVisible({ timeout: 10000 })

		// --- 3. Create a fixed expense ---
		await createItem(expenseName, '25000', 'bill', '1')
		await expect(page.getByText(expenseName).first()).toBeVisible({ timeout: 10000 })

		// --- 4. The summary card shows the four totals ---
		await expect(page.getByTestId('summary-income')).toBeVisible()
		await expect(page.getByTestId('summary-expenses')).toBeVisible()
		await expect(page.getByTestId('summary-available')).toBeVisible()
		await expect(page.getByTestId('summary-committed')).toBeVisible()

		// --- 5. Both columns show their own total ---
		await expect(page.getByTestId('column-total-income')).toBeVisible()
		await expect(page.getByTestId('column-total-bill')).toBeVisible()

		// --- 6. The timeline places the expense on day 1 and the income on day 30 ---
		await expect(page.getByTestId('timeline-day-1')).toBeVisible()
		await expect(page.getByTestId('timeline-day-30')).toBeVisible()

		// Radix DropdownMenu listens to pointerdown, so dispatch the events directly.
		async function openItemMenu(name: string) {
			const row = page.locator('[data-testid^="plan-item-"]').filter({ hasText: name })
			await expect(row).toBeVisible({ timeout: 10000 })
			const trigger = row.getByRole('button').last()
			await trigger.evaluate((el) => {
				el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))
				el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }))
				el.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
			})
		}

		// --- 7. Pause the expense: it stays listed but stops counting ---
		await openItemMenu(expenseName)
		await page.getByRole('menuitem', { name: /Pause|Pausar/i }).click()

		const pausedRow = page.locator('[data-testid^="plan-item-"]').filter({ hasText: expenseName })
		await expect(pausedRow.getByText(/Paused|Pausado/i)).toBeVisible({ timeout: 10000 })

		// --- 8. Resume it again ---
		await openItemMenu(expenseName)
		await page.getByRole('menuitem', { name: /Resume|Reactivar/i }).click()
		await expect(pausedRow.getByText(/Paused|Pausado/i)).not.toBeVisible({ timeout: 10000 })

		// --- 9. Delete both items, accepting the confirm dialog ---
		page.on('dialog', (dialog) => dialog.accept())

		await openItemMenu(expenseName)
		await page.getByRole('menuitem', { name: /Delete|Eliminar/i }).click()
		await expect(page.getByText(expenseName)).toHaveCount(0, { timeout: 15000 })

		await openItemMenu(incomeName)
		await page.getByRole('menuitem', { name: /Delete|Eliminar/i }).click()
		await expect(page.getByText(incomeName)).toHaveCount(0, { timeout: 15000 })
	})
})
