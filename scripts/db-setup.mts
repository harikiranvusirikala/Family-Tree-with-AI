// Creates the collections' indexes in MONGODB_DB: `npm run db:setup`. Safe to run repeatedly.
import { closeDatabase, getDatabase } from "@/server/db";
import { ensureIndexes } from "@/server/repositories/documents";

try {
  const { db } = await getDatabase();
  await ensureIndexes(db);
  console.log(`Indexes are in place in ${db.databaseName}.`);
} finally {
  await closeDatabase();
}
