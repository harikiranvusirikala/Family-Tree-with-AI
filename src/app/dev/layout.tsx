import { notFound } from "next/navigation";

/**
 * Developer-only pages. They exist under `npm run dev`, and in the e2e test build
 * (ENABLE_DEV_PAGES=1, set by playwright.config.ts). On Vercel they are 404.
 */
export default function DevLayout({ children }: LayoutProps<"/dev">) {
  if (process.env.NODE_ENV !== "development" && process.env.ENABLE_DEV_PAGES !== "1") notFound();
  return children;
}
