import { defineConfig } from "@playwright/test";
import { deterministicUse, webServer } from "./tests/playwright-shared";

export default defineConfig({
  testDir: "./tests/visual",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    ...deterministicUse,
    baseURL: "http://127.0.0.1:3101",
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    },
  },
  webServer: webServer(3101),
});
