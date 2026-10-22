import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Better Auth's testUtils creates sessions for any user. It belongs only in the e2e fixture,
    // never in the app, so the app has no test-login backdoor.
    files: ["src/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "better-auth/plugins", importNames: ["testUtils"], message: "testUtils is for e2e/ only." }],
          patterns: [{ group: ["better-auth/test"], message: "Test helpers are for e2e/ only." }],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright output:
    "playwright-report/**",
    "test-results/**",
    // Parallel sessions' worktrees: each holds a whole checkout, with its own build output.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
