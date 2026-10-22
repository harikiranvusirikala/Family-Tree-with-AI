import Image from "next/image";
import { Suspense } from "react";
import { SignInButton, SignInError } from "@/components/auth/SignInButton";
import { BrowserFrame, PhoneFrame } from "./frames";
import chat from "./images/chat.webp";
import phoneTree from "./images/phone-tree.webp";

/** The top of the landing page: what the app is, Sign in with Google, and the app on a computer and a phone. */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem]">
        <div className="absolute -top-48 left-[8%] size-[34rem] rounded-full bg-blue-200/50 blur-3xl dark:bg-blue-500/10" />
        <div className="absolute -top-24 right-[4%] size-[30rem] rounded-full bg-pink-200/50 blur-3xl dark:bg-pink-500/10" />
      </div>
      <div className="mx-auto max-w-6xl px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-3.5 py-1 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
            <span aria-hidden className="size-1.5 rounded-full bg-[#fb7185]" />
            Private · Free · Open source
          </p>
          <h1 id="hero-title" className="mt-6 text-4xl font-semibold tracking-tight text-balance text-zinc-900 sm:text-5xl lg:text-6xl dark:text-zinc-100">
            Build your{" "}
            <span className="bg-linear-to-r from-blue-600 to-pink-600 bg-clip-text whitespace-nowrap text-transparent dark:from-blue-400 dark:to-pink-400">
              family tree
            </span>{" "}
            together, with an AI assistant
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-balance text-zinc-600 dark:text-zinc-400">
            Add relatives by hand, or just tell the assistant &ldquo;Priya married Ravi in 2010.&rdquo; The tree lays itself out, and only the relatives you
            invite can see it, on any phone, tablet or computer.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Suspense>
              <SignInError />
            </Suspense>
            <SignInButton />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">All you need is a Google account.</p>
          </div>
        </div>
        <div className="relative mx-auto mt-14 max-w-5xl pb-[7%] sm:mt-16">
          <BrowserFrame className="ml-auto w-[88%]">
            <Image
              src={chat}
              alt="A family tree on a computer, laid out automatically, with the AI assistant beside it: told “Priya Sharma married Ravi”, it asks which Ravi, then proposes the changes on a card with Confirm"
              unoptimized
              loading="eager"
              fetchPriority="high"
              className="h-auto w-full"
            />
          </BrowserFrame>
          <PhoneFrame className="absolute bottom-0 left-0 w-[23%]">
            <Image src={phoneTree} alt="The same family tree on a phone" unoptimized className="h-auto w-full" />
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}
