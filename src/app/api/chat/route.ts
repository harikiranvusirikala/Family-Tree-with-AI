import type Anthropic from "@anthropic-ai/sdk";
import { chatErrorMessage, runChatTurn, type ChatEvent } from "@/server/ai/chat";
import { chatClient, chatConfig } from "@/server/ai/config";
import { proposalNote, rosterNote } from "@/server/ai/prompt";
import { parseChatRequest } from "@/server/ai/request";
import { toolsFor } from "@/server/ai/tools";
import { getDatabase } from "@/server/db";
import { toObjectId } from "@/server/ids";
import { getUser } from "@/server/permissions";
import { countChatMessage } from "@/server/repositories/chat-usage";
import { loadGroupState, toGroupTree } from "@/server/repositories/family";
import { roleInGroup } from "@/server/repositories/groups";
import { NoAccessError } from "@/server/roles";

const answer = (status: number, error: string) => Response.json({ error }, { status });

/**
 * F7: one chat turn, streamed as newline-delimited JSON events (ChatEvent). View and up; Viewers get
 * the read tools only. The model's proposals are returned, never saved: Confirm in the browser sends
 * them to applyChangesAction like any edit.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return answer(401, "Sign in first.");
  const config = chatConfig();
  if (!config) return answer(503, "The assistant isn't set up on this site.");
  const parsed = parseChatRequest(await request.text());
  if (typeof parsed === "string") return answer(400, parsed);

  const { db } = await getDatabase();
  let role;
  try {
    ({ role } = await roleInGroup(db, parsed.groupId, user.id, "view"));
  } catch (error) {
    if (error instanceof NoAccessError) return answer(404, "You don't have access to this family tree."); // the same for every case (§8)
    throw error;
  }
  if (!(await countChatMessage(db, user.id, config.dailyLimit))) {
    return answer(429, `You've reached today's limit of ${config.dailyLimit} messages. Try again tomorrow.`);
  }

  const state = await loadGroupState(db, parsed.groupId);
  const tree = toGroupTree(state);
  const notes = [parsed.history.length === 1 && rosterNote(tree, role), parsed.note && proposalNote(parsed.note)].filter((n): n is string => !!n);
  // One operator message after the person's question, as the API requires; earlier messages never change.
  const noteMessages: Anthropic.MessageParam[] = notes.length ? [{ role: "system", content: notes.join("\n\n") }] : [];

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: ChatEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runChatTurn({
          client: chatClient(config),
          model: config.model,
          tools: toolsFor(role),
          history: parsed.history,
          notes: noteMessages,
          context: { groupId: toObjectId(parsed.groupId), state, tree, pending: parsed.pending }, // valid: roleInGroup passed
          emit,
        });
      } catch (error) {
        console.error("Chat turn failed:", error);
        emit({ type: "error", message: chatErrorMessage(error) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
