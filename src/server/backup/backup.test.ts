// @vitest-environment node
import { gunzipSync, gzipSync } from "node:zlib";
import { BSON, Decimal128, Double, Int32, Long, ObjectId } from "mongodb";
import { describe, expect, test } from "vitest";
import { backupFileName, countsLine, decodeBackup, encodeBackup } from "./archive";
import { BackupError, backupKey, decrypt, encrypt } from "./crypt";

const key = Buffer.alloc(32, 7);
const otherKey = Buffer.alloc(32, 8);

describe("backup encryption (F12)", () => {
  const plain = Buffer.from("the whole family, compressed");

  test("round trip, with a fresh IV each time", () => {
    const [a, b] = [encrypt(plain, key), encrypt(plain, key)];
    expect(decrypt(a, key)).toEqual(plain);
    expect(a.equals(b)).toBe(false);
    expect(a.includes(plain)).toBe(false);
  });

  test("a wrong key, a changed byte or a cut-off file is refused, never half-restored", () => {
    const file = encrypt(plain, key);
    expect(() => decrypt(file, otherKey)).toThrow("Wrong key, or the backup file is damaged or cut short.");
    const changed = Buffer.from(file);
    changed[20] ^= 1;
    expect(() => decrypt(changed, key)).toThrow("Wrong key, or the backup file is damaged or cut short.");
    expect(() => decrypt(file.subarray(0, file.length - 1), key)).toThrow("Wrong key, or the backup file is damaged or cut short.");
    expect(() => decrypt(file.subarray(0, 20), key)).toThrow("The backup file is cut short.");
  });

  test("a file that isn't a backup is named as such", () => {
    expect(() => decrypt(Buffer.from("PK\u0003\u0004 a zip file"), key)).toThrow("This isn't a Family Tree backup file.");
    expect(() => decrypt(Buffer.alloc(0), key)).toThrow(BackupError);
  });

  test("the key is 32 bytes in base64, as `openssl rand -base64 32` prints it", () => {
    const text = Buffer.alloc(32, 1).toString("base64");
    expect(backupKey(`${text}\n`)).toEqual(Buffer.alloc(32, 1));
    for (const bad of [undefined, "", Buffer.alloc(16).toString("base64"), Buffer.alloc(32).toString("hex"), `${text.slice(0, -2)}!=`]) {
      expect(() => backupKey(bad)).toThrow("BACKUP_ENCRYPTION_KEY must be 32 random bytes in base64");
    }
  });
});

describe("backup contents (F12)", () => {
  const person = {
    _id: new ObjectId(),
    groupId: new ObjectId(),
    name: "Jake Cruz",
    birthYear: 1945,
    deletedAt: null,
    createdAt: new Date("2026-10-19T10:00:00.123Z"),
    tags: [{ nested: [1, "two", new ObjectId()] }],
    double: new Double(2),
    long: Long.fromString("9007199254740993"),
    decimal: Decimal128.fromString("0.1"),
    int: new Int32(5),
  };
  const indexes = [{ key: { groupId: 1 }, name: "groupId_1" }];
  const canonical = (d: unknown) => BSON.EJSON.stringify(d, { relaxed: false });

  test("documents come back with their exact types: ids, dates, nulls, nesting, doubles, 64-bit integers", () => {
    const { data } = encodeBackup("familytree", new Date("2026-10-19T21:17:03.456Z"), [
      { name: "persons", indexes, documents: [person] },
      { name: "groups", indexes: [], documents: [] },
    ]);
    const { header, documents } = decodeBackup(data);
    expect(header).toEqual({
      format: "family-tree-backup",
      version: 1,
      database: "familytree",
      createdAt: "2026-10-19T21:17:03.456Z",
      collections: { persons: { count: 1, indexes }, groups: { count: 0, indexes: [] } },
    });
    expect(canonical(documents.persons[0])).toBe(canonical(person));
    expect(documents.persons[0].double).toBeInstanceOf(Double); // not turned into an integer
    expect(documents.groups).toEqual([]);
    expect(countsLine(header)).toBe("persons 1, groups 0");
    expect(backupFileName(header)).toBe("familytree-2026-10-19T21-17-03Z.ftbackup");
  });

  test("damaged, foreign, newer or incomplete contents are refused", () => {
    expect(() => decodeBackup(Buffer.from("not gzip"))).toThrow("The backup's contents are damaged.");
    expect(() => decodeBackup(gzipSync('{"format":"something-else"}\n'))).toThrow("This isn't a Family Tree backup.");
    expect(() => decodeBackup(gzipSync('{"format":"family-tree-backup","version":2,"collections":{}}\n'))).toThrow("This backup is version 2; this app reads version 1.");
    const { data } = encodeBackup("familytree", new Date(), [{ name: "persons", indexes, documents: [person, { ...person, _id: new ObjectId() }] }]);
    const lines = decodeLines(data);
    expect(() => decodeBackup(gzipSync(lines.slice(0, -1).join("\n")))).toThrow("The backup has 1 of 2 records for persons.");
    expect(() => decodeBackup(gzipSync([lines[0], lines[1].replace('"c":"persons"', '"c":"unions"')].join("\n")))).toThrow(
      "The backup has records for unions, which its header doesn't list.",
    );
  });
});

const decodeLines = (data: Buffer) => gunzipSync(data).toString("utf8").split("\n").filter(Boolean);
