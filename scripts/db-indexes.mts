// Lists every collection's indexes, with document counts and how often each index was used:
// `npm run db:indexes` for MONGODB_DB, or `npm run db:indexes -- familytree_preview familytree`.
// Read-only.
import { closeDatabase, getDatabase } from "@/server/db";

try {
  const { client, db: defaultDb } = await getDatabase();
  const names = process.argv.slice(2);
  for (const name of names.length ? names : [defaultDb.databaseName]) {
    const db = client.db(name);
    const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
    console.log(`\n${name}: ${collections.length} collections`);
    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      const count = await collection.estimatedDocumentCount();
      // How often each index was used since the server last started; not every cluster tier allows it.
      const used = new Map<string, number>();
      try {
        for (const s of await collection.aggregate<{ name: string; accesses: { ops: number } }>([{ $indexStats: {} }]).toArray()) used.set(s.name, Number(s.accesses.ops));
      } catch {
        // no usage counts
      }
      console.log(`  ${collectionName} (${count} ${count === 1 ? "document" : "documents"})`);
      for (const index of await collection.listIndexes().toArray()) {
        const flags = [
          index.unique && "unique",
          index.partialFilterExpression && `partial ${JSON.stringify(index.partialFilterExpression)}`,
          index.expireAfterSeconds !== undefined && `TTL ${index.expireAfterSeconds}s`,
          used.has(index.name) && `used ${used.get(index.name)}×`,
        ].filter(Boolean);
        console.log(`    ${index.name}: ${JSON.stringify(index.key)}${flags.length ? `  [${flags.join(", ")}]` : ""}`);
      }
    }
  }
} catch (error) {
  console.error("Could not list the indexes:", (error as Error).message);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
