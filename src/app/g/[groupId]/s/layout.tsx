import { Suspense } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { NoAccess } from "@/components/NoAccess";
import { cloudinaryConfig } from "@/server/cloudinary";
import { getDatabase } from "@/server/db";
import { noAccessToNull, requireRole, requireUser } from "@/server/permissions";
import { pendingRequestCounts } from "@/server/repositories/access-requests";
import { loadGroupTree } from "@/server/repositories/family";
import { can } from "@/server/roles";
import { GroupSheets } from "./GroupSheets";

/**
 * F5: a group's sheets. This is a layout, not the [sheetId] page, so it stays mounted while tabs
 * change the URL: otherwise the first save after switching tabs would remount the editor (closing
 * the open panel). It loads the data and checks the role itself; the page below draws nothing.
 */
export default function SheetsLayout({ params, children }: LayoutProps<"/g/[groupId]/s">) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Loading the tree…</p>}>
      <GroupSheetsLoader params={params} />
      {children}
    </Suspense>
  );
}

async function GroupSheetsLoader({ params }: Pick<LayoutProps<"/g/[groupId]/s">, "params">) {
  const { groupId } = await params;
  const user = await requireUser();
  const access = await requireRole(groupId, "view").catch(noAccessToNull);
  if (!access) {
    return (
      <>
        <AppHeader user={user} />
        <NoAccess groupId={groupId} user={user} />
      </>
    );
  }
  const { db } = await getDatabase();
  const manages = can(access.role, "manageMembers");
  const [tree, waiting] = await Promise.all([
    loadGroupTree(db, groupId),
    manages ? pendingRequestCounts(db, [groupId]).then((counts) => counts.get(groupId) ?? 0) : 0,
  ]);

  return (
    <div className="flex h-screen flex-col">
      <AppHeader user={user}>
        <span className="truncate font-medium">{access.group.name}</span>
        {manages && (
          <Link
            href={`/g/${groupId}/members`}
            aria-label={waiting ? `Members, ${waiting} access ${waiting === 1 ? "request" : "requests"}` : "Members"}
            className="shrink-0 text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            Members
            {waiting > 0 && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 no-underline dark:bg-amber-900/60 dark:text-amber-100">{waiting}</span>}
          </Link>
        )}
        {/* Everyone: the Owner's settings, or Leave this group. */}
        <Link href={`/g/${groupId}/settings`} className="shrink-0 text-sm text-zinc-600 underline dark:text-zinc-400">
          Settings
        </Link>
      </AppHeader>
      {tree.sheets.length ? (
        <GroupSheets groupId={groupId} tree={tree} canEdit={can(access.role, "edit")} cloudName={cloudinaryConfig()?.cloudName} />
      ) : (
        <main className="p-6 text-zinc-600 dark:text-zinc-400">This group has no sheets yet.</main>
      )}
    </div>
  );
}
