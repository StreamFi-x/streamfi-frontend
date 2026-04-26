import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/user-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const UA_STRINGS = {
  chrome_windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  firefox_linux: "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
  safari_macos: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  edge_windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  opera: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0",
  ie11: "Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko",
  iphone_safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  android_chrome: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  slurp: "Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)",
};

describe("POST /api/routes-f/user-agent", () => {
  it("detects Chrome on Windows desktop", async () => {
    const res = await POST(makeRequest({ ua: UA_STRINGS.chrome_windows }));
    const data = await res.json();
    expect(data.browser.name).toBe("Chrome");
    expect(data.os.name).toBe("Windows");
    expect(data.device.type).toBe("desktop");
    expect(data.is_bot).toBe(false);
  });

  it("detects Firefox on Linux desktop", async () => {
    const res = await POST(makeRequest({ ua: UA_STRINGS.firefox_linux }));
    const data = await res.json();
    expect(data.browser.name).toBe("Firefox");
    expect(data.os.name).toBe("Linux");
    expect(data.device.type).toBe("desktop");
  });

  it("detects Safari on macOS desktop", async () => {
    const res = await POST(makeRequest({ ua: UA_STRINGS.safari_macos }));
    const data = await res.json();
    expect(data.browser.name).toBe("Safari");
    expect(data.os.name).toBe("macOS");
    expect(data.device.type).toBe("desktop");
  });

  it("detects Edge on Windows", async () => {
    const res = await POST(makeRequest({ ua: UA_STRINGS.edge_windows }));
    const data = await res.json();
    expect(data.browser.name).toBe("Edge");
    expect(data.os.name).toBe("Windows");
  });

  it("detects Opera", async () => {
    const res = await POST(makeRequest({ ua: UA_STRINGS.opera }));
    const data = await res.json();
    expect(data.browser.name).toBe("Opera");
  });

  it("detects IE 11", async () => {
    const res = await POST(makeRequest({ ua: UA_STRINGS.ie11 }));
    const data = await res.json();
    expect(data.browser.name).toBe("IE");
    expect(data.os.name).toBe("Windows");
  });

  it("detects iPhone mobile Safari", async () => {
    const res = await POST(makeRequest({ ua: UA_STRINGS.iphone_safari }));
    const data = await res.json();
    expect(data.device.type).toBe("mobile");
    expect(data.os.name).toBe("iOS");
    expect(data.device.vendor).toBe("Apple");
  });

  it("detects Android mobile Chrome", async () => {
    const res = await POST(makeRequest({ ua: UA_STRINGS.android_chrome }));
    const data = await res.json();
    expect(data.device.type).toBe("mobile");
    expect(data.os.name).toBe("Android");
  });

  it("detects iPad as tablet", async () => {
    const res = await POST(makeRequest({ ua: UA_STRINGS.ipad }));
    const data = await res.json();
    expect(data.device.type).toBe("tablet");
  });

  it("detects Googlebot as bot", async () => {
    const res = await POST(makeRequest({ ua: UA_STRINGS.googlebot }));
    const data = await res.json();
    expect(data.is_bot).toBe(true);
    expect(data.device.type).toBe("bot");
  });

  it("detects Bingbot as bot", async () => {
    const res = await POST(makeRequest({ ua: UA_STRINGS.bingbot }));
    const data = await res.json();
    expect(data.is_bot).toBe(true);
  });

  it("detects Yahoo Slurp as bot", async () => {
    const res = await POST(makeRequest({ ua: UA_STRINGS.slurp }));
    const data = await res.json();
    expect(data.is_bot).toBe(true);
  });

  it("rejects missing ua", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects ua over 4KB", async () => {
    const res = await POST(makeRequest({ ua: "A".repeat(4097) }));
    expect(res.status).toBe(413);
  });
});
