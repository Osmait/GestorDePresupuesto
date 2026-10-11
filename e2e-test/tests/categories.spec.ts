import { test, expect } from '@playwright/test'
import { gotoApp } from './helpers/app'

test.describe('Categories @prod-write', () => {
	test('create, edit and delete a category', async ({ page }) => {
		await gotoApp(page)

		// Navigate to the categories page
		await page.locator('a[href="/app/category"]').first().click()
		await page.waitForURL('**/app/category')
		await expect(page.locator('h1').first()).toBeVisible()

		// --- CREATE ---
		const categoryName = `E2E-CAT-${Date.now()}`

		// #add-category-btn is a div wrapper; click the button inside it
		await page.locator('#add-category-btn button').click()

		const createDialog = page.getByRole('dialog')
		await expect(createDialog).toBeVisible()

		await createDialog.locator('input[name="name"]').fill(categoryName)
		await createDialog.getByRole('group', { name: /Icon|Icono/i }).getByRole('button').first().click()
		await createDialog.getByRole('group', { name: /^Color$/i }).getByRole('button').first().click()
		await createDialog.getByRole('button', { name: /Create|Crear/i }).click()
		await expect(createDialog).not.toBeVisible({ timeout: 15000 })

		await expect(page.getByText(categoryName).first()).toBeVisible({ timeout: 10000 })

		// --- EDIT ---
		// The card's action menu is always visible (keyboard and touch friendly)
		const categoryCard = page.locator('[id^="category-card-"]').filter({ hasText: categoryName }).first()
		await categoryCard.getByRole('button', { name: /^(Acciones de|Actions for) /i }).click()
		await page.getByRole('menuitem', { name: /Edit|Editar/i }).click()

		const editDialog = page.getByRole('dialog')
		await expect(editDialog).toBeVisible()

		const editedName = `${categoryName}-EDITED`
		const nameInput = editDialog.locator('input[name="name"]')
		await nameInput.clear()
		await nameInput.fill(editedName)
		await editDialog.getByRole('button', { name: /Save|Guardar/i }).click()
		await expect(editDialog).not.toBeVisible({ timeout: 15000 })

		await expect(page.getByText(editedName).first()).toBeVisible({ timeout: 10000 })

		// --- DELETE ---
		const editedCard = page.locator('[id^="category-card-"]').filter({ hasText: editedName }).first()
		await editedCard.getByRole('button', { name: /^(Acciones de|Actions for) /i }).click()
		await page.getByRole('menuitem', { name: /Delete|Eliminar/i }).click()

		const deleteDialog = page.getByRole('alertdialog')
		await expect(deleteDialog).toBeVisible()
		await deleteDialog.getByRole('button', { name: /^(Delete|Eliminar)$/i }).click()

		// Scope assertion to the category card (editedName also appears in the dialog title)
		await expect(editedCard).not.toBeVisible({ timeout: 15000 })
	})
})
