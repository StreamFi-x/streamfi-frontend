import { expect, test } from "@playwright/test";
import { seedConnectedWallet, stubExternalServices } from "./fixtures";

test("unregistered wallet registers and provisions its first stream", async ({
  page,
}) => {
  let registered = false;
  await seedConnectedWallet(page); // no session username: registration is required
  await stubExternalServices(page, { isRegistered: () => registered });

  await page.goto("/explore");
  await expect(page.getByText("Complete Your Profile")).toBeVisible();

  await page.getByPlaceholder("Enter your display name").fill("e2e-creator");
  await page
    .getByPlaceholder("Enter a valid email address")
    .fill("creator@example.test");
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText("Registration Successful!")).toBeVisible();
  registered = true;
  await page.getByRole("button", { name: "Continue" }).click();

  await page.goto("/settings/stream-preference");
  await expect(page.getByText("No stream key yet")).toBeVisible();
  await page.getByRole("button", { name: "Generate Stream Key" }).click();

  await expect(
    page.getByText("Stream key generated successfully!")
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("input")
        .evaluateAll(inputs =>
          inputs.map(input => (input as HTMLInputElement).value)
        )
    )
    .toContain("e2e-stream-key");
});
