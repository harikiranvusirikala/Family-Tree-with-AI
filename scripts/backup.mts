// Backs up the production database (F12): `npm run backup -- [--out <folder>]`. Reads with
// MONGODB_BACKUP_URI (a read-only user) from BACKUP_DB (familytree unless set), and writes one
// encrypted file. Run nightly by .github/workflows/backup.yml.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { backupDatabase, backupFileName, countsLine } from "@/server/backup/archive";
import { BackupError, backupKey, encrypt } from "@/server/backup/crypt";
import { openDatabase } from "@/server/db";

const { values } = parseArgs({ options: { out: { type: "string", default: "backups" } } });

try {
  const uri = process.env.MONGODB_BACKUP_URI;
  if (!uri) throw new BackupError("MONGODB_BACKUP_URI is not set: the connection string of the read-only backup user.");
  const key = backupKey(process.env.BACKUP_ENCRYPTION_KEY);
  const { client, db } = await openDatabase(process.env.BACKUP_DB || "familytree", uri);
  try {
    const { header, data } = await backupDatabase(db);
    if (!header.collections.groups) throw new BackupError(`${db.databaseName} has no groups collection: is BACKUP_DB right?`);
    const file = join(values.out, backupFileName(header));
    await mkdir(values.out, { recursive: true });
    await writeFile(file, encrypt(data, key), { mode: 0o600 });
    console.log(`Backed up ${db.databaseName} (${countsLine(header)}) to ${file}`);
  } finally {
    await client.close();
  }
} catch (error) {
  if (!(error instanceof BackupError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
