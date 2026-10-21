export async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = typeof body?.error === "string" ? `: ${body.error}` : "";
    } catch {
      // Keep the HTTP status when the server returns a non-JSON error page.
    }
    throw new Error(`Request failed (${response.status})${detail}`);
  }
  return response.json() as Promise<T>;
}
