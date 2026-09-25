import { NextRequest } from "next/server";
import { GET, POST, PATCH } from "../route";
import { __resetModerationAppealStore } from "../store";
import { modStore } from "@/app/api/routes-f/mod-team/route";

const BASE = "http://localhost/api/routes-f/moderation-appeal-review";

function req(method: string, url: string, body?: object): NextRequest {
  return new NextRequest(url, {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });
}

function addModerator(creator_id: string, viewer_id: string) {
  modStore.set(`${creator_id}:${viewer_id}`, {
    creator_id,
    viewer_id,
    role: "mod",
    added_at: new Date().toISOString(),
  });
}

beforeEach(() => {
  __resetModerationAppealStore();
  modStore.clear();
});

describe("Moderation appeal review lifecycle", () => {
  it("files an appeal and lists it as pending", async () => {
    const createRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-1",
        target_user_id: "user-1",
        action_type: "timeout",
        reason: "This timeout was unwarranted.",
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created).toEqual({
      appeal_id: expect.any(String),
      status: "pending",
    });

    const listRes = await GET(req("GET", `${BASE}?creator_id=creator-1`));
    expect(listRes.status).toBe(200);
    const listed = await listRes.json();
    expect(listed.appeals).toHaveLength(1);
    expect(listed.appeals[0]).toMatchObject({
      appeal_id: created.appeal_id,
      target_user_id: "user-1",
      action_type: "timeout",
      status: "pending",
    });
  });

  it("returns 400 when required POST fields are missing", async () => {
    const res = await POST(
      req("POST", BASE, { creator_id: "creator-1" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 for a duplicate pending appeal on the same action", async () => {
    const payload = {
      creator_id: "creator-1",
      target_user_id: "user-1",
      action_type: "ban",
      reason: "First appeal.",
    };
    await POST(req("POST", BASE, payload));
    const dupRes = await POST(
      req("POST", BASE, { ...payload, reason: "Second appeal." })
    );
    expect(dupRes.status).toBe(409);
  });

  it("returns 400 when creator_id is missing on GET", async () => {
    const res = await GET(req("GET", BASE));
    expect(res.status).toBe(400);
  });

  it("a moderator upholds an appeal", async () => {
    addModerator("creator-1", "mod-1");

    const createRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-1",
        target_user_id: "user-1",
        action_type: "timeout",
        reason: "I did nothing wrong.",
      })
    );
    const { appeal_id } = await createRes.json();

    const reviewRes = await PATCH(
      req("PATCH", BASE, {
        appealId: appeal_id,
        outcome: "upheld",
        reviewerId: "mod-1",
        reviewNote: "Timeout stands per chat logs.",
      })
    );

    expect(reviewRes.status).toBe(200);
    const reviewed = await reviewRes.json();
    expect(reviewed).toEqual({
      appealId: appeal_id,
      status: "upheld",
      outcome: "upheld",
      reviewerId: "mod-1",
      reviewNote: "Timeout stands per chat logs.",
      reviewedAt: expect.any(String),
    });
  });

  it("a moderator overturns an appeal without a review note", async () => {
    addModerator("creator-1", "mod-1");

    const createRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-1",
        target_user_id: "user-2",
        action_type: "ban",
        reason: "Wrong person was banned.",
      })
    );
    const { appeal_id } = await createRes.json();

    const reviewRes = await PATCH(
      req("PATCH", BASE, {
        appealId: appeal_id,
        outcome: "overturned",
        reviewerId: "mod-1",
      })
    );

    expect(reviewRes.status).toBe(200);
    const reviewed = await reviewRes.json();
    expect(reviewed.status).toBe("overturned");
    expect(reviewed.outcome).toBe("overturned");
    expect(reviewed.reviewNote).toBeNull();
  });

  it("returns 403 when the reviewer is not a moderator of the channel", async () => {
    const createRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-1",
        target_user_id: "user-1",
        action_type: "timeout",
        reason: "Appeal text.",
      })
    );
    const { appeal_id } = await createRes.json();

    const reviewRes = await PATCH(
      req("PATCH", BASE, {
        appealId: appeal_id,
        outcome: "upheld",
        reviewerId: "not-a-mod",
      })
    );

    expect(reviewRes.status).toBe(403);
  });

  it("returns 403 when the reviewer moderates a different channel", async () => {
    addModerator("creator-2", "mod-1");

    const createRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-1",
        target_user_id: "user-1",
        action_type: "timeout",
        reason: "Appeal text.",
      })
    );
    const { appeal_id } = await createRes.json();

    const reviewRes = await PATCH(
      req("PATCH", BASE, {
        appealId: appeal_id,
        outcome: "upheld",
        reviewerId: "mod-1",
      })
    );

    expect(reviewRes.status).toBe(403);
  });

  it("returns 404 when reviewing an unknown appealId", async () => {
    const res = await PATCH(
      req("PATCH", BASE, {
        appealId: "00000000-0000-0000-0000-000000000099",
        outcome: "upheld",
        reviewerId: "mod-1",
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when appealId is missing", async () => {
    const res = await PATCH(
      req("PATCH", BASE, { outcome: "upheld", reviewerId: "mod-1" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when reviewerId is missing", async () => {
    addModerator("creator-1", "mod-1");
    const createRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-1",
        target_user_id: "user-1",
        action_type: "timeout",
        reason: "Appeal text.",
      })
    );
    const { appeal_id } = await createRes.json();

    const res = await PATCH(
      req("PATCH", BASE, { appealId: appeal_id, outcome: "upheld" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid outcome value", async () => {
    addModerator("creator-1", "mod-1");
    const createRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-1",
        target_user_id: "user-1",
        action_type: "timeout",
        reason: "Appeal text.",
      })
    );
    const { appeal_id } = await createRes.json();

    const res = await PATCH(
      req("PATCH", BASE, {
        appealId: appeal_id,
        outcome: "dismissed",
        reviewerId: "mod-1",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when reviewing an already-reviewed appeal", async () => {
    addModerator("creator-1", "mod-1");
    const createRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-1",
        target_user_id: "user-1",
        action_type: "timeout",
        reason: "Appeal text.",
      })
    );
    const { appeal_id } = await createRes.json();

    await PATCH(
      req("PATCH", BASE, {
        appealId: appeal_id,
        outcome: "upheld",
        reviewerId: "mod-1",
      })
    );

    const secondReview = await PATCH(
      req("PATCH", BASE, {
        appealId: appeal_id,
        outcome: "overturned",
        reviewerId: "mod-1",
      })
    );
    expect(secondReview.status).toBe(409);
  });

  it("returns 400 for invalid JSON body on PATCH", async () => {
    const badReq = new NextRequest(BASE, {
      method: "PATCH",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(badReq);
    expect(res.status).toBe(400);
  });

  it("resolved appeal no longer appears in the pending list", async () => {
    addModerator("creator-1", "mod-1");
    const createRes = await POST(
      req("POST", BASE, {
        creator_id: "creator-1",
        target_user_id: "user-1",
        action_type: "timeout",
        reason: "Appeal text.",
      })
    );
    const { appeal_id } = await createRes.json();

    await PATCH(
      req("PATCH", BASE, {
        appealId: appeal_id,
        outcome: "upheld",
        reviewerId: "mod-1",
      })
    );

    const listRes = await GET(req("GET", `${BASE}?creator_id=creator-1`));
    const listed = await listRes.json();
    expect(listed.appeals).toHaveLength(0);
  });
});
