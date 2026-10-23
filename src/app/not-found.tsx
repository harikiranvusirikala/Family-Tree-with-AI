import type { Metadata } from "next";
import Link from "next/link";
import { button } from "@/components/ui/button";
import { MessagePage, MessageText } from "@/components/ui/MessagePage";

export const metadata: Metadata = { title: "Page not found · Family Tree" };

/** Any address that doesn't exist, and notFound() (the developer pages outside `next dev`). */
export default function NotFound() {
  return (
    <MessagePage icon="compass" title="This page isn't here">
      <MessageText>The link may be wrong, or the page may have moved.</MessageText>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/dashboard" className={button("primary")}>
          Go to your dashboard
        </Link>
        <Link href="/" className={button("secondary")}>
          Home
        </Link>
      </div>
    </MessagePage>
  );
}
