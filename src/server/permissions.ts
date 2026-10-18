import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { getDatabase } from "./db";
import { roleInGroup } from "./repositories/groups";
import { NoAccessError, type Role } from "./roles";

export { NoAccessError, type Role } from "./roles";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

/**
 * The signed-in user, or null. Read from the database on every request (no `use cache: private`),
 * like the role in step 5. Server Components can't write cookies, so this never extends the session;
 * the user menu's useSession() does that through /api/auth/get-session.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  if (!session) return null;
  const { id, name, email } = session.user;
  return { id, name, email };
});

/**
 * The signed-in user, or a redirect to the landing page. For pages and server actions; route handlers
 * use getUser() and answer 401. Signed-out visitors normally never get here: src/proxy.ts sends them
 * to sign in first, keeping the link they opened.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/");
  return user;
}

/**
 * The check at the start of every server action, route handler and data load for a group (§8):
 * signed in (else a redirect to sign in) and a member with at least `min`. Otherwise NoAccessError,
 * the same whether or not the group exists.
 */
export async function requireRole(groupId: string, min: Role) {
  const user = await requireUser();
  const { role, group } = await roleInGroup((await getDatabase()).db, groupId, user.id, min);
  return { user, role, group };
}

/** For `.catch()` after requireRole: turns "no access" into null, and lets anything else (redirects too) through. */
export function noAccessToNull(error: unknown): null {
  if (error instanceof NoAccessError) return null;
  throw error;
}
