import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { GroupHeader } from "@/components/GroupHeader";
import { NoAccess } from "@/components/NoAccess";
import { TreeLoading } from "@/components/ui/Skeleton";
import { chatConfig } from "@/server/ai/config";
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
    <Suspense fallback={<TreeLoading />}>
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
  // h-dvh: on phones, the height between the browser's bars (100vh reaches under them). The header
  // and the tree load side by side.
  return (
    <div className="flex h-dvh flex-col">
      <GroupHeader user={user} groupId={groupId} groupName={access.group.name} role={access.role} active="tree" />
      <SheetsOfGroup groupId={groupId} canEdit={can(access.role, "edit")} />
    </div>
  );
}

/** The group's sheets, for a user the layout has let in. */
async function SheetsOfGroup({ groupId, canEdit }: { groupId: string; canEdit: boolean }) {
  const { db } = await getDatabase();
  const tree = await loadGroupTree(db, groupId);
  return tree.sheets.length ? (
    <GroupSheets groupId={groupId} tree={tree} canEdit={canEdit} cloudName={cloudinaryConfig()?.cloudName} chat={!!chatConfig()} />
  ) : (
    <main className="p-6 text-zinc-600 dark:text-zinc-400">This group has no sheets yet.</main>
  );
}
