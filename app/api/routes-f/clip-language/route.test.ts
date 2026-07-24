import { GET, PUT, MANUAL_LANGUAGES } from "./route";
import { detectLanguage } from "./detectLanguage";
import { NextRequest } from "next/server";

const BASE = "http://localhost/api/routes-f/clip-language";

function putReq(body: unknown) {
  return new NextRequest(BASE, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

describe("Clip Language Metadata", () => {
  beforeEach(() => {
    for (const key in MANUAL_LANGUAGES) {
      delete MANUAL_LANGUAGES[key];
    }
  });

  describe("detectLanguage heuristic", () => {
    it("should detect English from Latin text", () => {
      expect(detectLanguage("Hello there, welcome to the stream")).toBe("en");
    });

    it("should detect Russian from Cyrillic text", () => {
      expect(detectLanguage("Привет, как дела?")).toBe("ru");
    });

    it("should detect Japanese from kana text", () => {
      expect(detectLanguage("こんにちは、元気ですか")).toBe("ja");
    });

    it("should detect Chinese from ideographic text", () => {
      expect(detectLanguage("你好，欢迎来到直播间")).toBe("zh");
    });

    it("should detect Arabic from Arabic script", () => {
      expect(detectLanguage("مرحبا بكم في البث المباشر")).toBe("ar");
    });

    it("should default to English for empty or symbol-only text", () => {
      expect(detectLanguage("")).toBe("en");
      expect(detectLanguage("123 !!! ???")).toBe("en");
    });
  });

  describe("GET /api/routes-f/clip-language", () => {
    it("should return detected language for a seeded English clip", async () => {
      const res = await GET(new NextRequest(`${BASE}?clip_id=clip-en`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ language: "en", source: "detected" });
    });

    it("should return detected language for non-Latin transcripts", async () => {
      const ru = await (await GET(new NextRequest(`${BASE}?clip_id=clip-ru`))).json();
      expect(ru).toEqual({ language: "ru", source: "detected" });

      const ja = await (await GET(new NextRequest(`${BASE}?clip_id=clip-ja`))).json();
      expect(ja).toEqual({ language: "ja", source: "detected" });

      const zh = await (await GET(new NextRequest(`${BASE}?clip_id=clip-zh`))).json();
      expect(zh).toEqual({ language: "zh", source: "detected" });
    });

    it("should return 404 for an unknown clip", async () => {
      const res = await GET(new NextRequest(`${BASE}?clip_id=clip-unknown`));
      expect(res.status).toBe(404);
    });

    it("should return 400 when clip_id is missing", async () => {
      const res = await GET(new NextRequest(BASE));
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/routes-f/clip-language (manual override)", () => {
    it("should set a manual language and prefer it over detection", async () => {
      const putRes = await PUT(putReq({ clip_id: "clip-en", language: "es" }));
      expect(putRes.status).toBe(200);
      const putData = await putRes.json();
      expect(putData).toEqual({ clip_id: "clip-en", language: "es", source: "manual" });

      const getRes = await GET(new NextRequest(`${BASE}?clip_id=clip-en`));
      const getData = await getRes.json();
      expect(getData).toEqual({ language: "es", source: "manual" });
    });

    it("should allow a manual language for a clip without a transcript", async () => {
      await PUT(putReq({ clip_id: "clip-no-transcript", language: "fr" }));

      const res = await GET(new NextRequest(`${BASE}?clip_id=clip-no-transcript`));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ language: "fr", source: "manual" });
    });

    it("should reject an unsupported language code", async () => {
      const res = await PUT(putReq({ clip_id: "clip-en", language: "xx" }));
      expect(res.status).toBe(400);
    });

    it("should return 400 when clip_id or language is missing", async () => {
      const noClip = await PUT(putReq({ language: "en" }));
      expect(noClip.status).toBe(400);

      const noLang = await PUT(putReq({ clip_id: "clip-en" }));
      expect(noLang.status).toBe(400);
    });

    it("should return 400 for invalid JSON", async () => {
      const req = new NextRequest(BASE, { method: "PUT", body: "not-json" });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });
});
