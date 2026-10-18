import "server-only";
import { betterAuth } from "better-auth";
import { authOptions, type AuthEnv } from "./auth-options";
import { lazyDatabase } from "./db";

/** Better Auth (F1): Google sign-in, with users and sessions in MongoDB. Routes: app/api/auth/[...all]. */
export const auth = betterAuth(authOptions(lazyDatabase(), process.env as AuthEnv));
