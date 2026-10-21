// @vitest-environment node
import { describe, expect, test, vi } from "vitest";

// The order things happen in: each request must connect before Better Auth handles it.
const calls: string[] = [];
vi.mock("@/server/auth", () => ({ auth: {} }));
vi.mock("@/server/db", () => ({ getDatabase: vi.fn(async () => void calls.push("connect")) }));
vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: () => ({
    GET: vi.fn(async () => (calls.push("GET"), new Response("ok"))),
    POST: vi.fn(async () => (calls.push("POST"), new Response("ok"))),
  }),
}));

const { GET, POST } = await import("./route");

describe("Better Auth's route (found on production: 'Topology is closed')", () => {
  test("connects the shared client before each request", async () => {
    expect((await GET(new Request("http://localhost/api/auth/get-session"))).status).toBe(200);
    expect((await POST(new Request("http://localhost/api/auth/sign-out", { method: "POST" }))).status).toBe(200);
    expect(calls).toEqual(["connect", "GET", "connect", "POST"]);
  });
});
