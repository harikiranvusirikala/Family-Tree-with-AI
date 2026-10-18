import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Call from a server action after it changes a group (created, renamed, deleted; later its members).
 * The browser keeps pages it has shown, for Back/Forward among others, and would show them as they
 * were. Without this, the dashboard didn't list a group just created.
 */
export function groupChanged(groupId?: string): void {
  revalidatePath("/dashboard");
  if (groupId) revalidatePath(`/g/${groupId}`, "layout"); // its sheets and settings
}
