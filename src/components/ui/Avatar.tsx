import { initials } from "../initials";

/**
 * An account's initials in a neutral ring (the production look): the account menu, members, requests.
 * People in the tree have PersonPhoto instead, with its blue and pink rings.
 */
export function Avatar({ name, className = "size-8 text-[13px]" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-700 ring-1 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 ${className}`}
    >
      {initials(name)}
    </span>
  );
}
