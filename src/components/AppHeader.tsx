import Image from "next/image";
import Link from "next/link";
import { UserMenu, type HeaderLink } from "./auth/UserMenu";
import { GroupSwitcher, type GroupChoice } from "./GroupSwitcher";
import { ThemeMenu } from "./ThemeMenu";
import { LineIcon } from "./ui/icons";

export type { HeaderLink };

/** A group's part of the header: its name (a switcher to the user's other groups) and its pages. */
export interface GroupNav {
  id: string;
  name: string;
  groups: GroupChoice[];
  /** The page showing, underlined. */
  active: "tree" | "members" | "settings" | null;
  /** Null when the user can't manage members (no Members page); `waiting`: access requests. */
  members: { waiting: number } | null;
}

/** The group's pages: Tree, Members (Admins and the Owner), Settings (everyone: Leave for members). */
export function groupLinks(nav: GroupNav): (HeaderLink & { key: GroupNav["active"] })[] {
  const waiting = nav.members?.waiting ?? 0;
  return [
    { key: "tree", href: `/g/${nav.id}`, label: "Tree", icon: "tree" },
    ...(nav.members
      ? [
          {
            key: "members" as const,
            href: `/g/${nav.id}/members`,
            label: "Members",
            icon: "people" as const,
            ariaLabel: waiting ? `Members, ${waiting} access ${waiting === 1 ? "request" : "requests"}` : undefined,
            badge: waiting,
          },
        ]
      : []),
    { key: "settings", href: `/g/${nav.id}/settings`, label: "Settings", icon: "settings" },
  ];
}

/**
 * The bar on signed-in pages (the production look, an owner request): the app's icon and name (to
 * the dashboard); on a group's pages, the group's switcher and its pages as tabs; the theme; the
 * account. On phones the tabs and the theme move into the account menu, so the group's name has room;
 * on group pages the app's name shows from 1024 px.
 */
export function AppHeader({ user, nav }: { user: { name: string; email: string }; nav?: GroupNav }) {
  const links = nav ? groupLinks(nav) : [];
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-zinc-200 bg-white px-2 sm:px-3 md:gap-2 md:px-4 dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        href="/dashboard"
        className="flex shrink-0 items-center gap-2.5 rounded-lg p-1 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 pointer-coarse:min-h-11"
      >
        <Image src="/icon.svg" alt="" width={28} height={28} className="size-7 rounded-[22%] dark:ring-1 dark:ring-white/15" />
        <span className={`text-[15px] font-semibold tracking-tight ${nav ? "sr-only lg:not-sr-only" : ""}`}>Family Tree</span>
      </Link>
      {nav && (
        <>
          <span aria-hidden className="hidden text-xl font-light text-zinc-300 md:block dark:text-zinc-700">
            /
          </span>
          <GroupSwitcher current={{ id: nav.id, name: nav.name }} groups={nav.groups} />
          <nav aria-label="This family tree" className="ml-1 hidden h-full items-stretch md:flex lg:ml-3">
            {links.map((link) => {
              const active = link.key === nav.active;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-label={link.ariaLabel}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-2 px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-inset ${
                    active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  <LineIcon name={link.icon} className="size-4 shrink-0" />
                  {link.label}
                  {!!link.badge && (
                    <span aria-hidden className="rounded-full bg-amber-100 px-1.5 text-xs leading-5 font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                      {link.badge}
                    </span>
                  )}
                  {active && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-linear-to-r from-blue-500 to-pink-500" />}
                </Link>
              );
            })}
          </nav>
        </>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <div className="hidden md:block">
          <ThemeMenu />
        </div>
        <UserMenu user={{ name: user.name, email: user.email }} links={links.map(({ href, label, icon, ariaLabel, badge }) => ({ href, label, icon, ariaLabel, badge }))} />
      </div>
    </header>
  );
}
