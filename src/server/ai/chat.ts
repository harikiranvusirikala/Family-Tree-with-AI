// One chat turn (F7): stream the model's reply, run the tools it calls, send their results back, and
// repeat until it answers. Everything appended is returned as `turn`, for the browser to keep and send
// back next time unchanged (thinking blocks included: the API checks them).
import Anthropic from "@anthropic-ai/sdk";
import type { Operation } from "../operations/schema";
import { runTool, type ToolContext } from "./handlers";
import { SYSTEM_PROMPT } from "./prompt";

/** Tool rounds per message, so one message can't run up a bill. */
export const MAX_TOOL_ROUNDS = 8;
export const MAX_TOKENS = 4096;

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool"; activity: string }
  | { type: "proposal"; operations: Operation[] }
  | { type: "done"; turn: Anthropic.MessageParam[]; pending: Operation[] }
  | { type: "error"; message: string };

export interface TurnInput {
  client: Pick<Anthropic, "messages">;
  model: string;
  tools: Anthropic.Tool[];
  /** The conversation as the browser sent it, ending with the person's new message. */
  history: Anthropic.MessageParam[];
  /** Messages the server adds before the model replies (the family list, a proposal note). */
  notes: Anthropic.MessageParam[];
  context: ToolContext;
  emit: (event: ChatEvent) => void;
}

export async function runChatTurn({ client, model, tools, history, notes, context, emit }: TurnInput): Promise<void> {
  const turn: Anthropic.MessageParam[] = [...notes];
  let pending = context.pending;

  for (let round = 0; ; round++) {
    const stream = client.messages.stream({
      model,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      cache_control: { type: "ephemeral" }, // the conversation so far, for the next round and turn
      output_config: { effort: "medium" },
      tools,
      messages: [...history, ...turn],
    });
    stream.on("text", (text) => emit({ type: "text", text }));
    const message = await stream.finalMessage();
    turn.push({ role: "assistant", content: message.content });

    if (message.stop_reason === "refusal") {
      emit({ type: "text", text: "I can't help with that." });
      break;
    }
    const calls = message.content.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
    if (calls.length === 0) break;

    // Every tool_use needs its tool_result, or the next request is refused; past the limit the results
    // say so, and the conversation stays valid.
    const results: Anthropic.ToolResultBlockParam[] = calls.map((call) => {
      if (round >= MAX_TOOL_ROUNDS) {
        return { type: "tool_result", tool_use_id: call.id, is_error: true, content: "Stopped: too many steps for one message. Answer with what you have." };
      }
      const outcome = runTool(call.name, call.input, { ...context, pending });
      emit({ type: "tool", activity: outcome.activity });
      if (outcome.pending !== pending) {
        pending = outcome.pending;
        emit({ type: "proposal", operations: pending });
      }
      return { type: "tool_result", tool_use_id: call.id, content: outcome.content, ...(outcome.isError && { is_error: true }) };
    });
    turn.push({ role: "user", content: results });
    if (round >= MAX_TOOL_ROUNDS) {
      emit({ type: "text", text: "\n\nThat took too many steps. Please ask again, perhaps in smaller parts." });
      break;
    }
  }
  emit({ type: "done", turn, pending });
}

/** What the person sees when the API fails; details go to the server log. */
export function chatErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) return "The assistant is busy. Try again in a minute.";
  if (error instanceof Anthropic.BadRequestError) return "The assistant couldn't continue this conversation. Start a new chat.";
  return "The assistant isn't available right now.";
}
