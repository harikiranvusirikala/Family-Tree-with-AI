import { getDatabase } from "@/server/db";
import { exportGedcom } from "@/server/import-export/gedcom";
import { exportJson } from "@/server/import-export/json";
import { fileName } from "@/server/import-export/types";
import { getUser } from "@/server/permissions";
import { loadGroupTree } from "@/server/repositories/family";
import { roleInGroup } from "@/server/repositories/groups";
import { MIN_ROLE, NoAccessError } from "@/server/roles";

const answer = (status: number, error: string) => Response.json({ error }, { status });

/**
 * F9: the group, or one sheet (`?sheet=<id>`), as a JSON or GEDCOM download (`?format=json|gedcom`).
 * Maintain and up (§8); everyone else, members or not, gets the same 404.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/groups/[groupId]/export">) {
  const user = await getUser();
  if (!user) return answer(401, "Sign in first.");
  const { groupId } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  if (format !== "json" && format !== "gedcom") return answer(400, "Choose format=json or format=gedcom.");

  const { db } = await getDatabase();
  let group;
  try {
    ({ group } = await roleInGroup(db, groupId, user.id, MIN_ROLE.exportData));
  } catch (error) {
    if (error instanceof NoAccessError) return answer(404, "You don't have access to this family tree.");
    throw error;
  }
  const tree = await loadGroupTree(db, groupId);
  const sheetId = searchParams.get("sheet");
  const sheet = sheetId ? tree.sheets.find((s) => s.id === sheetId) : undefined;
  if (sheetId && !sheet) return answer(404, "That sheet doesn't exist.");

  const name = fileName(group.name, ...(sheet ? [sheet.title] : []));
  const [body, type, extension] =
    format === "json" ? [exportJson(tree, group, sheet), "application/json", "json"] : [exportGedcom(tree, sheet), "text/plain", "ged"];
  return new Response(body, {
    headers: {
      "content-type": `${type}; charset=utf-8`,
      // An ASCII fallback, and the real name for browsers that read RFC 5987.
      "content-disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}.${extension}"; filename*=UTF-8''${encodeURIComponent(`${name}.${extension}`)}`,
      "cache-control": "no-store",
    },
  });
}
