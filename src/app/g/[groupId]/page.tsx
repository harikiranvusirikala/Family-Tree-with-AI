import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { NoAccess } from "@/components/NoAccess";
import { getDatabase } from "@/server/db";
import { noAccessToNull, requireRole, requireUser } from "@/server/permissions";
import { firstSheetId } from "@/server/repositories/groups";

/** A group link opens its first pinned sheet. */
export default function GroupPage({ params }: PageProps<"/g/[groupId]">) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Opening the tree…</p>}>
      <OpenGroup params={params} />
    </Suspense>
  );
}

async function OpenGroup({ params }: Pick<PageProps<"/g/[groupId]">, "params">) {
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
  const sheetId = await firstSheetId((await getDatabase()).db, groupId);
  if (sheetId) redirect(`/g/${groupId}/s/${sheetId}`); // streamed: the page has already started
  return (
    <>
      <AppHeader user={user}>
        <span className="truncate font-medium">{access.group.name}</span>
      </AppHeader>
      <main className="p-6 text-zinc-600">This group has no sheets yet.</main>
    </>
  );
}
