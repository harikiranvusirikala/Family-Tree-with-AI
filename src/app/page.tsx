import { Suspense } from "react";
import { SignInButton, SignInError } from "@/components/auth/SignInButton";
import { GoogleTagManager } from "@/components/GoogleTagManager";
import { SUPPORT_URL } from "@/components/support";
import { ThemeToggle } from "@/components/ThemeToggle";
import { gtmId, type TagManagerEnv } from "@/server/tag-manager";

export default function Home() {
  return (
    <>
      {/* First, as Google asks, and on this page only (an owner request); nothing without GTM_ID. */}
      <GoogleTagManager id={gtmId(process.env as TagManagerEnv)} />
      <main className="relative flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <div className="absolute right-4 top-3">
          <ThemeToggle />
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">Family Tree</h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Build your family tree together and share it privately with your relatives.
        </p>
        <Suspense>
          <SignInError />
        </Suspense>
        <SignInButton />
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Buy me a coffee (opens in a new tab)"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 underline hover:text-zinc-700 pointer-coarse:min-h-11 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Buy me a coffee<span aria-hidden>☕</span>
        </a>
      </main>
    </>
  );
}
