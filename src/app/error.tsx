"use client";

import { useEffect } from "react";
import Link from "next/link";
import { button } from "@/components/ui/button";
import { MessagePage, MessageText } from "@/components/ui/MessagePage";

/** Anything that fails while drawing a page: say so plainly, and offer to try again (Next.js's retry). */
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <MessagePage icon="alert" title="Something went wrong">
      <MessageText>This page couldn&apos;t load. It may be a passing problem with the connection: try again in a moment.</MessageText>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => retry()} className={button("primary")}>
          Try again
        </button>
        <Link href="/dashboard" className={button("secondary")}>
          Go to your family trees
        </Link>
      </div>
    </MessagePage>
  );
}
