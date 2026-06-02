/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "./route";

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/routesF/random-named-color-picker");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return new NextRequest(url.toString(), { method: "GET" });
}

describe("/api/routesF/random-named-color-picker", () => {
  it("uses defaults when optional params are missing", async () => {
    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.colors).toHaveLength(5);
  });

  it("returns requested number of colors with expected shape", async () => {
    const response = await GET(makeRequest({ count: "5", seed: "42", group: "any" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.colors).toHaveLength(5);
    expect(payload.colors[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        hex: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        rgb: expect.stringMatching(/^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/),
      })
    );
  });

  it("filters only red-group named colors", async () => {
    const response = await GET(makeRequest({ count: "10", seed: "5", group: "reds" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    const redColorNames = new Set([
      "IndianRed",
      "LightCoral",
      "Salmon",
      "DarkSalmon",
      "LightSalmon",
      "Crimson",
      "Red",
      "FireBrick",
      "DarkRed",
      "Coral",
      "Tomato",
      "OrangeRed",
      "Pink",
      "LightPink",
      "HotPink",
      "DeepPink",
      "PaleVioletRed",
      "MediumVioletRed",
    ]);
    payload.colors.forEach((color: { name: string }) => {
      expect(redColorNames.has(color.name)).toBe(true);
    });
  });

  it("filters only blue-group named colors", async () => {
    const response = await GET(makeRequest({ count: "10", seed: "5", group: "blues" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    const blueColorNames = new Set([
      "LightSkyBlue",
      "SkyBlue",
      "DeepSkyBlue",
      "DodgerBlue",
      "CornflowerBlue",
      "SteelBlue",
      "RoyalBlue",
      "Blue",
      "MediumBlue",
      "DarkBlue",
      "Navy",
      "MidnightBlue",
      "MediumSlateBlue",
      "SlateBlue",
      "DarkSlateBlue",
      "PowderBlue",
      "LightBlue",
    ]);
    payload.colors.forEach((color: { name: string }) => {
      expect(blueColorNames.has(color.name)).toBe(true);
    });
  });

  it("returns deterministic output with same seed", async () => {
    const firstResponse = await GET(makeRequest({ count: "6", seed: "42", group: "any" }));
    const secondResponse = await GET(makeRequest({ count: "6", seed: "42", group: "any" }));

    const firstPayload = await firstResponse.json();
    const secondPayload = await secondResponse.json();

    expect(firstPayload.colors).toEqual(secondPayload.colors);
  });

  it("returns different output for different seeds", async () => {
    const firstResponse = await GET(makeRequest({ count: "6", seed: "42", group: "any" }));
    const secondResponse = await GET(makeRequest({ count: "6", seed: "43", group: "any" }));

    const firstPayload = await firstResponse.json();
    const secondPayload = await secondResponse.json();

    expect(firstPayload.colors).not.toEqual(secondPayload.colors);
  });

  it("returns 400 for invalid group", async () => {
    const response = await GET(makeRequest({ group: "greens" }));
    expect(response.status).toBe(400);
  });

  it("clamps count to avoid over-fetching the color pool", async () => {
    const response = await GET(makeRequest({ count: "100", group: "blues", seed: "9" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.colors.length).toBeLessThanOrEqual(17);
  });
});
