import { Suspense } from "react";
import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { GroupHeader } from "@/components/GroupHeader";
import { NoAccess } from "@/components/NoAccess";
import { card, cardText, cardTitle, dangerCard } from "@/components/ui/card";
import { pageFrame } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingPage, skeleton } from "@/components/ui/Skeleton";
import { getDatabase } from "@/server/db";
import { ROLE_LABELS } from "@/server/members-rules";
import { noAccessToNull, requireRole, requireUser } from "@/server/permissions";
import { listMembers } from "@/server/repositories/members";
import { can } from "@/server/roles";
import { deleteGroupAction, leaveGroupAction, renameGroupAction, transferOwnershipAction } from "./actions";
import { DeleteGroup, LeaveGroup, RenameForm, TransferOwnership } from "./SettingsForms";
import { SettingsNav, type SettingsSection } from "./SettingsNav";

export const metadata: Metadata = { title: "Group settings · Family Tree" };

const SECTIONS: SettingsSection[] = [
  { id: "general", label: "General", icon: "settings" },
  { id: "ownership", label: "Ownership", icon: "shield" },
  { id: "danger-zone", label: "Danger zone", icon: "alert", danger: true },
];

/** A section's card; the side menu scrolls to it and moves the focus there. */
const section = "scroll-mt-6 p-5 outline-none sm:p-6";

/** The Owner renames, transfers or deletes the group, in cards beside a side menu; everyone else can leave it. */
export default function SettingsPage({ params }: PageProps<"/g/[groupId]/settings">) {
  return (
    <Suspense fallback={<SettingsLoading />}>
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
    <div className={pageFrame}>
      <GroupHeader user={user} groupId={groupId} groupName={group.name} role={role} active="settings" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        {can(role, "renameGroup") ? (
          <>
            <PageHeader title="Group settings" description={`${group.name}'s name and owner, and deleting the group.`} />
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
              <SettingsNav sections={SECTIONS} />
              <div className="flex min-w-0 flex-1 flex-col gap-6">
                <section id="general" tabIndex={-1} className={`${card} ${section}`}>
                  <h2 className={cardTitle}>Group name</h2>
                  <p className={`${cardText} mt-1 mb-4`}>Everyone in the group sees it, on the dashboard and above the tree.</p>
                  <RenameForm name={group.name} action={renameGroupAction.bind(null, groupId)} />
                </section>
                <section id="ownership" tabIndex={-1} className={`${card} ${section}`}>
                  <h2 className={cardTitle}>Transfer ownership</h2>
                  <p className={`${cardText} mt-1 mb-4`}>The new owner gets every right you have now, and you become an Admin.</p>
                  <TransferOwnership
                    groupId={groupId}
                    name={group.name}
                    members={members.filter((m) => m.role !== "owner").map((m) => ({ userId: m.userId, name: m.name, role: ROLE_LABELS[m.role] }))}
                    action={transferOwnershipAction.bind(null, groupId)}
                  />
                </section>
                <section id="danger-zone" tabIndex={-1} className={`${dangerCard} ${section} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
                  <div>
                    <h2 className="text-base font-semibold text-red-700 dark:text-red-400">Delete this group</h2>
                    <p className={`${cardText} mt-1`}>The group disappears for everyone in it. You&apos;ll be asked to type its name to confirm.</p>
                  </div>
                  <DeleteGroup name={group.name} members={members.length} action={deleteGroupAction.bind(null, groupId)} />
                </section>
              </div>
            </div>
          </>
        ) : (
          <>
            <PageHeader
              title="Group settings"
              description={`You're ${role === "admin" ? "an Admin" : `a ${ROLE_LABELS[role]} member`}. Only the group's owner${owner ? `, ${owner.name},` : ""} can rename, transfer or delete it.`}
            />
            <section className={`${dangerCard} ${section} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
              <div>
                <h2 className="text-base font-semibold text-red-700 dark:text-red-400">Leave this group</h2>
                <p className={`${cardText} mt-1`}>You&apos;ll stop seeing {group.name}. To come back, you&apos;ll need a new invite.</p>
              </div>
              <LeaveGroup name={group.name} action={leaveGroupAction.bind(null, groupId)} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

/** The page's shape while it loads: the heading, the side menu and three cards. */
function SettingsLoading() {
  return (
    <LoadingPage className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-2">
        <div className={`${skeleton} h-8 w-56 rounded-md`} />
        <div className={`${skeleton} h-4 w-80 max-w-full rounded-md`} />
      </div>
      <div className="flex gap-10">
        <div className={`${skeleton} hidden h-32 w-52 shrink-0 rounded-lg lg:block`} />
        <div className="flex flex-1 flex-col gap-6">
          <div className={`${skeleton} h-36 rounded-2xl`} />
          <div className={`${skeleton} h-36 rounded-2xl`} />
        </div>
      </div>
    </LoadingPage>
  );
}
