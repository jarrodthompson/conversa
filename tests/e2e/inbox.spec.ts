import { test, expect } from "@playwright/test";

const OWNER = { email: "ava.owner@conversa.demo", password: "ConversaDemo!23" };

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/app\/inbox/, { timeout: 20000 });
}

test("agent can open a conversation and send a reply", async ({ page }) => {
  await login(page);

  // Open the first conversation in the list (a link to ?c=).
  const firstConversation = page.locator('a[href*="/app/inbox?"][href*="c="]').first();
  await firstConversation.click();

  // The composer should be visible.
  const composer = page.getByPlaceholder(/write a reply/i);
  await expect(composer).toBeVisible();

  const text = `E2E reply ${Date.now()}`;
  await composer.fill(text);
  await page.getByRole("button", { name: /^send$/i }).click();

  // The new message appears in the timeline.
  await expect(page.getByText(text)).toBeVisible({ timeout: 15000 });
});

test("inbox views filter the conversation list", async ({ page }) => {
  await login(page);
  await page.goto("/app/inbox?view=resolved");
  await expect(page.getByRole("heading", { name: /resolved/i })).toBeVisible();
});
