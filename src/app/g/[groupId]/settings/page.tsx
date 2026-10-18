import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { NoAccess } from "@/components/NoAccess";
import { noAccessToNull, requireRole, requireUser } from "@/server/permissions";
import { can } from "@/server/roles";
import { deleteGroupAction, renameGroupAction } from "./actions";
import { DeleteForm, RenameForm } from "./SettingsForms";

export const metadata: Metadata = { title: "Group settings · Family Tree" };

/** Rename and delete the group (Owner only). Transferring ownership arrives in step 8. */
export default function SettingsPage({ params }: PageProps<"/g/[groupId]/settings">) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading…</p>}>
      <GroupSettings params={params} />
    </Suspense>
  );
}

async function GroupSettings({ params }: Pick<PageProps<"/g/[groupId]/settings">, "params">) {
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
  const { group, role } = access;

  return (
    <>
      <AppHeader user={user}>
        <Link href={`/g/${groupId}`} className="truncate font-medium underline">
          {group.name}
        </Link>
      </AppHeader>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-10 px-6 py-10">
        <h1 className="text-2xl font-semibold">Group settings</h1>
        {can(role, "renameGroup") ? (
          <>
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Rename</h2>
              <RenameForm name={group.name} action={renameGroupAction.bind(null, groupId)} />
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-red-700">Delete this group</h2>
              <DeleteForm name={group.name} action={deleteGroupAction.bind(null, groupId)} />
            </section>
          </>
        ) : (
          <p className="text-zinc-600 dark:text-zinc-400">Only the group&apos;s owner can change its settings.</p>
        )}
      </main>
    </>
  );
}
