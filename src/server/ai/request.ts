// What the chat panel sends to POST /api/chat, checked before anything reaches the model. The
// conversation lives in the browser (decided in step 9), so it comes back each time: its shape and
// size are limited here, and the API itself rejects altered thinking blocks.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { operationSchema, type Operation } from "../operations/schema";
import type { ProposalNote } from "./prompt";

/** Messages kept per conversation; then the panel asks for a new chat. */
export const MAX_MESSAGES = 60;
export const MAX_QUESTION = 2000;
/** The whole request, in characters of JSON. */
export const MAX_REQUEST = 400_000;

const block = z.looseObject({ type: z.enum(["text", "thinking", "redacted_thinking", "tool_use", "tool_result"]) });
const message = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.union([z.string().max(100_000), z.array(block).min(1).max(64)]),
});

const requestSchema = z.object({
  groupId: z.string().max(64),
  messages: z.array(message).min(1).max(MAX_MESSAGES),
  pending: z.array(operationSchema).max(200),
  note: z.union([z.object({ confirmed: z.record(z.string().max(64), z.string().max(64)) }), z.object({ discarded: z.literal(true) })]).optional(),
});

export interface ChatRequest {
  groupId: string;
  history: Anthropic.MessageParam[];
  pending: Operation[];
  note?: ProposalNote;
}

/** The request, or the reason it can't be used (shown to the person). */
export function parseChatRequest(text: string): ChatRequest | string {
  if (text.length > MAX_REQUEST) return "This conversation is too long. Start a new chat.";
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return "The request couldn't be read.";
  }
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    const tooMany = parsed.error.issues.some((i) => i.path[0] === "messages" && i.code === "too_big");
    return tooMany ? "This conversation is too long. Start a new chat." : "The request couldn't be read.";
  }
  const { groupId, messages, pending, note } = parsed.data;
  const last = messages.at(-1)!;
  if (last.role !== "user" || typeof last.content !== "string" || !last.content.trim()) return "Type a message first.";
  if (last.content.length > MAX_QUESTION) return `Keep a message under ${MAX_QUESTION} characters.`;
  return { groupId, history: messages as Anthropic.MessageParam[], pending, ...(note && { note: note as ProposalNote }) };
}
