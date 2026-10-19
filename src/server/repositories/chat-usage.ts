import { MongoServerError, ObjectId, type Db } from "mongodb";
import { toObjectId } from "../ids";
import { collections } from "./documents";

const KEEP_DAYS = 30;

/**
 * Counts one chat message for the daily cap (F7), if the person is still under `limit` today (UTC).
 * Atomic, so messages sent at once can't slip past it: the update only matches a row with room left.
 * The first message of the day creates the row; if another message created it first, the insert
 * hits the unique {userId, day} index, and the message is counted on that row if it has room.
 */
export async function countChatMessage(db: Db, userId: string, limit: number, now = new Date()): Promise<boolean> {
  const { chatUsage } = collections(db);
  const withRoom = { userId: toObjectId(userId), day: now.toISOString().slice(0, 10), count: { $lt: limit } };
  try {
    await chatUsage.updateOne(
      withRoom,
      { $inc: { count: 1 }, $setOnInsert: { _id: new ObjectId(), expiresAt: new Date(now.getTime() + KEEP_DAYS * 86_400_000) } },
      { upsert: true },
    );
    return true;
  } catch (error) {
    if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
    const { modifiedCount } = await chatUsage.updateOne(withRoom, { $inc: { count: 1 } });
    return modifiedCount === 1; // 0: today's row is at the limit
  }
}
