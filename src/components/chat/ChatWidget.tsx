"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import type { ProposalNote } from "@/server/ai/prompt";
import type { Operation } from "@/server/operations/schema";
import type { GroupTree } from "@/tree/types";
import { widePanel } from "../tree/edit/panel";
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
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h2 className="font-semibold">Ask about your family</h2>
        <div className="flex gap-1 text-sm">
          <button type="button" onClick={newChat} disabled={busy} className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 pointer-coarse:min-h-11 dark:text-zinc-400 dark:hover:bg-zinc-800">
            New chat
          </button>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 pointer-coarse:min-h-11 dark:text-zinc-400 dark:hover:bg-zinc-800">
            Close
          </button>
        </div>
      </div>

      <div ref={log} role="log" aria-label="Conversation" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 text-sm">
        {lines.length === 0 && !busy && (
          <p className="text-zinc-500 dark:text-zinc-400">
            Ask a question, like &ldquo;Who are Jake&apos;s grandchildren?&rdquo;, or tell me about someone new: &ldquo;Priya married Ravi in 2010.&rdquo; Changes are only saved when you confirm them.
          </p>
        )}
        {lines.map((line, i) => (
          <p
            key={i}
            data-from={line.from}
            className={
              line.from === "you"
                ? "self-end whitespace-pre-wrap rounded-2xl bg-zinc-900 px-3 py-2 text-white dark:bg-white dark:text-zinc-900"
                : line.from === "app"
                  ? "self-center text-xs text-zinc-500 dark:text-zinc-400"
                  : "whitespace-pre-wrap"
            }
          >
            {line.text}
          </p>
        ))}
        {busy && (
          <p data-from="assistant" className="whitespace-pre-wrap">
            {reply}
            {activity && <span role="status" className="block text-xs text-zinc-500 dark:text-zinc-400">{activity}…</span>}
            {!reply && !activity && <span className="text-zinc-500 dark:text-zinc-400">Thinking…</span>}
          </p>
        )}
        {proposal.length > 0 && <ProposalCard operations={proposal} tree={tree} busy={busy || saving} onConfirm={confirm} onDiscard={discard} />}
      </div>

      <form onSubmit={send} className="flex items-end gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
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
          className="min-w-0 flex-1 resize-none rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button type="submit" disabled={busy || !draft.trim()} className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 pointer-coarse:min-h-11 dark:bg-white dark:text-zinc-900">
          Send
        </button>
      </form>
    </aside>
  );
}
