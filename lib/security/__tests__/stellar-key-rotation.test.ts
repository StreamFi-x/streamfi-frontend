import { processWalletKeyBatch } from "@/lib/security/stellar-key-rotation";

describe("resumable wallet key batches", () => {
  it("dry-runs legacy rows without writing and returns the checkpoint cursor", async () => {
    const replace = jest.fn();
    const result = await processWalletKeyBatch([
      { id: "u1", encrypted_stellar_key: "legacy-envelope" },
      { id: "u2", encrypted_stellar_key: "v1:active:iv:tag:cipher" },
    ], "active", true, value => `plain:${value}`, value => `v1:active:${value}`, replace);

    expect(result).toEqual({ examined: 2, rewritten: 0, lastUserId: "u2" });
    expect(replace).not.toHaveBeenCalled();
  });

  it("rewrites old-key rows and skips already-active envelopes on resume", async () => {
    const replace = jest.fn().mockResolvedValue(undefined);
    const result = await processWalletKeyBatch([
      { id: "u3", encrypted_stellar_key: "v1:old:iv:tag:cipher" },
      { id: "u4", encrypted_stellar_key: "v1:active:iv:tag:cipher" },
    ], "active", false, value => `plain:${value}`, value => `v1:active:${value}`, replace);

    expect(result).toEqual({ examined: 2, rewritten: 1, lastUserId: "u4" });
    expect(replace).toHaveBeenCalledWith("u3", "v1:old:iv:tag:cipher", "v1:active:plain:v1:old:iv:tag:cipher");
  });
});