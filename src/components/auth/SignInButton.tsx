"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useHydrated } from "../use-hydrated";
import { authClient } from "./auth-client";
import { safeReturnTo } from "./return-to";

/**
 * Starts Google sign-in. `returnTo` (set by src/proxy.ts) is read when clicked, so the landing page
 * stays static. Failures come back to this page with `?error=`, keeping `returnTo` for another try.
 */
export function SignInButton() {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setPending(true);
    setFailed(false);
    const returnTo = safeReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: returnTo,
      errorCallbackURL: `/?${new URLSearchParams({ returnTo })}`,
    });
    if (error) {
      setPending(false);
      setFailed(true);
    }
    // On success the browser is already on its way to Google.
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={signIn}
        disabled={!hydrated || pending}
        className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-base font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {pending ? "Opening Google…" : "Sign in with Google"}
      </button>
      {failed && <p role="alert" className="text-sm text-red-700 dark:text-red-400">Couldn&apos;t reach the sign-in service. Please try again.</p>}
    </div>
  );
}

const MESSAGES: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  email_not_verified: "Google hasn't verified your account's email address, so it can't be used here.",
};

/** A plain message after a failed sign-in (`?error=` from Better Auth). Render inside <Suspense>. */
export function SignInError() {
  const error = useSearchParams()?.get("error");
  if (!error) return null;
  return (
    <p role="alert" className="max-w-md text-sm text-red-700 dark:text-red-400">
      {MESSAGES[error] ?? "Sign-in didn't finish, perhaps because it took too long. Please try again."}
    </p>
  );
}
