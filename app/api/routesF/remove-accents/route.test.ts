import { NextRequest } from "next/server";
import { POST, removeAccents } from "./route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/routesF/remove-accents", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("removeAccents", () => {
  it("removes accents and keeps base letters", () => {
    expect(removeAccents("café déjà vu")).toBe("cafe deja vu");
    expect(removeAccents("São Tomé and Príncipe")).toBe(
      "Sao Tome and Principe"
    );
  });
});

describe("POST /api/routesF/remove-accents", () => {
  it("returns transformed text", async () => {
    const res = await POST(req({ text: "façade naïve rôle" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "facade naive role" });
  });

  it("returns 400 for invalid input", async () => {
    const res = await POST(req({ text: 123 }));
    expect(res.status).toBe(400);
  });
});
