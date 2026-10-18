// Checks the MongoDB connection from .env.local: `npm run db:ping`.
import { closeDatabase, getDatabase } from "@/server/db";

try {
  const { db } = await getDatabase();
  await db.command({ ping: 1 });
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
  console.log(`Connected to ${db.databaseName}. Collections: ${collections.join(", ") || "(none yet)"}`);
} catch (error) {
  console.error("Could not connect:", (error as Error).message);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
