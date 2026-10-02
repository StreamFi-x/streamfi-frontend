jest.mock("@vercel/postgres", () => ({ sql: jest.fn() }));

import { roleCanAccess } from "@/lib/admin-auth";

describe("admin role capabilities", () => {
  it("limits support to report review", () => {
    expect(roleCanAccess("support", "support")).toBe(true);
    expect(roleCanAccess("support", "moderation")).toBe(false);
    expect(roleCanAccess("support", "admin")).toBe(false);
  });

  it("grants moderators moderation and support capabilities, but not administration", () => {
    expect(roleCanAccess("moderator", "support")).toBe(true);
    expect(roleCanAccess("moderator", "moderation")).toBe(true);
    expect(roleCanAccess("moderator", "admin")).toBe(false);
  });

  it("grants all capabilities only to super-admins", () => {
    expect(roleCanAccess("super_admin", "support")).toBe(true);
    expect(roleCanAccess("super_admin", "moderation")).toBe(true);
    expect(roleCanAccess("super_admin", "admin")).toBe(true);
    expect(roleCanAccess("admin", "admin")).toBe(false);
  });
});