import { openDatabase } from "@/server/db";
import { ensureIndexes } from "@/server/repositories/documents";
import { dropStaleTestDatabases } from "@test/db";
import { seedSampleFamily } from "@test/fixtures/seed";

/** Seeds this run's throwaway database (named in playwright.config.ts) with the sample family. */
export default async function globalSetup() {
  const database = await openDatabase(process.env.E2E_MONGODB_DB!);
  try {
    await dropStaleTestDatabases(database.client);
    await ensureIndexes(database.db);
    await seedSampleFamily(database);
  } finally {
    await database.client.close();
  }
}
