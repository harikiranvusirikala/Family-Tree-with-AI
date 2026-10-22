/**
 * The assistant's "Priya married Ravi" conversation from the README picture, drawn like the chat
 * panel (ChatWidget, ProposalCard) but as plain text: crisp at any size, in both themes, and readable
 * by search engines. Nothing in it can be pressed.
 */
export function ChatPreview() {
  const mine = "self-end rounded-2xl bg-zinc-900 px-3.5 py-2 text-white dark:bg-white dark:text-zinc-900";
  return (
    <figure className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-2xl shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50">
      <figcaption className="sr-only">An example conversation: the assistant asks which Ravi, then proposes the changes for you to confirm.</figcaption>
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Ask about your family</span>
        <span aria-hidden className="text-sm text-zinc-500 dark:text-zinc-400">New chat</span>
      </div>
      <div className="flex flex-col gap-3.5 p-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <p className={mine}>Priya Sharma married Ravi</p>
        <p>Which one do you mean: Ravi Kumar (born 1955) or Ravi Kumar (born 1980)?</p>
        <p className={mine}>1980</p>
        <p>I&apos;ve prepared the changes. Please check them on the card and confirm.</p>
        <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3.5 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">Proposed changes</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>Add Priya Sharma (female)</li>
            <li>Priya Sharma and Ravi Kumar (1980) are married</li>
            <li>New sheet &ldquo;Priya Sharma&apos;s family&rdquo; about Priya Sharma</li>
          </ul>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Nothing is saved until you confirm.</p>
          <div aria-hidden className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-900 px-4 py-1.5 font-medium text-white dark:bg-white dark:text-zinc-900">Confirm</span>
            <span className="px-4 py-1.5">Discard</span>
          </div>
        </div>
      </div>
    </figure>
  );
}
