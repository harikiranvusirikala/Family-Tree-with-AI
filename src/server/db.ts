import { MongoClient, type Db } from "mongodb";

export interface Database {
  client: MongoClient; // needed for transactions
  db: Db;
}

// One client per server instance, reused across requests, hot reloads and serverless invocations.
const cache = globalThis as unknown as { familyTreeMongo?: MongoClient };

function requireEnv(name: "MONGODB_URI" | "MONGODB_DB"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

/**
 * The app's database, from MONGODB_URI and MONGODB_DB, without connecting: the driver connects on
 * first use. Better Auth gets this at import time, so the build never touches the database. Its
 * queries never connect again after a failed connection (see getDatabase), so getUser() and its route
 * call getDatabase() first.
 */
export function lazyDatabase(): Database {
  const client = (cache.familyTreeMongo ??= new MongoClient(requireEnv("MONGODB_URI")));
  return { client, db: client.db(requireEnv("MONGODB_DB")) };
}

/**
 * The app's database, connected. A failed connection is retried by the next call. The driver (7.7)
 * keeps a failed attempt's closed topology, and any query that doesn't call connect() then fails
 * with "Topology is closed" until something does (found on production, through Better Auth).
 */
export async function getDatabase(): Promise<Database> {
  const database = lazyDatabase();
  await database.client.connect(); // returns at once when already connected
  return database;
}

/** Closes the shared client. For scripts, which must exit when done. */
export async function closeDatabase(): Promise<void> {
  const client = cache.familyTreeMongo;
  cache.familyTreeMongo = undefined;
  await client?.close();
}

/** A separate connection to a named database, for tests and scripts. Close `client` when done. */
export async function openDatabase(name: string, uri = requireEnv("MONGODB_URI")): Promise<Database> {
  const client = await new MongoClient(uri).connect();
  return { client, db: client.db(name) };
}
