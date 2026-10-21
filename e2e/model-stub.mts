// A stand-in for the Claude Messages API during e2e runs (playwright.config.ts starts it), so no test
// calls Anthropic. It streams scripted replies in the API's own event format, and like the API it
// refuses a conversation whose thinking blocks were altered or whose operator (system) messages are
// in the wrong place. GET /calls lists what it received.
import { createServer } from "node:http";

const port = Number(process.env.PORT);
const apiKey = process.env.CHAT_API_KEY;

type Block = { type: string; [key: string]: unknown };
type Message = { role: "user" | "assistant" | "system"; content: string | Block[] };
interface Call {
  tools: string[];
  notes: string[]; // the operator messages' text
  lastQuestion: string;
}

const calls: Call[] = [];
const issued = new Set<string>(); // thinking signatures handed out
let replies = 0;

const textOf = (m: Message) => (typeof m.content === "string" ? m.content : m.content.flatMap((b) => (b.type === "text" ? [String(b.text)] : [])).join(""));
const isToolResults = (m: Message) => Array.isArray(m.content) && m.content.every((b) => b.type === "tool_result");

/** What the real API would refuse, or null. */
function problem(messages: Message[]): string | null {
  for (const [i, m] of messages.entries()) {
    if (m.role === "system" && (messages[i - 1]?.role !== "user" || (i < messages.length - 1 && messages[i + 1].role !== "assistant"))) {
      return `messages.${i}: a system message must follow a user message and be last or followed by an assistant message`;
    }
    if (m.role === "assistant" && Array.isArray(m.content)) {
      for (const b of m.content) if (b.type === "thinking" && (!issued.has(String(b.signature)) || b.thinking !== "")) return `messages.${i}: a thinking block was modified`;
    }
  }
  return null;
}

/** People listed in earlier search_people results. */
function searched(messages: Message[]): { id: string; name: string; born: number | null }[] {
  return messages.flatMap((m) =>
    Array.isArray(m.content)
      ? m.content.flatMap((b) => {
          if (b.type !== "tool_result") return [];
          try {
            return (JSON.parse(String(b.content)) as { people?: { id: string; name: string; born: number | null }[] }).people ?? [];
          } catch {
            return [];
          }
        })
      : [],
  );
}

/** The scripted reply: text, or tool calls. */
function reply(messages: Message[]): Block[] {
  const last = messages.at(-1)!;
  if (isToolResults(last)) {
    const asked = messages.at(-2)!;
    const names = Array.isArray(asked.content) ? asked.content.flatMap((b) => (b.type === "tool_use" ? [String(b.name)] : [])) : [];
    const results = (last.content as Block[]).map((b) => String(b.content));
    if (names.includes("search_people")) {
      const people = searched([last]);
      return [{ type: "text", text: `Which one do you mean: ${people.map((p) => `${p.name} (born ${p.born})`).join(" or ")}?` }];
    }
    if (names.includes("add_person")) {
      const temp = /is (new:\d+)/.exec(results[0])?.[1] ?? "new:1";
      const ravi = searched(messages).find((p) => p.born === 1980);
      return [
        { type: "tool_use", name: "add_marriage", input: { personId: temp, partnerId: ravi?.id ?? "unknown", status: "married", marriageYear: null, marriageMonth: null, marriageDay: null } },
        { type: "tool_use", name: "create_sheet", input: { rootPersonId: temp, title: "Priya Sharma's family" } },
      ];
    }
    if (names.includes("add_marriage")) return [{ type: "text", text: "I've prepared the changes. Please check them on the card and confirm." }];
    return [{ type: "text", text: "Done." }];
  }
  const question = [...messages].reverse().find((m) => m.role === "user" && typeof m.content === "string");
  const text = question ? textOf(question) : "";
  if (/married Ravi/i.test(text)) return [{ type: "tool_use", name: "search_people", input: { name: "Ravi", year: null } }];
  if (/^1980$/.test(text.trim())) return [{ type: "tool_use", name: "add_person", input: { name: "Priya Sharma", gender: "female", birthYear: null, birthMonth: null, birthDay: null, deathYear: null, deathMonth: null, deathDay: null } }];
  if (/^who is/i.test(text)) return [{ type: "text", text: "Jake Cruz was born in 1945." }];
  return [{ type: "text", text: "I can help with your family tree." }];
}

/** The reply as the API streams it: a thinking block (empty, as Claude Haiku 5.5 sends them), then the rest. */
function sse(model: string, blocks: Block[]): string {
  const n = ++replies;
  const signature = `stub-signature-${n}`;
  issued.add(signature);
  const events: unknown[] = [
    { type: "message_start", message: { id: `msg_stub_${n}`, type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 1 } } },
    { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature } },
    { type: "content_block_stop", index: 0 },
  ];
  blocks.forEach((block, i) => {
    const index = i + 1;
    if (block.type === "text") {
      const text = String(block.text);
      const half = Math.ceil(text.length / 2);
      events.push(
        { type: "content_block_start", index, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index, delta: { type: "text_delta", text: text.slice(0, half) } },
        { type: "content_block_delta", index, delta: { type: "text_delta", text: text.slice(half) } },
      );
    } else {
      events.push(
        { type: "content_block_start", index, content_block: { type: "tool_use", id: `toolu_stub_${n}_${index}`, name: block.name, input: {} } },
        { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } },
      );
    }
    events.push({ type: "content_block_stop", index });
  });
  const stopReason = blocks.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn";
  events.push({ type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 20 } }, { type: "message_stop" });
  return events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
}

createServer(async (request, response) => {
  const json = (status: number, body: unknown) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
  const path = new URL(request.url ?? "/", "http://stub").pathname;
  if (request.method === "GET" && path === "/") return json(200, { ok: true }); // Playwright's readiness check
  if (request.method === "GET" && path === "/calls") return json(200, calls);
  if (request.method !== "POST" || path !== "/v1/messages") return json(404, { type: "error", error: { type: "not_found_error", message: "Not found" } });
  if (request.headers["x-api-key"] !== apiKey) return json(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });

  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw) as { model: string; messages: Message[]; tools?: { name: string }[]; stream?: boolean };
  const bad = problem(body.messages);
  if (bad) return json(400, { type: "error", error: { type: "invalid_request_error", message: bad } });
  const question = [...body.messages].reverse().find((m) => m.role === "user" && typeof m.content === "string");
  calls.push({
    tools: (body.tools ?? []).map((t) => t.name),
    notes: body.messages.filter((m) => m.role === "system").map(textOf),
    lastQuestion: question ? textOf(question) : "",
  });
  response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  response.end(sse(body.model, reply(body.messages)));
}).listen(port);
