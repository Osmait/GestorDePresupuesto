import { test, expect } from '@playwright/test'
import { gotoApp, openQuickActions } from './helpers/app'

test.describe('Budgets @prod-write', () => {
	test('create, edit and delete a budget', async ({ page }) => {
		await gotoApp(page)

		// --- 1. Create a category (budgets require a category) ---
		const categoryName = `E2E-CAT-${Date.now()}`

		await openQuickActions(page)
		await page.getByRole('menuitem').filter({ hasText: /Category|Categoría/i }).click()

		const categoryModal = page.getByRole('dialog', { name: /Category|Categoría/i })
		await expect(categoryModal).toBeVisible()
		await categoryModal.locator('input[name="name"]').fill(categoryName)
		await categoryModal.locator('button.text-2xl').first().click()
		await categoryModal.locator('.w-6.h-6.rounded-full').first().click()
		await categoryModal.getByRole('button', { name: /Create|Crear/i }).click()
		await expect(categoryModal).not.toBeVisible({ timeout: 15000 })

		// --- 2. Navigate to the Budget page ---
		await page.locator('a[href="/app/budget"]').first().click()
		await page.waitForURL('**/app/budget')
		await expect(page.locator('h1').first()).toBeVisible()

		// --- 3. Open the add-budget dialog ---
		// #add-budget-btn is a div wrapper; click the button inside it
		await page.locator('#add-budget-btn button').click()

		const addDialog = page.getByRole('dialog')
		await expect(addDialog).toBeVisible()

		await addDialog.locator('button[role="combobox"]').first().click()
		await page.getByRole('option', { name: new RegExp(categoryName) }).first().click()
		await addDialog.locator('input[name="amount"]').fill('500')
		await addDialog.getByRole('button', { name: /Create|Crear/i }).click()
		await expect(addDialog).not.toBeVisible({ timeout: 15000 })

		// --- 4. Assert the budget card is visible ---
		await expect(page.getByText(categoryName).first()).toBeVisible({ timeout: 10000 })

		// --- 5. Edit the budget ---
		// Scope to the specific budget card to avoid Framer Motion animation issues
		const budgetCard = page.locator('[id^="budget-card-"]').filter({ hasText: categoryName })
		await expect(budgetCard).toBeVisible({ timeout: 10000 })
		// force: true bypasses the CardContent div intercepting clicks at the button center
		await budgetCard.getByRole('button', { name: /Editar presupuesto|Edit budget/i }).click({ force: true })
		await page.getByRole('menuitem', { name: /Edit|Editar/i }).click()

		const editDialog = page.getByRole('dialog')
		await expect(editDialog).toBeVisible()
		const amountInput = editDialog.locator('input[name="amount"]')
		await amountInput.clear()
		await amountInput.fill('750')
		await editDialog.getByRole('button', { name: /Save|Guardar/i }).click()
		await expect(editDialog).not.toBeVisible({ timeout: 15000 })

		await expect(page.getByText('750').first()).toBeVisible({ timeout: 10000 })

		// --- 6. Delete the budget ---
		// The card's onClick navigates away, so ensure we're on the budget page
		await page.locator('a[href="/app/budget"]').first().click()
		await page.waitForURL('**/app/budget')
		const budgetCardForDelete = page.locator('[id^="budget-card-"]').filter({ hasText: categoryName })
		await expect(budgetCardForDelete).toBeVisible({ timeout: 10000 })
		await budgetCardForDelete.getByRole('button', { name: /Editar presupuesto|Edit budget/i }).click({ force: true })
		await page.getByRole('menuitem', { name: /Delete|Eliminar/i }).click()

		const deleteDialog = page.getByRole('dialog').last()
		await expect(deleteDialog).toBeVisible()
		await deleteDialog.getByRole('button', { name: /Delete|Eliminar/i }).last().click()

		// Scope assertion to the budget card (categoryName appears in multiple places on the card)
		await expect(budgetCard).not.toBeVisible({ timeout: 15000 })
	})
})
