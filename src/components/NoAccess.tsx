import Link from "next/link";

/**
 * Shown for a group the user can't open. It says nothing about the group, and looks the same whether
 * or not the group exists (§8). Step 8 adds "Request access" here.
 */
export function NoAccess() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center" data-testid="no-access">
      <h1 className="text-2xl font-semibold">You don&apos;t have access to this family tree</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        The link may be wrong, or nobody has shared this tree with you yet.
      </p>
      <Link href="/dashboard" className="text-sm font-medium underline">
        Go to your dashboard
      </Link>
    </main>
  );
}
