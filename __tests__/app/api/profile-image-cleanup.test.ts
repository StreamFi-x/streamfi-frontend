/**
 * @jest-environment node
 *
 * Profile image replacement (#1864): the old Cloudinary image is deleted only
 * after the users row is updated, and Cloudinary failures never fail the save.
 */
import { NextRequest } from "next/server";
import { createSqlMock } from "@/testing/sql-mock";

const mockDb = createSqlMock();
jest.mock("@vercel/postgres", () => ({
  sql: (...args: unknown[]) => mockDb.sql(...args),
}));
jest.mock("@/lib/mux/server", () => ({
  updateMuxStreamRecording: jest.fn(async () => ({ success: true })),
}));
jest.mock("@/lib/cache/invalidation", () => ({
  invalidateUserCaches: jest.fn(),
}));
jest.mock("@/lib/auth/verify-session", () => ({
  verifySession: jest.fn(async () => ({ ok: true, wallet: "w1" })),
}));
jest.mock("@/lib/dev-mode", () => ({ shouldBypassAuth: () => true }));
jest.mock("@/utils/upload/cloudinary", () => ({
  uploadImageFromBuffer: jest.fn(),
  deleteImage: jest.fn(),
  extractPublicIdFromUrl: jest.fn((url: string) =>
    url.includes("res.cloudinary.com") ? `id:${url}` : null
  ),
}));

import { deleteImage, uploadImageFromBuffer } from "@/utils/upload/cloudinary";
import { PUT as updateByWallet } from "@/app/api/users/updates/[wallet]/route";
import { PUT as updateByPrivy } from "@/app/api/users/updates/privy/[privyId]/route";

const OLD_AVATAR = "https://res.cloudinary.com/demo/image/upload/v1/old.png";
const NEW_AVATAR = "https://res.cloudinary.com/demo/image/upload/v2/new.png";

const routes = [
  {
    name: "wallet",
    put: (req: NextRequest) =>
      updateByWallet(req, { params: Promise.resolve({ wallet: "w1" }) }),
  },
  {
    name: "privy",
    put: (req: NextRequest) =>
      updateByPrivy(req, { params: Promise.resolve({ privyId: "p1" }) }),
  },
];

function avatarRequest() {
  const form = new FormData();
  form.append("avatar", new Blob(["img"], { type: "image/png" }), "a.png");
  return new NextRequest("http://localhost/api/users/updates/x", {
    method: "PUT",
    body: form,
  });
}

beforeEach(() => {
  mockDb.reset();
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  (uploadImageFromBuffer as jest.Mock).mockResolvedValue({
    public_id: "avatars/new",
    secure_url: NEW_AVATAR,
  });
  mockDb.on(/SELECT id, username, email, bio/, {
    rows: [
      {
        id: "u1",
        username: "alice",
        email: "a@b.io",
        avatar: OLD_AVATAR,
        banner: null,
        enable_recording: false,
        mux_stream_id: null,
      },
    ],
  });
});

describe.each(routes)("PUT updates ($name route) image cleanup", ({ put }) => {
  it("deletes the old image only after the row is updated", async () => {
    const order: string[] = [];
    mockDb.on(/UPDATE users SET/, () => {
      order.push("update");
      return { rows: [{ id: "u1" }] };
    });
    (deleteImage as jest.Mock).mockImplementation(async (id: string) => {
      order.push(`delete:${id}`);
    });

    const res = await put(avatarRequest());

    expect(res.status).toBe(200);
    expect(order).toEqual(["update", `delete:id:${OLD_AVATAR}`]);
  });

  it("keeps the old image and removes the new upload when the update fails", async () => {
    mockDb.on(/UPDATE users SET/, () => {
      throw new Error("db down");
    });

    const res = await put(avatarRequest());

    expect(res.status).toBe(500);
    expect(deleteImage).toHaveBeenCalledTimes(1);
    expect(deleteImage).toHaveBeenCalledWith("avatars/new");
    expect(deleteImage).not.toHaveBeenCalledWith(`id:${OLD_AVATAR}`);
  });

  it("does not fail the request when deleting the old image throws", async () => {
    mockDb.on(/UPDATE users SET/, { rows: [{ id: "u1" }] });
    (deleteImage as jest.Mock).mockRejectedValue(new Error("cloudinary down"));

    const res = await put(avatarRequest());

    expect(res.status).toBe(200);
    expect(deleteImage).toHaveBeenCalledWith(`id:${OLD_AVATAR}`);
    expect(console.error).toHaveBeenCalled();
  });

  it("still reports the DB failure when rolling back the new upload also throws", async () => {
    mockDb.on(/UPDATE users SET/, () => {
      throw new Error("db down");
    });
    (deleteImage as jest.Mock).mockRejectedValue(new Error("cloudinary down"));

    const res = await put(avatarRequest());

    expect(res.status).toBe(500);
  });
});
