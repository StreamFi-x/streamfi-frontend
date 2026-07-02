import { NextRequest } from "next/server";

export function createMockRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const mockHeaders = new Headers({
    "Content-Type": "application/json",
    ...headers,
  });

  const init: RequestInit = {
    method,
    headers: mockHeaders,
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

export function createMockParams(params: Record<string, string>) {
  return Promise.resolve(params);
}

// Helper to reset mock storage between tests
export function resetMockStorage(): void {
  // We can't directly reset the in-memory storage since it's in a different module
  // Tests should be written to be isolated and not depend on shared state
  // In a real implementation, we would export reset functions from mock-storage
}