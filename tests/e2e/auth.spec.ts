import { test, expect } from "@playwright/test";

const OWNER = { email: "ava.owner@conversa.demo", password: "ConversaDemo!23" };

test("protected route redirects to login when signed out", async ({ page }) => {
  await page.goto("/app/inbox");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("owner can sign in and reach the inbox", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  await expect(page).toHaveURL(/\/app\/inbox/, { timeout: 20000 });
  // The org name appears in the top bar org switcher.
  await expect(page.getByText("Grovefield Supplies")).toBeVisible();
  // Inbox view navigation is present (target the nav link specifically).
  await expect(page.getByRole("link", { name: "All Conversations" })).toBeVisible();
});

test("sign out returns to login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/app\/inbox/, { timeout: 20000 });

  // Open the user menu (avatar button carries the user's name) and sign out.
  await page.getByRole("button", { name: "Ava Whitfield" }).click();
  await expect(page.getByText("My profile")).toBeVisible();
  await page.getByText("Sign out").click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
});
