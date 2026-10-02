import { validateAgainstSchema } from "../route";

describe("validateAgainstSchema", () => {
  it("passes a valid object", () => {
    const schema = {
      type: "object",
      required: ["name", "age"],
      properties: {
        name: { type: "string", minLength: 1, maxLength: 50 },
        age: { type: "integer", minimum: 0, maximum: 130 },
        role: { type: "string", enum: ["admin", "user"] },
      },
    };
    const r = validateAgainstSchema(schema, { name: "Ada", age: 36, role: "admin" });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("flags a type mismatch", () => {
    const r = validateAgainstSchema({ type: "number" }, "nope");
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toMatch(/expected type number/);
  });

  it("flags missing required properties", () => {
    const r = validateAgainstSchema(
      { type: "object", required: ["id"], properties: {} },
      {},
    );
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toEqual({ path: "id", message: "required property is missing" });
  });

  it("enforces minimum/maximum", () => {
    expect(validateAgainstSchema({ type: "number", minimum: 10 }, 5).valid).toBe(false);
    expect(validateAgainstSchema({ type: "number", maximum: 10 }, 20).valid).toBe(false);
    expect(validateAgainstSchema({ type: "number", minimum: 0, maximum: 10 }, 5).valid).toBe(true);
  });

  it("enforces minLength/maxLength", () => {
    expect(validateAgainstSchema({ type: "string", minLength: 3 }, "ab").valid).toBe(false);
    expect(validateAgainstSchema({ type: "string", maxLength: 3 }, "abcd").valid).toBe(false);
  });

  it("enforces enum", () => {
    expect(validateAgainstSchema({ enum: ["a", "b"] }, "c").valid).toBe(false);
    expect(validateAgainstSchema({ enum: ["a", "b"] }, "a").valid).toBe(true);
  });

  it("reports nested property paths", () => {
    const schema = {
      type: "object",
      properties: { user: { type: "object", properties: { age: { type: "integer", minimum: 0 } } } },
    };
    const r = validateAgainstSchema(schema, { user: { age: -1 } });
    expect(r.valid).toBe(false);
    expect(r.errors[0].path).toBe("user.age");
  });
});
