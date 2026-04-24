import { routesFSuccess, routesFError } from "../../routesF/response";
import { ROUTES_F_API_VERSION } from "../../routesF/version"

describe("Routes-F response wrapper", () => {
  it("includes apiVersion in success response", async () => {
    const res = routesFSuccess({ test: true });
    const body = await res.json();

    expect(body).toEqual({
      apiVersion: ROUTES_F_API_VERSION,
      success: true,
      data: { test: true },
    });
  });

  it("includes apiVersion in error response", async () => {
    const res = routesFError("Error", 400);
    const body = await res.json();

    expect(body).toEqual({
      apiVersion: ROUTES_F_API_VERSION,
      success: false,
      error: "Error",
    });
  });
});