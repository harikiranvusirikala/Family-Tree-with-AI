import { getDatabase } from "@/server/db";
import { pendingRequestCounts } from "@/server/repositories/access-requests";
import { listGroupsForUser } from "@/server/repositories/groups";
import { can, type Role } from "@/server/roles";
import { AppHeader, type GroupNav } from "./AppHeader";

/**
 * The header on a group's pages, for a user the page has already let in (requireRole): their family
 * trees for the switcher and, for Admins and the Owner, the waiting access requests.
 */
export async function GroupHeader(props: {
  user: { id: string; name: string; email: string; image?: string | null };
  groupId: string;
  groupName: string;
  role: Role;
  active: GroupNav["active"];
}) {
  const { user, groupId, groupName, role, active } = props;
  const { db } = await getDatabase();
  const manages = can(role, "manageMembers");
  const [groups, waiting] = await Promise.all([
    listGroupsForUser(db, user.id),
    manages ? pendingRequestCounts(db, [groupId]).then((counts) => counts.get(groupId) ?? 0) : 0,
  ]);
  return (
    <AppHeader
      user={user}
      nav={{ id: groupId, name: groupName, groups: groups.map(({ id, name }) => ({ id, name })), active, members: manages ? { waiting } : null }}
    />
  );
}
