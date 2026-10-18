import { openDatabase } from "@/server/db";
import { emptyDatabase } from "@test/db";

/** Removes this run's throwaway database. */
export default async function globalTeardown() {
  const database = await openDatabase(process.env.E2E_MONGODB_DB!);
  try {
    await emptyDatabase(database.db);
  } finally {
    await database.client.close();
  }
}
