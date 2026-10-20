// The backup file's encryption (F12): AES-256-GCM, which also refuses a damaged or altered file
// instead of restoring it. Layout: "FTB1" | 12-byte IV | ciphertext | 16-byte tag. Backups are small
// (the whole cluster holds at most 512 MB), so files are handled in memory.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("FTB1");
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** A problem with a backup or its key, with a message for the person running the script. */
export class BackupError extends Error {}

/** The key from BACKUP_ENCRYPTION_KEY: 32 random bytes in base64, as `openssl rand -base64 32` prints them. */
export function backupKey(text: string | undefined): Buffer {
  const trimmed = text?.trim() ?? "";
  if (!/^[A-Za-z0-9+/]{43}=$/.test(trimmed)) {
    throw new BackupError("BACKUP_ENCRYPTION_KEY must be 32 random bytes in base64, as `openssl rand -base64 32` prints them.");
  }
  return Buffer.from(trimmed, "base64");
}

export function encrypt(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(MAGIC);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, body, cipher.getAuthTag()]);
}

export function decrypt(file: Buffer, key: Buffer): Buffer {
  if (!file.subarray(0, MAGIC.length).equals(MAGIC)) throw new BackupError("This isn't a Family Tree backup file.");
  if (file.length < MAGIC.length + IV_BYTES + TAG_BYTES) throw new BackupError("The backup file is cut short.");
  const iv = file.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(file.subarray(file.length - TAG_BYTES));
  try {
    return Buffer.concat([decipher.update(file.subarray(MAGIC.length + IV_BYTES, file.length - TAG_BYTES)), decipher.final()]);
  } catch {
    throw new BackupError("Wrong key, or the backup file is damaged or cut short.");
  }
}
