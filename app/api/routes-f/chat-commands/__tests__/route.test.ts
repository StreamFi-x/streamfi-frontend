/**
 * Tests for app/api/routes-f/chat-commands/
 * Covers: GET commands, POST add, execute (with template interpolation), toggle
 */

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { POST as executePost } from "../execute/route";
import { POST as togglePost } from "../toggle/route";
import { commandStore } from "../store";

function makeGetReq(creator_id: string) {
  return new NextRequest(
    `http://localhost/api/routes-f/chat-commands?creator_id=${creator_id}`
  );
}

function makePost(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  delete commandStore["creator_test"];
});

describe("GET /api/routes-f/chat-commands", () => {
  it("returns 400 when creator_id missing", async () => {
    const req = new NextRequest(
      "http://localhost/api/routes-f/chat-commands"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns empty array for unknown creator", async () => {
    const res = await GET(makeGetReq("creator_unknown_xyz"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.commands).toHaveLength(0);
  });

  it("returns commands for known creator", async () => {
    const res = await GET(makeGetReq("creator_alice"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.commands.length).toBeGreaterThan(0);
    expect(body.commands[0]).toHaveProperty("trigger");
  });
});

describe("POST /api/routes-f/chat-commands (add)", () => {
  it("adds a new command", async () => {
    const res = await POST(
      makePost("http://localhost/api/routes-f/chat-commands", {
        creator_id: "creator_test",
        trigger: "!website",
        response_template: "Visit us at https://streamfi.io",
        cooldown_seconds: 15,
      })
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.command.trigger).toBe("!website");
  });

  it("returns 409 on duplicate trigger", async () => {
    commandStore["creator_test"] = [
      {
        id: "cmd_dup",
        trigger: "!hello",
        response_template: "Hello!",
        cooldown_seconds: 5,
        enabled: true,
      },
    ];
    const res = await POST(
      makePost("http://localhost/api/routes-f/chat-commands", {
        creator_id: "creator_test",
        trigger: "!hello",
        response_template: "Hi again!",
      })
    );
    expect(res.status).toBe(409);
  });
});

describe("POST /api/routes-f/chat-commands/execute", () => {
  it("executes command with template interpolation", async () => {
    const res = await executePost(
      makePost("http://localhost/api/routes-f/chat-commands/execute", {
        creator_id: "creator_alice",
        trigger: "!so",
        context: { user: "viewer_bob" },
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.response).toContain("viewer_bob");
  });

  it("returns 404 for unknown trigger", async () => {
    const res = await executePost(
      makePost("http://localhost/api/routes-f/chat-commands/execute", {
        creator_id: "creator_alice",
        trigger: "!nonexistent",
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 for disabled command", async () => {
    const res = await executePost(
      makePost("http://localhost/api/routes-f/chat-commands/execute", {
        creator_id: "creator_alice",
        trigger: "!tip",
      })
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/routes-f/chat-commands/toggle", () => {
  it("enables a disabled command", async () => {
    const res = await togglePost(
      makePost("http://localhost/api/routes-f/chat-commands/toggle", {
        creator_id: "creator_alice",
        command_id: "cmd_3",
        enabled: true,
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.command.enabled).toBe(true);
  });

  it("returns 404 for unknown command_id", async () => {
    const res = await togglePost(
      makePost("http://localhost/api/routes-f/chat-commands/toggle", {
        creator_id: "creator_alice",
        command_id: "cmd_nonexistent",
        enabled: true,
      })
    );
    expect(res.status).toBe(404);
  });
});
