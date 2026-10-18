/** The environment variables that decide where sign-in runs (ARCHITECTURE.md §12). */
export interface AuthUrlEnv {
  BETTER_AUTH_URL?: string;
  /** Set by Vercel: "production", "preview" or "development". Unset locally and in tests. */
  VERCEL_ENV?: string;
  /** Set by Vercel: this deployment's own host, e.g. family-tree-abc123-team.vercel.app. */
  VERCEL_URL?: string;
  /** Set by Vercel on git deployments: the branch's stable host. */
  VERCEL_BRANCH_URL?: string;
  /** Set by Vercel: the production host, e.g. family-tree-with-ai.vercel.app. */
  VERCEL_PROJECT_PRODUCTION_URL?: string;
}

export interface AuthUrls {
  baseURL: string;
  /** Exact origins only. Never a wildcard such as *.vercel.app, which would trust anyone's Vercel app. */
  trustedOrigins: string[];
  /** Set on Vercel (production and previews): turns on the OAuth proxy, which signs previews in through production. */
  productionURL?: string;
}

const https = (host: string | undefined) => (host ? `https://${host}` : undefined);

/**
 * Base URL and trusted origins: BETTER_AUTH_URL locally, in tests and in production; on previews,
 * exactly this deployment's branch and deployment hosts.
 */
export function authUrls(env: AuthUrlEnv): AuthUrls {
  const productionURL = https(env.VERCEL_PROJECT_PRODUCTION_URL);

  if (env.VERCEL_ENV === "preview") {
    const origins = [...new Set([env.VERCEL_BRANCH_URL, env.VERCEL_URL].flatMap((host) => https(host) ?? []))];
    if (origins.length === 0) throw new Error("VERCEL_URL is not set on this preview deployment");
    return { baseURL: origins[0], trustedOrigins: origins, productionURL };
  }

  const isProduction = env.VERCEL_ENV === "production";
  const configured = env.BETTER_AUTH_URL || (isProduction ? productionURL : undefined); // `||`: an empty value counts as unset
  if (!configured) throw new Error("BETTER_AUTH_URL is not set (see .env.example)");
  const baseURL = new URL(configured).origin;
  return { baseURL, trustedOrigins: [baseURL], ...(isProduction && productionURL && { productionURL }) };
}
