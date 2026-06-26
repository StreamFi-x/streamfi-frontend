import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { PATCH, DELETE } from "../[panel_id]/route";
import { POST as REORDER_POST } from "../reorder/route";
import { clearAllPanels } from "../store";

function makeGetReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/routes-f/channel/info-panels");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function makePostReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes-f/channel/info-panels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePatchReq(panelId: string, body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/channel/info-panels/${panelId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function makeDeleteReq(panelId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/routes-f/channel/info-panels/${panelId}`,
    { method: "DELETE" }
  );
}

function makeReorderReq(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/routes-f/channel/info-panels/reorder",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

describe("channel/info-panels", () => {
  beforeEach(() => {
    clearAllPanels();
  });

  describe("full lifecycle", () => {
    it("creates, lists, updates, and deletes panels", async () => {
      const createRes = await POST(
        makePostReq({
          creator_id: "creator_1",
          title: "About",
          body_markdown: "Welcome to my channel!",
          image_url: "https://cdn.streamfi.io/panels/about.png",
        })
      );
      expect(createRes.status).toBe(201);
      const panel = await createRes.json();
      expect(panel.panel_id).toMatch(/^pnl_/);
      expect(panel.title).toBe("About");

      await POST(
        makePostReq({
          creator_id: "creator_1",
          title: "Schedule",
          body_markdown: "Mon/Wed/Fri 7pm UTC",
        })
      );

      const listRes = await GET(makeGetReq({ creator_id: "creator_1" }));
      expect(listRes.status).toBe(200);
      const list = await listRes.json();
      expect(list.panels).toHaveLength(2);
      expect(list.panels[0].title).toBe("About");
      expect(list.panels[1].title).toBe("Schedule");

      const patchRes = await PATCH(
        makePatchReq(panel.panel_id, {
          title: "About Me",
          body_markdown: "Updated bio content",
        }),
        { params: Promise.resolve({ panel_id: panel.panel_id }) }
      );
      expect(patchRes.status).toBe(200);
      const updated = await patchRes.json();
      expect(updated.title).toBe("About Me");

      const deleteRes = await DELETE(
        makeDeleteReq(panel.panel_id),
        { params: Promise.resolve({ panel_id: panel.panel_id }) }
      );
      expect(deleteRes.status).toBe(200);

      const afterDelete = await GET(makeGetReq({ creator_id: "creator_1" }));
      const remaining = await afterDelete.json();
      expect(remaining.panels).toHaveLength(1);
      expect(remaining.panels[0].title).toBe("Schedule");
    });

    it("returns 400 when creator_id is missing on GET", async () => {
      const res = await GET(makeGetReq({}));
      expect(res.status).toBe(400);
    });

    it("returns 404 when patching unknown panel", async () => {
      const res = await PATCH(
        makePatchReq("pnl_missing", { title: "X" }),
        { params: Promise.resolve({ panel_id: "pnl_missing" }) }
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 when deleting unknown panel", async () => {
      const res = await DELETE(
        makeDeleteReq("pnl_missing"),
        { params: Promise.resolve({ panel_id: "pnl_missing" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /reorder", () => {
    it("reorders panels for a creator", async () => {
      const a = await (
        await POST(
          makePostReq({
            creator_id: "creator_1",
            title: "About",
            body_markdown: "About content",
          })
        )
      ).json();
      const b = await (
        await POST(
          makePostReq({
            creator_id: "creator_1",
            title: "Donations",
            body_markdown: "Tip in XLM/USDC",
          })
        )
      ).json();
      const c = await (
        await POST(
          makePostReq({
            creator_id: "creator_1",
            title: "Social",
            body_markdown: "Follow me everywhere",
          })
        )
      ).json();

      const res = await REORDER_POST(
        makeReorderReq({
          creator_id: "creator_1",
          order: [c.panel_id, a.panel_id, b.panel_id],
        })
      );
      expect(res.status).toBe(200);

      const list = await (await GET(makeGetReq({ creator_id: "creator_1" }))).json();
      expect(list.panels.map((p: { title: string }) => p.title)).toEqual([
        "Social",
        "About",
        "Donations",
      ]);
    });

    it("returns 404 when creator has no panels", async () => {
      const res = await REORDER_POST(
        makeReorderReq({ creator_id: "unknown", order: ["pnl_000001"] })
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 when order contains unknown panel_id", async () => {
      const panel = await (
        await POST(
          makePostReq({
            creator_id: "creator_1",
            title: "About",
            body_markdown: "Content",
          })
        )
      ).json();

      const res = await REORDER_POST(
        makeReorderReq({
          creator_id: "creator_1",
          order: [panel.panel_id, "pnl_missing"],
        })
      );
      expect(res.status).toBe(400);
    });
  });
});
