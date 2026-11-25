import { expect, test } from "@playwright/test";
import {
  E2E_RECIPIENT,
  E2E_WALLET,
  seedConnectedWallet,
  stubExternalServices,
} from "../e2e/fixtures";

test("landing hero", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Own Your Stream/ })
  ).toBeVisible();
  await expect(page).toHaveScreenshot("landing-hero.png");
});

test("explore stream view", async ({ page }) => {
  await seedConnectedWallet(page, "e2e-creator");
  await stubExternalServices(page);
  await page.goto("/explore");
  await expect(page.getByText("Visual baseline stream").first()).toBeVisible();
  await expect(page).toHaveScreenshot("explore-stream-view.png");
});

test("tip modal", async ({ page }) => {
  await seedConnectedWallet(page, "e2e-creator");
  await stubExternalServices(page);
  await page.goto("/test-tip");
  await page.locator("#sender").fill(E2E_WALLET);
  await page.locator("#recipient").fill(E2E_RECIPIENT);
  await page.getByRole("button", { name: "Open Tip Modal" }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Send a Tip" });
  await dialog.getByRole("button", { name: "5", exact: true }).click();
  await expect(dialog.getByText("$0.60")).toBeVisible();
  await expect(page).toHaveScreenshot("tip-modal.png");
});
