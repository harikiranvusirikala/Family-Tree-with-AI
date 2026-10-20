// Restores a backup (F12), writing with MONGODB_URI:
//   npm run restore -- <file> <database> [--replace]   into a database (refused if it has records, unless --replace)
//   npm run restore -- <file> --check                  into a throwaway database: checks the counts, then empties it
// Asks for the key if BACKUP_ENCRYPTION_KEY isn't set, so it stays out of the shell's history.
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { parseArgs } from "node:util";
import { countsLine, restoreDatabase } from "@/server/backup/archive";
import { BackupError, backupKey, decrypt } from "@/server/backup/crypt";
import { openDatabase } from "@/server/db";
import { emptyDatabase, testDatabaseName } from "@test/db";

const USAGE = "Usage: npm run restore -- <file> <database> [--replace], or npm run restore -- <file> --check";

async function askForKey(): Promise<string> {
  if (!process.stdin.isTTY) throw new BackupError("Set BACKUP_ENCRYPTION_KEY.");
  process.stdout.write("Backup key (BACKUP_ENCRYPTION_KEY, not shown): ");
  // Typed characters are echoed to a stream that drops them.
  const muted = new Writable({ write: (_chunk, _encoding, done) => done() });
  const prompt = createInterface({ input: process.stdin, output: muted, terminal: true });
  try {
    return await prompt.question("");
  } finally {
    prompt.close();
    process.stdout.write("\n");
  }
}

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { replace: { type: "boolean" }, check: { type: "boolean" } } });
  const [file, target, ...extra] = positionals;
  if (!file || extra.length || (values.check ? target || values.replace : !target)) throw new BackupError(USAGE);

  const contents = await readFile(file).catch(() => {
    throw new BackupError(`Can't read ${file}.`);
  });
  const key = backupKey(process.env.BACKUP_ENCRYPTION_KEY || (await askForKey()));
  const data = decrypt(contents, key);
  const { client, db } = await openDatabase(values.check ? testDatabaseName("restore") : target);
  try {
    const header = await restoreDatabase(db, data, { replace: values.replace });
    console.log(`Restored the ${header.database} backup of ${header.createdAt} into ${db.databaseName}, and the counts match: ${countsLine(header)}`);
  } finally {
    if (values.check) await emptyDatabase(db);
    await client.close();
  }
} catch (error) {
  if (!(error instanceof BackupError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
