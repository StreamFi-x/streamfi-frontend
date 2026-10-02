import { NextRequest } from "next/server";
import { GET, PUT, DEFAULT_THEME, _resetThemes } from "./route";

describe("Channel Theme API", () => {
  beforeEach(() => {
    _resetThemes();
  });

  const mockRequest = (method: string, url: string, body?: any) => {
    return new NextRequest(`http://localhost${url}`, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  };

  it("should return default theme if no custom theme exists (GET)", async () => {
    const getReq = mockRequest("GET", "/api/routes-f/channel-theme?creator_id=c1");
    const res = await GET(getReq);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.accent_color).toBe(DEFAULT_THEME.accent_color);
    expect(data.secondary_color).toBe(DEFAULT_THEME.secondary_color);
  });

  it("should update and return a custom theme (PUT)", async () => {
    const putReq = mockRequest("PUT", "/api/routes-f/channel-theme", {
      creator_id: "c2",
      accent_color: "#ff0000",
      secondary_color: "#00ff00",
    });
    
    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(200);

    // Verify GET returns updated theme
    const getReq = mockRequest("GET", "/api/routes-f/channel-theme?creator_id=c2");
    const getRes = await GET(getReq);
    const data = await getRes.json();
    
    expect(data.accent_color).toBe("#ff0000");
    expect(data.secondary_color).toBe("#00ff00");
  });

  it("should reject invalid hex colors (PUT)", async () => {
    const putReq = mockRequest("PUT", "/api/routes-f/channel-theme", {
      creator_id: "c3",
      accent_color: "invalid-color",
      secondary_color: "#000",
    });
    
    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(400);

    const data = await putRes.json();
    expect(data.error).toContain("Invalid hex color format");
  });

  it("should allow short hex colors (PUT)", async () => {
    const putReq = mockRequest("PUT", "/api/routes-f/channel-theme", {
      creator_id: "c4",
      accent_color: "#f00",
      secondary_color: "#0f0",
    });
    
    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(200);
  });
});
