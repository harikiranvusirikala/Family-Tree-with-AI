import type { Db, MongoClient } from "mongodb";
import { openDatabase, type Database } from "@/server/db";

const PREFIX = "familytree_test_";

/** familytree_test_<base-36 time>_<label>; the time lets stale databases be found later. */
export const testDatabaseName = (label: string) => `${PREFIX}${Date.now().toString(36)}_${label}`;

/**
 * Removes a database by dropping its collections: MongoDB deletes a database once it has none.
 * (The app's database users have read/write access, which doesn't include dropping databases.)
 */
export async function emptyDatabase(db: Db): Promise<void> {
  for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) await db.dropCollection(name);
}

/** Removes test databases older than an hour, left behind by runs that crashed. */
export async function dropStaleTestDatabases(client: MongoClient): Promise<void> {
  try {
    const { databases } = await client.db().admin().listDatabases({ nameOnly: true });
    for (const { name } of databases) {
      if (!name.startsWith(PREFIX)) continue;
      const created = parseInt(name.slice(PREFIX.length).split("_")[0], 36);
      if (!(Date.now() - created < 3_600_000)) await emptyDatabase(client.db(name));
    }
  } catch (error) {
    console.warn("Could not clean up old test databases:", (error as Error).message);
  }
}

/** A throwaway database for one test file. Call drop() in afterAll. */
export async function createTestDatabase(): Promise<Database & { drop(): Promise<void> }> {
  const database = await openDatabase(testDatabaseName(Math.random().toString(36).slice(2, 6)));
  return {
    ...database,
    async drop() {
      await emptyDatabase(database.db);
      await database.client.close();
    },
  };
}
