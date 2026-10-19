import { Suspense } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { NoAccess } from "@/components/NoAccess";
import { cloudinaryConfig } from "@/server/cloudinary";
import { getDatabase } from "@/server/db";
import { noAccessToNull, requireRole, requireUser } from "@/server/permissions";
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
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading the tree…</p>}>
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
        <NoAccess />
      </>
    );
  }
  const tree = await loadGroupTree((await getDatabase()).db, groupId);

  return (
    <div className="flex h-screen flex-col">
      <AppHeader user={user}>
        <span className="truncate font-medium">{access.group.name}</span>
        {can(access.role, "renameGroup") && (
          <Link href={`/g/${groupId}/settings`} className="shrink-0 text-sm text-zinc-600 underline dark:text-zinc-400">
            Settings
          </Link>
        )}
      </AppHeader>
      {tree.sheets.length ? (
        <GroupSheets groupId={groupId} tree={tree} canEdit={can(access.role, "edit")} cloudName={cloudinaryConfig()?.cloudName} />
      ) : (
        <main className="p-6 text-zinc-600">This group has no sheets yet.</main>
      )}
    </div>
  );
}
