import { expect, test } from "@playwright/test";
import {
  E2E_RECIPIENT,
  E2E_WALLET,
  seedConnectedWallet,
  stubExternalServices,
} from "./fixtures";

test("connected wallet can walk the tip flow to the signing boundary", async ({
  page,
}) => {
  await seedConnectedWallet(page, "e2e-creator");
  await stubExternalServices(page);

  await page.goto("/test-tip");
  await expect(
    page.getByRole("heading", { name: "TipModal Test Page" })
  ).toBeVisible();

  await page.locator("#sender").fill(E2E_WALLET);
  await page.locator("#recipient").fill(E2E_RECIPIENT);
  await page.locator("#username").fill("e2e-creator");
  await page.getByRole("button", { name: "Open Tip Modal" }).click();

  const dialog = page.getByRole("dialog").filter({ hasText: "Send a Tip" });
  await expect(dialog.getByText("Send a Tip")).toBeVisible();
  await dialog.getByRole("button", { name: "5", exact: true }).click();

  // The mocked CoinGecko response is 0.12 USD per XLM.
  await expect(dialog.getByText("$0.60")).toBeVisible();

  await dialog.getByRole("button", { name: "Review Tip" }).click();
  await expect(dialog.getByText("Confirm & Sign")).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm & Sign" }).click();

  // No wallet extension exists in CI, so signing fails at the wallet boundary.
  // Everything before that point (amount, price, balance, transaction build)
  // is exercised by this flow.
  await expect(page.getByText("Transaction Failed")).toBeVisible();
});
