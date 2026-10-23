"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import type { ProposalNote } from "@/server/ai/prompt";
import type { Operation } from "@/server/operations/schema";
import type { GroupTree } from "@/tree/types";
import { widePanel } from "../tree/edit/panel";
import { button, iconButton } from "../ui/button";
import { GradientSparkle } from "../ui/GradientSparkle";
import { LineIcon } from "../ui/icons";
import { chatEvents } from "./chat-stream";
import { ProposalCard } from "./ProposalCard";

type Line = { from: "you" | "assistant" | "app"; text: string };

/**
 * F7: the family assistant, beside the tree. The conversation lives here, in the browser, for this
 * visit (decided in step 9): each message sends it back to /api/chat, which streams the reply.
 * Proposals are confirmed with `run`, the same path as editing by hand.
 */
export function ChatWidget({
  groupId,
  tree,
  run,
  pending: saving,
  onClose,
}: {
  groupId: string;
  tree: GroupTree;
  run: (ops: Operation[]) => Promise<Record<string, string> | null>;
  pending: boolean;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<Anthropic.MessageParam[]>([]); // sent back unchanged
  const [lines, setLines] = useState<Line[]>([]);
  const [reply, setReply] = useState(""); // the assistant's reply as it streams in
  const [activity, setActivity] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Operation[]>([]);
  const [note, setNote] = useState<ProposalNote | undefined>();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines, reply, proposal]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const asked: Anthropic.MessageParam[] = [...history, { role: "user", content: text }];
    setDraft("");
    setBusy(true);
    setLines((l) => [...l, { from: "you", text }]);
    let streamed = "";
    let toolsSinceText = false;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ groupId, messages: asked, pending: proposal, note }),
      });
      if (!response.ok) {
        const { error } = (await response.json().catch(() => ({}))) as { error?: string };
        setLines((l) => [...l, { from: "app", text: error ?? "The assistant isn't available right now." }]);
        return;
      }
      for await (const e of chatEvents(response)) {
        if (e.type === "text") {
          streamed += (toolsSinceText && streamed ? "\n\n" : "") + e.text;
          toolsSinceText = false;
          setReply(streamed);
          setActivity(null);
        } else if (e.type === "tool") {
          toolsSinceText = true;
          setActivity(e.activity);
        } else if (e.type === "proposal") {
          setProposal(e.operations);
        } else if (e.type === "done") {
          setHistory([...asked, ...e.turn]);
          setProposal(e.pending);
          setNote(undefined); // the model has heard it
        } else {
          streamed += `${streamed ? "\n\n" : ""}${e.message}`;
        }
      }
      setLines((l) => [...l, { from: "assistant", text: streamed || "…" }]);
    } catch {
      setLines((l) => [...l, { from: "app", text: "The connection was lost. Try again." }]);
    } finally {
      setReply("");
      setActivity(null);
      setBusy(false);
    }
  }

  async function confirm() {
    const idMap = await run(proposal);
    if (!idMap) return setLines((l) => [...l, { from: "app", text: "Not saved: see the message above the tree." }]);
    setProposal([]);
    setNote({ confirmed: idMap });
    setLines((l) => [...l, { from: "app", text: "Saved." }]);
  }

  function discard() {
    setProposal([]);
    setNote({ discarded: true });
    setLines((l) => [...l, { from: "app", text: "Discarded." }]);
  }

  function newChat() {
    setHistory([]);
    setLines([]);
    setProposal([]);
    setNote(undefined);
  }

  const enterSends = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <aside aria-label="Family assistant" className={`${widePanel} flex flex-col`}>
      <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 dark:bg-white">
          <GradientSparkle className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] leading-tight font-semibold">Ask about your family</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Saved only when you confirm</p>
        </div>
        <button type="button" onClick={newChat} disabled={busy} className={button("ghost", "sm")}>
          New chat
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className={`${iconButton} -mr-1.5`}>
          <LineIcon name="x" className="size-5" />
        </button>
      </div>

      <div ref={log} role="log" aria-label="Conversation" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 text-sm">
        {lines.length === 0 && !busy && (
          <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
            <p className="text-zinc-600 dark:text-zinc-400">Ask a question, or tell me about someone new. Try:</p>
            <div className="flex flex-col items-start gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setDraft(example)}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-left text-[13px] text-zinc-700 transition-colors outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-500/70 pointer-coarse:min-h-11 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  &ldquo;{example}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}
        {lines.map((line, i) => (
          <Message key={i} from={line.from}>
            {line.text}
          </Message>
        ))}
        {busy && (
          <Message from="assistant">
            {reply}
            {activity && (
              <span role="status" className="block text-xs text-zinc-500 dark:text-zinc-400">
                {activity}…
              </span>
            )}
            {!reply && !activity && (
              <span className="flex items-center gap-1 py-1" aria-label="Thinking…" role="status">
                {[0, 150, 300].map((delay) => (
                  <span key={delay} className="size-1.5 animate-bounce rounded-full bg-zinc-400 motion-reduce:animate-none" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </span>
            )}
          </Message>
        )}
        {proposal.length > 0 && <ProposalCard operations={proposal} tree={tree} busy={busy || saving} onConfirm={confirm} onDiscard={discard} />}
      </div>

      <form onSubmit={send} className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex items-end gap-2 rounded-2xl border border-zinc-300 bg-white p-1.5 shadow-sm focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-950">
          <label className="sr-only" htmlFor="chat-message">
            Message
          </label>
          <textarea
            id="chat-message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={enterSends}
            rows={2}
            maxLength={2000}
            placeholder="Ask about your family…"
            className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={busy || !draft.trim()}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-colors outline-none hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-blue-500/70 disabled:opacity-40 pointer-coarse:size-11 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <LineIcon name="arrowUp" className="size-[18px]" />
          </button>
        </div>
      </form>
    </aside>
  );
}

/** What to try first, filling the box when chosen. */
const EXAMPLES = ["Who are Jake's grandchildren?", "Priya married Ravi in 2010."];

/** A line of the conversation: yours on the right, the assistant's beside its sparkle, the app's in the middle. */
function Message({ from, children }: { from: Line["from"]; children: ReactNode }) {
  if (from === "app") {
    return (
      <p data-from="app" className="self-center rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        {children}
      </p>
    );
  }
  if (from === "you") {
    return (
      <p data-from="you" className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-zinc-900 px-3.5 py-2 whitespace-pre-wrap text-white dark:bg-white dark:text-zinc-900">
        {children}
      </p>
    );
  }
  return (
    <div className="flex max-w-[92%] items-start gap-2">
      <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <GradientSparkle className="size-3.5" />
      </span>
      <p data-from="assistant" className="rounded-2xl rounded-tl-md bg-zinc-100 px-3.5 py-2 whitespace-pre-wrap text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
        {children}
      </p>
    </div>
  );
}
