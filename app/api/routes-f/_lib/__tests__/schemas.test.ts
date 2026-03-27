/**
 * Unit tests for shared routes-f Zod schemas.
 * Covers valid and invalid inputs for each schema.
 */

import {
  stellarPublicKeySchema,
  usernameSchema,
  usdcAmountSchema,
  paginationSchema,
  periodSchema,
  emailSchema,
  urlSchema,
  uuidSchema,
} from "../schemas";

// ── stellarPublicKeySchema ─────────────────────────────────────────────────────

describe("stellarPublicKeySchema", () => {
  it("accepts a valid Stellar public key", () => {
    // 56 characters: G + 55 uppercase alphanumeric
    const key = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN2";
    expect(stellarPublicKeySchema.safeParse(key).success).toBe(true);
  });

  it("rejects a key that does not start with G", () => {
    const result = stellarPublicKeySchema.safeParse(
      "BAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
    );
    expect(result.success).toBe(false);
  });

  it("rejects a key that is too short", () => {
    expect(stellarPublicKeySchema.safeParse("GAAZI4TCR3").success).toBe(false);
  });

  it("rejects a key with lowercase letters", () => {
    const result = stellarPublicKeySchema.safeParse(
      "gaazi4tcr3ty5ojhctjc2a4qsy6cjwjh5iajtgkin2er7lbnvkoccwn"
    );
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(stellarPublicKeySchema.safeParse("").success).toBe(false);
  });
});

// ── usernameSchema ─────────────────────────────────────────────────────────────

describe("usernameSchema", () => {
  it("accepts a valid username", () => {
    expect(usernameSchema.safeParse("alice_99").success).toBe(true);
  });

  it("accepts the minimum length (3 characters)", () => {
    expect(usernameSchema.safeParse("abc").success).toBe(true);
  });

  it("accepts the maximum length (30 characters)", () => {
    expect(usernameSchema.safeParse("a".repeat(30)).success).toBe(true);
  });

  it("rejects a username that is too short", () => {
    const result = usernameSchema.safeParse("ab");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/at least 3/);
    }
  });

  it("rejects a username that is too long", () => {
    expect(usernameSchema.safeParse("a".repeat(31)).success).toBe(false);
  });

  it("rejects a username with special characters", () => {
    expect(usernameSchema.safeParse("alice!").success).toBe(false);
  });

  it("rejects a username with spaces", () => {
    expect(usernameSchema.safeParse("alice bob").success).toBe(false);
  });
});

// ── usdcAmountSchema ───────────────────────────────────────────────────────────

describe("usdcAmountSchema", () => {
  it("accepts a whole number", () => {
    expect(usdcAmountSchema.safeParse("100").success).toBe(true);
  });

  it("accepts a number with 1 decimal place", () => {
    expect(usdcAmountSchema.safeParse("10.5").success).toBe(true);
  });

  it("accepts a number with 2 decimal places", () => {
    expect(usdcAmountSchema.safeParse("9.99").success).toBe(true);
  });

  it("rejects a number with 3 decimal places", () => {
    expect(usdcAmountSchema.safeParse("9.999").success).toBe(false);
  });

  it("rejects zero", () => {
    const result = usdcAmountSchema.safeParse("0");
    expect(result.success).toBe(false);
  });

  it("rejects a negative number", () => {
    expect(usdcAmountSchema.safeParse("-5.00").success).toBe(false);
  });

  it("rejects non-numeric strings", () => {
    expect(usdcAmountSchema.safeParse("abc").success).toBe(false);
  });
});

// ── paginationSchema ───────────────────────────────────────────────────────────

describe("paginationSchema", () => {
  it("applies default limit of 20 when omitted", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it("coerces a string limit to a number", () => {
    const result = paginationSchema.safeParse({ limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("rejects limit below 1", () => {
    expect(paginationSchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it("rejects limit above 100", () => {
    expect(paginationSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it("accepts an optional cursor", () => {
    const result = paginationSchema.safeParse({ cursor: "abc123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBe("abc123");
    }
  });

  it("cursor is optional", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBeUndefined();
    }
  });
});

// ── periodSchema ───────────────────────────────────────────────────────────────

describe("periodSchema", () => {
  const valid = ["7d", "30d", "90d", "all"] as const;

  valid.forEach(period => {
    it(`accepts "${period}"`, () => {
      expect(periodSchema.safeParse(period).success).toBe(true);
    });
  });

  it("rejects an unknown period", () => {
    expect(periodSchema.safeParse("1y").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(periodSchema.safeParse("").success).toBe(false);
  });
});

// ── emailSchema ────────────────────────────────────────────────────────────────

describe("emailSchema", () => {
  it("accepts a valid email", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
  });

  it("rejects an email without @", () => {
    expect(emailSchema.safeParse("userexample.com").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(emailSchema.safeParse("").success).toBe(false);
  });

  it("rejects an email over 255 characters", () => {
    // 256 chars: 249 + "@" + "b" + ".co" + padding
    const long = "a".repeat(251) + "@b.co";
    expect(emailSchema.safeParse(long).success).toBe(false);
  });
});

// ── urlSchema ──────────────────────────────────────────────────────────────────

describe("urlSchema", () => {
  it("accepts a valid https URL", () => {
    expect(urlSchema.safeParse("https://example.com/path").success).toBe(true);
  });

  it("accepts a valid http URL", () => {
    expect(urlSchema.safeParse("http://localhost:3000").success).toBe(true);
  });

  it("rejects a string without a protocol", () => {
    expect(urlSchema.safeParse("example.com").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(urlSchema.safeParse("").success).toBe(false);
  });
});

// ── uuidSchema ─────────────────────────────────────────────────────────────────

describe("uuidSchema", () => {
  it("accepts a valid UUIDv4", () => {
    expect(
      uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success
    ).toBe(true);
  });

  it("rejects a UUID missing hyphens", () => {
    expect(
      uuidSchema.safeParse("550e8400e29b41d4a716446655440000").success
    ).toBe(false);
  });

  it("rejects a string that is too short", () => {
    expect(uuidSchema.safeParse("550e8400-e29b").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(uuidSchema.safeParse("").success).toBe(false);
  });
});
