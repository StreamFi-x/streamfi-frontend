/**
 * @jest-environment node
 */
jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));
jest.mock("../index", () => ({ invalidateTags: jest.fn() }));

import { sql } from "@vercel/postgres";
import { invalidateTags } from "../index";
import {
  invalidateCategoryCaches,
  invalidateFollowCaches,
  invalidateUserCaches,
} from "../invalidation";
import { cacheTags } from "../tags";

const sqlMock = sql as unknown as jest.Mock;
const invalidateMock = invalidateTags as jest.Mock;
const tagsOf = (call = 0) =>
  [...(invalidateMock.mock.calls[call][0] as string[])].sort();

describe("invalidateUserCaches", () => {
  beforeEach(() => {
    sqlMock.mockReset();
    invalidateMock.mockReset();
  });

  it("uses the identifiers it is given without a lookup", async () => {
    await invalidateUserCaches({ username: "Alice", wallet: "GA" });
    expect(sqlMock).not.toHaveBeenCalled();
    expect(tagsOf()).toEqual(
      [cacheTags.userByName("alice"), cacheTags.userByWallet("GA")].sort()
    );
  });

  it("resolves the username when a write only knows the wallet", async () => {
    sqlMock.mockResolvedValue({ rows: [{ username: "alice", wallet: "GA" }] });
    await invalidateUserCaches({ wallet: "GA" });
    expect(tagsOf()).toContain(cacheTags.userByName("alice"));
  });

  it("clears the old handle and wallet after a rename or wallet rotation", async () => {
    sqlMock.mockResolvedValue({ rows: [{ username: "new", wallet: "GNEW" }] });
    await invalidateUserCaches({
      id: "u1",
      previousUsername: "old",
      previousWallet: "GOLD",
    });
    expect(tagsOf()).toEqual(
      [
        cacheTags.userByName("new"),
        cacheTags.userByName("old"),
        cacheTags.userByWallet("GNEW"),
        cacheTags.userByWallet("GOLD"),
      ].sort()
    );
  });

  it("still invalidates what it knows when the lookup fails", async () => {
    const err = jest.spyOn(console, "error").mockImplementation(() => {});
    sqlMock.mockRejectedValue(new Error("db down"));
    await expect(
      invalidateUserCaches({ id: "u1", username: "alice" })
    ).resolves.toBeUndefined();
    expect(tagsOf()).toEqual([cacheTags.userByName("alice")]);
    err.mockRestore();
  });

  it("invalidates both sides of a follow edge", async () => {
    sqlMock
      .mockResolvedValueOnce({ rows: [{ username: "fan", wallet: "GF" }] })
      .mockResolvedValueOnce({ rows: [{ username: "star", wallet: "GS" }] });
    await invalidateFollowCaches("fan-id", "star-id");
    const all = invalidateMock.mock.calls.flatMap(c => c[0]);
    expect(all).toEqual(
      expect.arrayContaining([
        cacheTags.userByName("fan"),
        cacheTags.userByName("star"),
      ])
    );
  });

  it("invalidates the categories tag", async () => {
    await invalidateCategoryCaches();
    expect(tagsOf()).toEqual([cacheTags.categories()]);
  });
});
