// @vitest-environment node
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, test } from "vitest";
import { sampleState, toGroupTree } from "@test/planning";
import { MAX_TOOL_ROUNDS, runChatTurn, type ChatEvent } from "./chat";
import { chatConfig } from "./config";
import type { ToolContext } from "./handlers";
import { MAX_MESSAGES, parseChatRequest } from "./request";
import { toolsFor } from "./tools";

const state = sampleState();
const tree = toGroupTree(state);
const context: ToolContext = { groupId: state.persons[0].groupId, state, tree, pending: [] };
const jake = tree.persons.find((p) => p.name === "Jake Cruz")!.id;

type Block = Anthropic.ContentBlock;
const thinking = (n: number): Block => ({ type: "thinking", thinking: "", signature: `sig-${n}` }) as Block;
const text = (t: string): Block => ({ type: "text", text: t, citations: null }) as Block;
const call = (id: string, name: string, input: unknown): Block => ({ type: "tool_use", id, name, input, caller: { type: "direct" } }) as unknown as Block;

/** A stand-in for the SDK client: plays back one reply per request, and remembers each request. */
function fakeClient(replies: { content: Block[]; stop_reason: Anthropic.StopReason }[]) {
  const requests: Anthropic.MessageCreateParams[] = [];
  const client = {
    messages: {
      stream(params: Anthropic.MessageCreateParams) {
        requests.push(structuredClone(params));
        const reply = replies.shift() ?? { content: [text("(no more replies)")], stop_reason: "end_turn" as const };
        return {
          on(event: string, listener: (t: string) => void) {
            if (event === "text") for (const block of reply.content) if (block.type === "text") listener(block.text);
            return this;
          },
          finalMessage: async () => ({ content: reply.content, stop_reason: reply.stop_reason }) as Anthropic.Message,
        };
      },
    },
  };
  return { client: client as unknown as Pick<Anthropic, "messages">, requests };
}

async function turn(replies: Parameters<typeof fakeClient>[0], history: Anthropic.MessageParam[] = [{ role: "user", content: "hi" }]) {
  const { client, requests } = fakeClient(replies);
  const events: ChatEvent[] = [];
  await runChatTurn({ client, model: "claude-haiku-5-5", tools: toolsFor("maintain"), history, notes: [{ role: "system", content: "family list" }], context, emit: (e) => events.push(e) });
  return { events, requests, done: events.at(-1) as Extract<ChatEvent, { type: "done" }> };
}

describe("a chat turn", () => {
  test("tools run, their results go back, and the turn keeps every block, thinking included", async () => {
    const { events, requests, done } = await turn([
      { content: [thinking(1), call("t1", "get_person", { personId: jake })], stop_reason: "tool_use" },
      { content: [thinking(2), text("Jake has three children.")], stop_reason: "end_turn" },
    ]);
    expect(events.filter((e) => e.type !== "done")).toEqual([
      { type: "tool", activity: "Reading a person's details" },
      { type: "text", text: "Jake has three children." },
    ]);
    expect(done.turn.map((m) => m.role)).toEqual(["system", "assistant", "user", "assistant"]);
    expect((done.turn[1].content as Block[])[0]).toEqual(thinking(1)); // unchanged
    // The second request carries the first reply and the tool result after the browser's history.
    expect(requests[1].messages.map((m) => m.role)).toEqual(["user", "system", "assistant", "user"]);
    expect(requests[0]).toMatchObject({ model: "claude-haiku-5-5", max_tokens: 4096, output_config: { effort: "medium" } });
    expect(requests[0]).not.toHaveProperty("temperature");
    expect(requests[0]).not.toHaveProperty("thinking"); // adaptive is the model's default
  });

  test("proposals stream as they grow and come back with the turn", async () => {
    const { events, done } = await turn([
      { content: [call("t1", "add_person", { name: "Mia Cruz", gender: "female", birthYear: null, deathYear: null, birthMonth: null, birthDay: null, deathMonth: null, deathDay: null })], stop_reason: "tool_use" },
      { content: [call("t2", "add_child", { parentIds: [jake], childId: "new:1" })], stop_reason: "tool_use" },
      { content: [text("Shall I add Mia?")], stop_reason: "end_turn" },
    ]);
    expect(events.filter((e) => e.type === "proposal")).toHaveLength(2);
    expect(done.pending.map((op) => op.op)).toEqual(["createPerson", "createUnion", "addChild"]);
  });

  test(`after ${MAX_TOOL_ROUNDS} tool rounds it stops, still answering every tool call`, async () => {
    const lookups = Array.from({ length: MAX_TOOL_ROUNDS + 3 }, (_, i) => ({ content: [call(`t${i}`, "search_people", { name: "Cruz", year: null })], stop_reason: "tool_use" as const }));
    const { requests, done } = await turn(lookups);
    expect(requests).toHaveLength(MAX_TOOL_ROUNDS + 1);
    const last = done.turn.at(-1)!;
    expect(last.role).toBe("user");
    expect((last.content as Anthropic.ToolResultBlockParam[])[0]).toMatchObject({ is_error: true, content: expect.stringContaining("too many steps") });
  });

  test("a refusal ends the turn with a plain message", async () => {
    const { events, done } = await turn([{ content: [], stop_reason: "refusal" }]);
    expect(events).toContainEqual({ type: "text", text: "I can't help with that." });
    expect(done.turn.map((m) => m.role)).toEqual(["system", "assistant"]);
  });
});

describe("the request from the chat panel", () => {
  const body = (over: object = {}) => JSON.stringify({ groupId: "a".repeat(24), messages: [{ role: "user", content: "Who is Jake?" }], pending: [], ...over });

  test("a question, the history, the proposal and a note pass", () => {
    const parsed = parseChatRequest(body({ note: { confirmed: { "new:1": "b".repeat(24) } } }));
    expect(parsed).toMatchObject({ groupId: "a".repeat(24), history: [{ role: "user", content: "Who is Jake?" }], note: { confirmed: { "new:1": "b".repeat(24) } } });
  });

  test.each([
    ["not JSON", "{", "The request couldn't be read."],
    ["no question at the end", body({ messages: [{ role: "assistant", content: "Hi" }] }), "Type a message first."],
    ["a blank question", body({ messages: [{ role: "user", content: "  " }] }), "Type a message first."],
    ["an unknown block type", body({ messages: [{ role: "user", content: [{ type: "image" }] }, { role: "user", content: "x" }] }), "The request couldn't be read."],
    ["a malformed proposal", body({ pending: [{ op: "dropTable" }] }), "The request couldn't be read."],
    ["too many messages", body({ messages: Array.from({ length: MAX_MESSAGES + 1 }, () => ({ role: "user", content: "x" })) }), "This conversation is too long. Start a new chat."],
    ["a huge question", body({ messages: [{ role: "user", content: "x".repeat(2001) }] }), "Keep a message under 2000 characters."],
  ])("%s is refused", (_label, text, reason) => {
    expect(parseChatRequest(text)).toBe(reason);
  });
});

describe("chat settings", () => {
  test("set up only with a key; the model, limit and address have defaults", () => {
    expect(chatConfig({})).toBeUndefined();
    expect(chatConfig({ CHAT_API_KEY: "k" })).toEqual({ apiKey: "k", model: "claude-haiku-5-5", dailyLimit: 50, apiUrl: "https://api.anthropic.com" });
    expect(chatConfig({ CHAT_API_KEY: "k", CHAT_DAILY_LIMIT: "5", CHAT_API_URL: "http://localhost:3102" })).toMatchObject({ dailyLimit: 5, apiUrl: "http://localhost:3102" });
    expect(chatConfig({ CHAT_API_KEY: "k", ANTHROPIC_BASE_URL: "https://gateway.example" })?.apiUrl).toBe("https://api.anthropic.com"); // never the ambient one
  });
});
