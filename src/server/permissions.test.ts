// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The order things happen in: getUser must connect before Better Auth reads the session.
const calls: string[] = [];
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("./db", () => ({ getDatabase: vi.fn(async () => void calls.push("connect")) }));
vi.mock("./auth", () => ({
  auth: { api: { getSession: vi.fn(async () => (calls.push("session"), { user: { id: "u1", name: "Asha", email: "asha@example.com", image: null } })) } },
}));
vi.mock("./repositories/groups", () => ({ roleInGroup: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not found");
  },
  redirect: vi.fn(),
}));

const { getUser, requireSiteAdmin } = await import("./permissions");

beforeEach(() => {
  calls.length = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getUser (found on production: 'Topology is closed')", () => {
  test("connects the shared client before Better Auth reads the session", async () => {
    expect(await getUser()).toEqual({ id: "u1", name: "Asha", email: "asha@example.com", image: null });
    expect(calls).toEqual(["connect", "session"]);
  });
});

describe("requireSiteAdmin (the site stats, an owner request)", () => {
  test("lets in the addresses in SITE_ADMIN_EMAILS", async () => {
    vi.stubEnv("SITE_ADMIN_EMAILS", "Asha@example.com");
    expect(await requireSiteAdmin()).toMatchObject({ email: "asha@example.com" });
  });

  test("anyone else gets the ordinary not found, as does everyone without the variable", async () => {
    vi.stubEnv("SITE_ADMIN_EMAILS", "owner@example.com");
    await expect(requireSiteAdmin()).rejects.toThrow("not found");
    vi.stubEnv("SITE_ADMIN_EMAILS", "");
    await expect(requireSiteAdmin()).rejects.toThrow("not found");
  });
});
