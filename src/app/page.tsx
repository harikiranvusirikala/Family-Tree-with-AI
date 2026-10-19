import { Suspense } from "react";
import { SignInButton, SignInError } from "@/components/auth/SignInButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
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
    </main>
  );
}
