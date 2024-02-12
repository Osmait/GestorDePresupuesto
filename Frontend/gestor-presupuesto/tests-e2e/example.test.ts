import { test, expect } from "@playwright/test";

test.beforeEach("test login", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("email").fill("demo@demo.com");
  await page.getByTestId("password").fill("12345678");
  await page.getByRole("button", { name: "Login" }).click();
});

test("has title index", async ({ page }) => {
  await expect(page).toHaveTitle(/Inicio/);
});

test("has title register ", async ({ page }) => {
  await page.getByTestId("register").click();
  await expect(page).toHaveTitle(/Register/);
});

test("has title account ", async ({ page }) => {
  await page.getByTestId("accounts").click();
  await expect(page).toHaveTitle(/Accounts/);
});

test("has title transactions", async ({ page }) => {
  await page.getByTestId("transactions").click();
  await expect(page).toHaveTitle(/Transactions/);
});
