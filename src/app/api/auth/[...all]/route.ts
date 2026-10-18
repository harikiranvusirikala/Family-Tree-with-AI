import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

// Better Auth's endpoints: sign-in, the Google callback, get-session, sign-out.
export const { GET, POST } = toNextJsHandler(auth);
