// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";
import { MongoServerSelectionError, MongoTopologyClosedError } from "mongodb";
import { closeDatabase, getDatabase, lazyDatabase } from "./db";

// Nothing listens on port 1, so every connection fails at once: no database needed.
const NOWHERE = "mongodb://127.0.0.1:1/?directConnection=true&serverSelectionTimeoutMS=200";

afterEach(async () => {
  await closeDatabase();
  vi.unstubAllEnvs();
});

describe("the shared client after a failed connection (found on production)", () => {
  test("the driver keeps the closed attempt: queries fail with 'Topology is closed' until connect() runs again", async () => {
    vi.stubEnv("MONGODB_URI", NOWHERE);
    vi.stubEnv("MONGODB_DB", "familytree_test");
    const { db } = lazyDatabase(); // what Better Auth was given
    await expect(getDatabase()).rejects.toBeInstanceOf(MongoServerSelectionError);
    // Better Auth's own queries never call connect(): this is the error on production.
    await expect(db.collection("sessions").findOne({})).rejects.toBeInstanceOf(MongoTopologyClosedError);
    // getDatabase() connects again: a new attempt, not the closed one.
    await expect(getDatabase()).rejects.toBeInstanceOf(MongoServerSelectionError);
  });
});
