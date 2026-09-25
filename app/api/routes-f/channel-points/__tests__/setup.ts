// Test setup file
import { expect, jest } from "@jest/globals";

// Mock console.error to reduce noise in tests
global.console.error = jest.fn();

// Add custom matchers if needed
expect.extend({
  toBePositive(received) {
    const pass = typeof received === "number" && received > 0;
    return {
      message: () => `expected ${received} to be positive`,
      pass,
    };
  },
});