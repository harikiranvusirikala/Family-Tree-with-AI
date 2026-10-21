import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";
import { getDatabase } from "@/server/db";

// Better Auth's endpoints: sign-in, the Google callback, get-session, sign-out. Each request connects
// first: after a failed connection, Better Auth's queries would fail with "Topology is closed" (db.ts).
const handler = toNextJsHandler(auth);

export async function GET(request: Request) {
  await getDatabase();
  return handler.GET(request);
}

export async function POST(request: Request) {
  await getDatabase();
  return handler.POST(request);
}
