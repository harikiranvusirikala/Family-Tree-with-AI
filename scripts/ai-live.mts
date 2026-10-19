// `npm run test:ai-live`: one real conversation with the chat model (F7), run by hand in your own
// terminal. It costs well under a cent. Uses the sample family in memory, so nothing is saved.
import type Anthropic from "@anthropic-ai/sdk";
import { runChatTurn, type ChatEvent } from "@/server/ai/chat";
import { chatClient, chatConfig } from "@/server/ai/config";
import { rosterNote } from "@/server/ai/prompt";
import { toolsFor } from "@/server/ai/tools";
import type { Operation } from "@/server/operations/schema";
import { describeOperations } from "@/tree/describe";
import { sampleState, toGroupTree } from "@test/planning";

// A terminal inside Claude Code has its gateway settings; they must not go to Anthropic with this key.
for (const name of ["ANTHROPIC_BASE_URL", "ANTHROPIC_CUSTOM_HEADERS", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY"]) delete process.env[name];

const config = chatConfig();
if (!config) {
  console.error("Set CHAT_API_KEY in .env.local first.");
  process.exit(1);
}

const state = sampleState();
const tree = toGroupTree(state);
const real = chatClient(config);
const usage: Anthropic.Usage[] = [];
const client = {
  messages: {
    stream: (params: Anthropic.MessageStreamParams) => {
      const stream = real.messages.stream(params);
      void stream.finalMessage().then((m) => usage.push(m.usage), () => {});
      return stream;
    },
  },
} as unknown as Pick<Anthropic, "messages">;

let history: Anthropic.MessageParam[] = [];
let pending: Operation[] = [];

async function say(question: string) {
  console.log(`\nYou: ${question}`);
  const asked: Anthropic.MessageParam[] = [...history, { role: "user", content: question }];
  const tools: string[] = [];
  let text = "";
  let failed: string | undefined;
  await runChatTurn({
    client,
    model: config!.model,
    tools: toolsFor("owner"),
    history: asked,
    notes: history.length === 0 ? [{ role: "system", content: rosterNote(tree, "owner") }] : [],
    context: { groupId: state.persons[0].groupId, state, tree, pending },
    emit: (event: ChatEvent) => {
      if (event.type === "text") text += event.text;
      if (event.type === "tool") tools.push(event.activity);
      if (event.type === "error") failed = event.message;
      if (event.type === "done") {
        history = [...asked, ...event.turn];
        pending = event.pending;
      }
    },
  });
  if (failed) throw new Error(failed);
  console.log(`Assistant: ${text}`);
  console.log(`  tools: ${tools.join("; ") || "none"}`);
  return text;
}

const checks: [string, boolean][] = [];
const answer = await say("Who are Jake Cruz's children?");
checks.push(["names all three of Jake's children", ["Cullen", "Christina", "Marie"].every((n) => answer.includes(n))]);

await say("Please add a daughter, Mia, to Jake and Taylor.");
const jakeAndTaylor = tree.unions.find((u) => u.partnerIds.every((id) => ["Jake Cruz", "Taylor Humes"].includes(tree.persons.find((p) => p.id === id)!.name)))!;
const mia = pending.find((op) => op.op === "createPerson" && /mia/i.test(op.name) && op.gender === "female");
checks.push(["proposes Mia as a new woman", !!mia]);
checks.push(["proposes her as Jake and Taylor's child", pending.some((op) => op.op === "addChild" && op.unionId === jakeAndTaylor.id && mia?.op === "createPerson" && op.childId === mia.tempId)]);
console.log(`\nProposal:\n${describeOperations(pending, tree).map((line) => `  - ${line}`).join("\n") || "  (none)"}`);

const sum = (key: "input_tokens" | "output_tokens" | "cache_read_input_tokens" | "cache_creation_input_tokens") => usage.reduce((n, u) => n + (u[key] ?? 0), 0);
const [input, output, cacheRead, cacheWrite] = [sum("input_tokens"), sum("output_tokens"), sum("cache_read_input_tokens"), sum("cache_creation_input_tokens")];
// Claude Haiku 5.5, prompts up to 100K tokens: $0.10 / $0.50 per million; cache reads 0.1x, 5-minute writes 1.25x.
const dollars = (input * 0.1 + output * 0.5 + cacheRead * 0.01 + cacheWrite * 0.125) / 1_000_000;
console.log(`\n${usage.length} requests to ${config.model}: ${input} input, ${cacheRead} cached, ${cacheWrite} cache-written, ${output} output tokens ≈ $${dollars.toFixed(5)}`);

for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
