import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";

/** Image imports give `{ src, width, height }`, as in Next.js (next/image needs them), not Vite's address. */
const nextStaticImages: Plugin = {
  name: "next-static-images",
  enforce: "pre",
  load(id) {
    if (/\.(png|jpe?g|webp|avif|gif)$/.test(id)) return `export default { src: ${JSON.stringify(id)}, width: 1600, height: 1000 };`;
  },
};

export default defineConfig({
  plugins: [react(), nextStaticImages],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "**/*.db.test.ts"], // database tests: npm run test:db
  },
});
