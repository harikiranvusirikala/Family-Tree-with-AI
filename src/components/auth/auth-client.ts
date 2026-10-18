import { createAuthClient } from "better-auth/react";

// No baseURL: in the browser it uses the page's own origin, which on previews changes per branch.
export const authClient = createAuthClient();
