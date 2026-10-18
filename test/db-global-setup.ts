import { openDatabase } from "@/server/db";
import { dropStaleTestDatabases } from "./db";

/** Before the database tests: clear test databases left behind by crashed runs. */
export default async function setup() {
  const { client } = await openDatabase("admin");
  try {
    await dropStaleTestDatabases(client);
  } finally {
    await client.close();
  }
}
