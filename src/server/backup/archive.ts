// What a backup holds (F12): a header line, then one line per document in canonical Extended JSON,
// so ids, dates and number types come back exactly. Gzip-compressed; crypt.ts encrypts it.
import { gunzipSync, gzipSync } from "node:zlib";
import { BSON, type Db, type Document } from "mongodb";
import { BackupError } from "./crypt";

const { EJSON } = BSON;

export const BACKUP_FORMAT = "family-tree-backup";
/** Sign-in leftovers that expire anyway; after a restore everyone signs in again (decided in step 11). */
export const NOT_BACKED_UP = ["sessions", "verifications"];

export interface BackupHeader {
  format: typeof BACKUP_FORMAT;
  version: 1;
  database: string;
  createdAt: string;
  /** Each collection's number of documents, and its indexes other than `_id`'s. */
  collections: Record<string, { count: number; indexes: Document[] }>;
}

export interface BackupContents {
  header: BackupHeader;
  documents: Record<string, Document[]>;
}

export function encodeBackup(database: string, createdAt: Date, collections: { name: string; indexes: Document[]; documents: Document[] }[]): BackupContents & { data: Buffer } {
  const header: BackupHeader = {
    format: BACKUP_FORMAT,
    version: 1,
    database,
    createdAt: createdAt.toISOString(),
    collections: Object.fromEntries(collections.map((c) => [c.name, { count: c.documents.length, indexes: c.indexes }])),
  };
  const lines = [EJSON.stringify(header, { relaxed: true })];
  for (const { name, documents } of collections) for (const d of documents) lines.push(EJSON.stringify({ c: name, d }, { relaxed: false }));
  return { header, documents: Object.fromEntries(collections.map((c) => [c.name, c.documents])), data: gzipSync(`${lines.join("\n")}\n`) };
}

export function decodeBackup(data: Buffer): BackupContents {
  let lines: string[];
  try {
    lines = gunzipSync(data).toString("utf8").split("\n").filter(Boolean);
  } catch {
    throw new BackupError("The backup's contents are damaged.");
  }
  const header = EJSON.parse(lines[0] ?? "null", { relaxed: true }) as BackupHeader | null;
  if (header?.format !== BACKUP_FORMAT) throw new BackupError("This isn't a Family Tree backup.");
  if (header.version !== 1) throw new BackupError(`This backup is version ${header.version}; this app reads version 1.`);
  const documents: Record<string, Document[]> = Object.fromEntries(Object.keys(header.collections).map((name) => [name, []]));
  for (const line of lines.slice(1)) {
    // Canonical, not relaxed: a double stays a double, a 64-bit integer stays one.
    const { c, d } = EJSON.parse(line, { relaxed: false }) as { c: string; d: Document };
    if (!documents[c]) throw new BackupError(`The backup has records for ${c}, which its header doesn't list.`);
    documents[c].push(d);
  }
  for (const [name, { count }] of Object.entries(header.collections)) {
    if (documents[name].length !== count) throw new BackupError(`The backup has ${documents[name].length} of ${count} records for ${name}.`);
  }
  return { header, documents };
}

/** Every collection except NOT_BACKED_UP, with its indexes. Needs only read access. */
export async function backupDatabase(db: Db, now = new Date()): Promise<BackupContents & { data: Buffer }> {
  const names = (await db.listCollections({ type: "collection" }, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => !NOT_BACKED_UP.includes(name) && !name.startsWith("system."))
    .sort();
  const collections = [];
  for (const name of names) {
    const collection = db.collection(name);
    const indexes = (await collection.listIndexes().toArray())
      .filter((index) => index.name !== "_id_")
      .map((index) => {
        const spec: Document = { ...index };
        delete spec.v; // the index format version; the server picks it
        delete spec.ns;
        return spec;
      });
    collections.push({ name, indexes, documents: await collection.find({}, { sort: { _id: 1 } }).toArray() });
  }
  return encodeBackup(db.databaseName, now, collections);
}

/**
 * Puts a backup's collections into `db` and checks their counts. Refuses if any of them already has
 * records, unless `replace` (which drops them first), so production can't be overwritten by mistake.
 */
export async function restoreDatabase(db: Db, data: Buffer, { replace = false } = {}): Promise<BackupHeader> {
  const { header, documents } = decodeBackup(data);
  const names = Object.keys(header.collections);
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const holding = [];
  for (const name of names) if (existing.has(name) && (await db.collection(name).countDocuments({}, { limit: 1 })) > 0) holding.push(name);
  if (holding.length && !replace) {
    throw new BackupError(`${db.databaseName} already has records in ${holding.join(", ")}. Restore into an empty database, or add --replace to replace them.`);
  }

  for (const name of names) {
    if (existing.has(name)) await db.dropCollection(name);
    const collection = await db.createCollection(name);
    const records = documents[name];
    for (let i = 0; i < records.length; i += 1000) await collection.insertMany(records.slice(i, i + 1000));
    // Counted before the indexes go on: a TTL index could otherwise remove expired records first.
    const count = await collection.countDocuments();
    const expected = header.collections[name].count;
    if (count !== expected) throw new BackupError(`${name}: ${count} records restored, ${expected} expected.`);
    const { indexes } = header.collections[name];
    if (indexes.length) await db.command({ createIndexes: name, indexes });
  }
  return header;
}

/** "groups 2, persons 36, …" */
export const countsLine = (header: BackupHeader) =>
  Object.entries(header.collections)
    .map(([name, { count }]) => `${name} ${count}`)
    .join(", ");

/** familytree-2026-10-19T21-17-03Z.ftbackup */
export const backupFileName = (header: BackupHeader) => `${header.database}-${header.createdAt.slice(0, 19).replace(/:/g, "-")}Z.ftbackup`;
