// Loads the sample family into MONGODB_DB (familytree_dev locally): `npm run seed`.
// Replaces the sample group's content each time; other groups are untouched.
import { closeDatabase, getDatabase } from "@/server/db";
import { ensureIndexes } from "@/server/repositories/documents";
import { loadGroupTree } from "@/server/repositories/family";
import { SAMPLE_GROUP_ID, seedSampleFamily } from "@test/fixtures/seed";

try {
  const database = await getDatabase();
  await ensureIndexes(database.db);
  await seedSampleFamily(database);
  const tree = await loadGroupTree(database.db, SAMPLE_GROUP_ID);
  console.log(
    `Seeded ${database.db.databaseName}, group ${SAMPLE_GROUP_ID}: ` +
      `${tree.persons.length} people, ${tree.unions.length} couples, ${tree.sheets.length} sheets.`,
  );
} finally {
  await closeDatabase();
}
