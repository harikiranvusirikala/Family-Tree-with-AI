import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NoAccess } from "@/components/NoAccess";
import { getDatabase } from "@/server/db";
import { noAccessToNull, requireRole, requireUser } from "@/server/permissions";
import { loadGroupTree } from "@/server/repositories/family";
import { can } from "@/server/roles";
import { GroupSheets } from "./GroupSheets";

/** F5: the whole group is loaded once; switching sheet tabs happens in the browser. */
export default function SheetPage({ params }: PageProps<"/g/[groupId]/s/[sheetId]">) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading the tree…</p>}>
      <GroupSheet params={params} />
    </Suspense>
  );
}

async function GroupSheet({ params }: Pick<PageProps<"/g/[groupId]/s/[sheetId]">, "params">) {
  const { groupId, sheetId } = await params;
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
  if (!tree.sheets.some((s) => s.id === sheetId)) redirect(`/g/${groupId}`); // a mistyped or removed sheet

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
      <GroupSheets groupId={groupId} tree={tree} />
    </div>
  );
}
