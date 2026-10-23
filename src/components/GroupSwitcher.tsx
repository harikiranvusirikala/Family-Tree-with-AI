"use client";

import Link from "next/link";
import { LineIcon } from "./ui/icons";
import { Menu, MenuLabel, MenuSeparator, menuItem } from "./ui/Menu";

export interface GroupChoice {
  id: string;
  name: string;
}

/**
 * The group's name in the header, opening the user's other family trees (the production look, an
 * owner request): change trees without going back to the dashboard. Its name is the group's.
 */
export function GroupSwitcher({ current, groups }: { current: GroupChoice; groups: GroupChoice[] }) {
  return (
    <Menu
      label="Your family trees"
      align="start"
      menuClassName="w-64"
      buttonClassName="flex max-w-[12rem] min-w-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-zinc-900 outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-500/70 aria-expanded:bg-zinc-100 pointer-coarse:min-h-11 sm:max-w-[16rem] dark:text-zinc-100 dark:hover:bg-zinc-800 dark:aria-expanded:bg-zinc-800"
      button={
        <>
          <span className="truncate">{current.name}</span>
          <LineIcon name="chevronsUpDown" className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
        </>
      }
    >
      {(close) => (
        <>
          <MenuLabel>Your family trees</MenuLabel>
          {groups.map((group) => (
            <Link key={group.id} href={`/g/${group.id}`} role="menuitemradio" aria-checked={group.id === current.id} onClick={close} className={menuItem}>
              <span className="flex-1 truncate">{group.name}</span>
              {group.id === current.id && <LineIcon name="check" className="size-4 shrink-0" />}
            </Link>
          ))}
          <MenuSeparator />
          <Link href="/dashboard" role="menuitem" onClick={close} className={menuItem}>
            <LineIcon name="grid" className="size-4 shrink-0" />
            All family trees
          </Link>
        </>
      )}
    </Menu>
  );
}
