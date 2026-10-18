import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

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
