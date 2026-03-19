import { test, expect } from '@playwright/test'
import { createBankAccountFromQuickActions, gotoApp } from './helpers/app'

test.describe('Accounts @prod-write', () => {
	test('create, edit and delete an account', async ({ page }) => {
		await gotoApp(page)

		// --- 1. Create the bank account via quick actions ---
		const accountName = `E2E-ACC-${Date.now()}`
		await createBankAccountFromQuickActions(page, accountName)

		// --- 2. Navigate to the Accounts page ---
		await page.locator('a[href="/app/accounts"]').first().click()
		await page.waitForURL('**/app/accounts')
		await expect(page.locator('h1').first()).toBeVisible()

		// Assert the created account appears on the page
		await expect(page.getByText(accountName).first()).toBeVisible({ timeout: 10000 })

		// --- 3. Open the card dropdown and click Edit ---
		// Fresh DB → only one account card → click the only MoreHorizontal button
		await page.locator('button').filter({ has: page.locator('svg.lucide-ellipsis') }).first().click()
		await page.getByRole('menuitem', { name: /Edit|Editar/i }).click()

		const editModal = page.getByRole('dialog')
		await expect(editModal).toBeVisible()

		const updatedName = `${accountName}-EDITED`
		await editModal.locator('input[name="name"]').fill(updatedName)
		await editModal.locator('input[name="bank"]').fill('Updated Bank')

		// Account edit submit is hardcoded "Actualizar Cuenta" (not i18n)
		await editModal.getByRole('button', { name: /Actualizar|Update|Save|Guardar/i }).click()
		await expect(editModal).not.toBeVisible({ timeout: 15000 })

		// --- 4. Assert the updated name is visible ---
		await expect(page.getByText(updatedName).first()).toBeVisible({ timeout: 10000 })

		// --- 5. Delete the account ---
		await page.locator('button').filter({ has: page.locator('svg.lucide-ellipsis') }).first().click()
		await page.getByRole('menuitem', { name: /Delete|Eliminar/i }).click()

		const deleteDialog = page.getByRole('dialog').last()
		await expect(deleteDialog).toBeVisible()
		await deleteDialog.getByRole('button', { name: /Delete|Eliminar/i }).last().click()

		await expect(page.getByText(updatedName).first()).not.toBeVisible({ timeout: 15000 })
	})
})
