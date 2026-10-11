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
		await page.getByRole('button', { name: new RegExp(`^(Acciones de|Actions for) ${accountName}$`) }).click()
		await page.getByRole('menuitem', { name: /Edit|Editar/i }).click()

		const editModal = page.getByRole('dialog')
		await expect(editModal).toBeVisible()

		const updatedName = `${accountName}-EDITED`
		await editModal.locator('input[name="name"]').fill(updatedName)
		await editModal.locator('input[name="bank"]').fill('Updated Bank')

		await editModal.getByRole('button', { name: /Save|Guardar/i }).click()
		await expect(editModal).not.toBeVisible({ timeout: 15000 })

		// --- 4. Assert the updated name is visible ---
		await expect(page.getByText(updatedName).first()).toBeVisible({ timeout: 10000 })

		// --- 5. Delete the account ---
		await page.getByRole('button', { name: new RegExp(`^(Acciones de|Actions for) ${updatedName}$`) }).click()
		await page.getByRole('menuitem', { name: /Delete|Eliminar/i }).click()

		const deleteDialog = page.getByRole('alertdialog')
		await expect(deleteDialog).toBeVisible()
		await deleteDialog.getByRole('button', { name: /^(Delete|Eliminar)$/i }).click()

		await expect(page.getByText(updatedName).first()).not.toBeVisible({ timeout: 15000 })
	})
})
