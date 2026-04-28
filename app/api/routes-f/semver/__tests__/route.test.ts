import { POST } from "../route";
import { NextRequest } from "next/server";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/routes-f/semver", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes-f/semver", () => {
  describe("parse", () => {
    it("parses a simple version", async () => {
      const res = await POST(makeReq({ action: "parse", version: "1.2.3" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it("parses version with prerelease", async () => {
      const res = await POST(makeReq({ action: "parse", version: "1.0.0-alpha.1" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.major).toBe(1);
      expect(body.prerelease).toBe("alpha.1");
    });

    it("parses version with build metadata", async () => {
      const res = await POST(makeReq({ action: "parse", version: "1.0.0+build.123" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.build).toBe("build.123");
    });

    it("parses version with prerelease and build", async () => {
      const res = await POST(makeReq({ action: "parse", version: "2.0.0-rc.1+sha.abc" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.prerelease).toBe("rc.1");
      expect(body.build).toBe("sha.abc");
    });

    it("returns 400 for invalid version", async () => {
      const res = await POST(makeReq({ action: "parse", version: "not-a-version" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing version", async () => {
      const res = await POST(makeReq({ action: "parse" }));
      expect(res.status).toBe(400);
    });
  });

  describe("compare", () => {
    it("returns 0 for equal versions", async () => {
      const res = await POST(makeReq({ action: "compare", a: "1.0.0", b: "1.0.0" }));
      expect(res.status).toBe(200);
      expect((await res.json()).result).toBe(0);
    });

    it("returns -1 when a < b", async () => {
      const res = await POST(makeReq({ action: "compare", a: "1.0.0", b: "2.0.0" }));
      expect(res.status).toBe(200);
      expect((await res.json()).result).toBe(-1);
    });

    it("returns 1 when a > b", async () => {
      const res = await POST(makeReq({ action: "compare", a: "2.0.0", b: "1.0.0" }));
      expect(res.status).toBe(200);
      expect((await res.json()).result).toBe(1);
    });

    it("prerelease is less than release", async () => {
      const res = await POST(makeReq({ action: "compare", a: "1.0.0-alpha", b: "1.0.0" }));
      expect(res.status).toBe(200);
      expect((await res.json()).result).toBe(-1);
    });

    it("compares prerelease identifiers numerically", async () => {
      const res = await POST(makeReq({ action: "compare", a: "1.0.0-alpha.1", b: "1.0.0-alpha.2" }));
      expect(res.status).toBe(200);
      expect((await res.json()).result).toBe(-1);
    });

    it("numeric prerelease < alphanumeric", async () => {
      const res = await POST(makeReq({ action: "compare", a: "1.0.0-1", b: "1.0.0-alpha" }));
      expect(res.status).toBe(200);
      expect((await res.json()).result).toBe(-1);
    });

    it("returns 400 for invalid version a", async () => {
      const res = await POST(makeReq({ action: "compare", a: "bad", b: "1.0.0" }));
      expect(res.status).toBe(400);
    });
  });

  describe("bump", () => {
    it("bumps major", async () => {
      const res = await POST(makeReq({ action: "bump", version: "1.2.3", level: "major" }));
      expect(res.status).toBe(200);
      expect((await res.json()).next).toBe("2.0.0");
    });

    it("bumps minor", async () => {
      const res = await POST(makeReq({ action: "bump", version: "1.2.3", level: "minor" }));
      expect(res.status).toBe(200);
      expect((await res.json()).next).toBe("1.3.0");
    });

    it("bumps patch", async () => {
      const res = await POST(makeReq({ action: "bump", version: "1.2.3", level: "patch" }));
      expect(res.status).toBe(200);
      expect((await res.json()).next).toBe("1.2.4");
    });

    it("bumps prerelease from release", async () => {
      const res = await POST(makeReq({ action: "bump", version: "1.2.3", level: "prerelease" }));
      expect(res.status).toBe(200);
      expect((await res.json()).next).toBe("1.2.3-0");
    });

    it("bumps existing numeric prerelease", async () => {
      const res = await POST(makeReq({ action: "bump", version: "1.2.3-alpha.1", level: "prerelease" }));
      expect(res.status).toBe(200);
      expect((await res.json()).next).toBe("1.2.3-alpha.2");
    });

    it("returns 400 for invalid level", async () => {
      const res = await POST(makeReq({ action: "bump", version: "1.0.0", level: "invalid" }));
      expect(res.status).toBe(400);
    });
  });

  describe("satisfies", () => {
    it("exact version match", async () => {
      const res = await POST(makeReq({ action: "satisfies", version: "1.2.3", range: "1.2.3" }));
      expect(res.status).toBe(200);
      expect((await res.json()).satisfies).toBe(true);
    });

    it("caret range ^1.2.3 allows patch/minor bumps", async () => {
      const res = await POST(makeReq({ action: "satisfies", version: "1.9.9", range: "^1.2.3" }));
      expect(res.status).toBe(200);
      expect((await res.json()).satisfies).toBe(true);
    });

    it("caret range ^1.2.3 rejects major bump", async () => {
      const res = await POST(makeReq({ action: "satisfies", version: "2.0.0", range: "^1.2.3" }));
      expect(res.status).toBe(200);
      expect((await res.json()).satisfies).toBe(false);
    });

    it("tilde range ~1.2.3 allows patch bumps", async () => {
      const res = await POST(makeReq({ action: "satisfies", version: "1.2.9", range: "~1.2.3" }));
      expect(res.status).toBe(200);
      expect((await res.json()).satisfies).toBe(true);
    });

    it("tilde range ~1.2.3 rejects minor bump", async () => {
      const res = await POST(makeReq({ action: "satisfies", version: "1.3.0", range: "~1.2.3" }));
      expect(res.status).toBe(200);
      expect((await res.json()).satisfies).toBe(false);
    });

    it(">= range", async () => {
      const res = await POST(makeReq({ action: "satisfies", version: "2.0.0", range: ">=1.0.0" }));
      expect(res.status).toBe(200);
      expect((await res.json()).satisfies).toBe(true);
    });

    it("< range", async () => {
      const res = await POST(makeReq({ action: "satisfies", version: "0.9.0", range: "<1.0.0" }));
      expect(res.status).toBe(200);
      expect((await res.json()).satisfies).toBe(true);
    });

    it("compound range >=1.0.0 <2.0.0", async () => {
      const res = await POST(makeReq({ action: "satisfies", version: "1.5.0", range: ">=1.0.0 <2.0.0" }));
      expect(res.status).toBe(200);
      expect((await res.json()).satisfies).toBe(true);
    });

    it("compound range rejects out-of-range", async () => {
      const res = await POST(makeReq({ action: "satisfies", version: "2.0.0", range: ">=1.0.0 <2.0.0" }));
      expect(res.status).toBe(200);
      expect((await res.json()).satisfies).toBe(false);
    });

    it("returns 400 for invalid version", async () => {
      const res = await POST(makeReq({ action: "satisfies", version: "bad", range: "^1.0.0" }));
      expect(res.status).toBe(400);
    });
  });

  describe("validation", () => {
    it("returns 400 for missing action", async () => {
      const res = await POST(makeReq({}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for unknown action", async () => {
      const res = await POST(makeReq({ action: "unknown" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON", async () => {
      const req = new NextRequest("http://localhost/api/routes-f/semver", {
        method: "POST",
        body: "not json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });
});
