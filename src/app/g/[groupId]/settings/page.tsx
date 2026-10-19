import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { NoAccess } from "@/components/NoAccess";
import { getDatabase } from "@/server/db";
import { ROLE_LABELS } from "@/server/members-rules";
import { noAccessToNull, requireRole, requireUser } from "@/server/permissions";
import { listMembers } from "@/server/repositories/members";
import { can } from "@/server/roles";
import { deleteGroupAction, leaveGroupAction, renameGroupAction, transferOwnershipAction } from "./actions";
import { DeleteForm, LeaveForm, RenameForm, TransferForm } from "./SettingsForms";

export const metadata: Metadata = { title: "Group settings · Family Tree" };

/** The Owner renames, transfers or deletes the group; everyone else can leave it. */
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
        <NoAccess groupId={groupId} user={user} />
      </>
    );
  }
  const { group, role } = access;
  const members = await listMembers((await getDatabase()).db, groupId);
  const owner = members.find((m) => m.role === "owner");

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
              <h2 className="text-lg font-semibold">Transfer ownership</h2>
              <TransferForm
                name={group.name}
                members={members.filter((m) => m.role !== "owner").map((m) => ({ userId: m.userId, name: m.name, role: ROLE_LABELS[m.role] }))}
                action={transferOwnershipAction.bind(null, groupId)}
              />
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-red-700">Delete this group</h2>
              <DeleteForm name={group.name} action={deleteGroupAction.bind(null, groupId)} />
            </section>
          </>
        ) : (
          <>
            <p className="text-zinc-600 dark:text-zinc-400">
              You&apos;re {ROLE_LABELS[role] === "Admin" ? "an Admin" : `a ${ROLE_LABELS[role]} member`}. Only the group&apos;s owner
              {owner ? `, ${owner.name},` : ""} can rename, transfer or delete it.
            </p>
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Leave this group</h2>
              <LeaveForm name={group.name} action={leaveGroupAction.bind(null, groupId)} />
            </section>
          </>
        )}
      </main>
    </>
  );
}
