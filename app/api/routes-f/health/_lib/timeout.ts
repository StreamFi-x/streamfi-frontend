export class ProbeTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Probe exceeded ${timeoutMs}ms timeout`);
    this.name = "ProbeTimeoutError";
  }
}

export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new ProbeTimeoutError(timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
