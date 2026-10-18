import { MongoClient, type Db } from "mongodb";

export interface Database {
  client: MongoClient; // needed for transactions
  db: Db;
}

// One client per server instance, reused across requests, hot reloads and serverless invocations.
const cache = globalThis as unknown as { familyTreeMongo?: Promise<MongoClient> };

function requireEnv(name: "MONGODB_URI" | "MONGODB_DB"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

/** The app's database, from MONGODB_URI and MONGODB_DB. */
export async function getDatabase(): Promise<Database> {
  cache.familyTreeMongo ??= new MongoClient(requireEnv("MONGODB_URI")).connect().catch((error) => {
    cache.familyTreeMongo = undefined; // let the next request retry
    throw error;
  });
  const client = await cache.familyTreeMongo;
  return { client, db: client.db(requireEnv("MONGODB_DB")) };
}

/** Closes the shared client. For scripts, which must exit when done. */
export async function closeDatabase(): Promise<void> {
  const client = await cache.familyTreeMongo;
  cache.familyTreeMongo = undefined;
  await client?.close();
}

/** A separate connection to a named database, for tests and scripts. Close `client` when done. */
export async function openDatabase(name: string, uri = requireEnv("MONGODB_URI")): Promise<Database> {
  const client = await new MongoClient(uri).connect();
  return { client, db: client.db(name) };
}
