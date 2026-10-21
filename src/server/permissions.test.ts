// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";

// The order things happen in: getUser must connect before Better Auth reads the session.
const calls: string[] = [];
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("./db", () => ({ getDatabase: vi.fn(async () => void calls.push("connect")) }));
vi.mock("./auth", () => ({
  auth: { api: { getSession: vi.fn(async () => (calls.push("session"), { user: { id: "u1", name: "Asha", email: "asha@example.com", image: null } })) } },
}));
vi.mock("./repositories/groups", () => ({ roleInGroup: vi.fn() }));

const { getUser } = await import("./permissions");

beforeEach(() => {
  calls.length = 0;
});

describe("getUser (found on production: 'Topology is closed')", () => {
  test("connects the shared client before Better Auth reads the session", async () => {
    expect(await getUser()).toEqual({ id: "u1", name: "Asha", email: "asha@example.com" });
    expect(calls).toEqual(["connect", "session"]);
  });
});
