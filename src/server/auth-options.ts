import type { BetterAuthOptions } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { oAuthProxy } from "better-auth/plugins/oauth-proxy";
import { authUrls, type AuthUrlEnv } from "./auth-urls";
import type { Database } from "./db";

export interface AuthEnv extends AuthUrlEnv {
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Shared by production and previews (never BETTER_AUTH_SECRET, which differs between them). */
  OAUTH_PROXY_SECRET?: string;
}

const DAY = 24 * 60 * 60;

/**
 * Better Auth's settings (F1). Shared by the app (`auth.ts`) and the e2e sign-in fixture, which must
 * produce identical session cookies, so this module has no `import "server-only"`.
 */
export function authOptions(database: Database, env: AuthEnv) {
  const { baseURL, trustedOrigins, productionURL } = authUrls(env);
  if (productionURL && !env.OAUTH_PROXY_SECRET) {
    console.error("OAUTH_PROXY_SECRET is not set: Google sign-in on preview deployments won't work.");
  }
  return {
    appName: "Family Tree",
    baseURL,
    trustedOrigins,
    secret: env.BETTER_AUTH_SECRET,
    // Collections users, sessions, accounts and verifications (§5). Given the client, Better Auth's
    // own multi-document writes use transactions.
    database: mongodbAdapter(database.db, { client: database.client, usePlural: true }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
        prompt: "select_account", // a shared family computer can switch accounts
      },
    },
    user: {
      // Invites are matched by email (step 8), so only addresses Google has verified are accepted.
      validateUserInfo: ({ user, source }) =>
        source.method === "oauth" && user.emailVerified !== true
          ? { error: "email_not_verified", errorDescription: "Google hasn't verified this account's email address." }
          : undefined,
    },
    // 30 days, extended while in use. Only /api/auth/get-session extends it (see permissions.ts).
    session: { expiresIn: 30 * DAY },
    // Failures that happen before the sign-in's own errorCallbackURL is known (e.g. an expired sign-in).
    onAPIError: { errorURL: "/" },
    plugins:
      productionURL && env.OAUTH_PROXY_SECRET
        ? [oAuthProxy({ productionURL, secret: env.OAUTH_PROXY_SECRET })] // §15 question 4
        : [],
    telemetry: { enabled: false },
  } satisfies BetterAuthOptions;
}
