"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useHydrated } from "../use-hydrated";
import { authClient } from "./auth-client";
import { safeReturnTo } from "./return-to";

/**
 * Starts Google sign-in. `returnTo` (set by src/proxy.ts) is read when clicked, so the landing page
 * stays static. Failures come back to this page with `?error=`, keeping `returnTo` for another try.
 * `label` is one of the wordings Google's guidelines allow ("Continue with Google" at the landing
 * page's end, so its two buttons have different names).
 */
export function SignInButton({ label = "Sign in with Google" }: { label?: string }) {
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

  // Google's "Sign in with Google" button (its branding guidelines): the standard G, 40 px pill, 14 px
  // medium text; white with a grey outline by day, Google's dark theme at night.
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={signIn}
        disabled={!hydrated || pending}
        className="flex h-10 items-center gap-2.5 rounded-full border border-[#747775] bg-white px-3 pr-4 text-sm font-medium tracking-[0.25px] text-[#1f1f1f] transition-shadow hover:shadow-md disabled:opacity-60 dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3]"
      >
        <GoogleLogo />
        {pending ? "Opening Google…" : label}
      </button>
      {failed && <p role="alert" className="text-sm text-red-700 dark:text-red-400">Couldn&apos;t reach the sign-in service. Please try again.</p>}
    </div>
  );
}

/** Google's "G", in its own colours, as Google's button template draws it. */
function GoogleLogo() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 48 48" className="shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
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
