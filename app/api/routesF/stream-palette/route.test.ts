import { GET } from "./route";
import { CATEGORY_PALETTES, PALETTE_CATEGORIES } from "./palettes";
import { PALETTE_ROLES } from "./types";

const URL_BASE = "http://localhost/api/routesF/stream-palette";

function getRequest(query = "") {
  return new Request(`${URL_BASE}${query}`, { method: "GET" });
}

describe("/api/routesF/stream-palette", () => {
  it.each(PALETTE_CATEGORIES)(
    "returns a full four-role palette for %s",
    async category => {
      const response = await GET(getRequest(`?category=${category}`));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.category).toBe(category);
      expect(data.palette).toHaveLength(PALETTE_ROLES.length);
      expect(
        data.palette.map((swatch: { role: string }) => swatch.role)
      ).toEqual(PALETTE_ROLES);
      expect(data.palette).toEqual(CATEGORY_PALETTES[category]);
    }
  );

  it("returns only 6-digit uppercase hex values", () => {
    Object.values(CATEGORY_PALETTES)
      .flat()
      .forEach(swatch => {
        expect(swatch.hex).toMatch(/^#[0-9A-F]{6}$/);
      });
  });

  it("normalizes category casing and whitespace", async () => {
    const response = await GET(getRequest("?category=%20GAMING%20"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.category).toBe("gaming");
    expect(data.palette).toEqual(CATEGORY_PALETTES.gaming);
  });

  it("returns 404 for an unknown category", async () => {
    const response = await GET(
      getRequest("?category=underwater-basket-weaving")
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("underwater-basket-weaving");
  });

  it("returns 400 when category is missing", async () => {
    const response = await GET(getRequest());
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("category");
  });

  it("returns 400 for a blank category", async () => {
    const response = await GET(getRequest("?category=%20%20"));

    expect(response.status).toBe(400);
  });
});
