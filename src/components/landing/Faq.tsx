import { SignInButton } from "@/components/auth/SignInButton";
import { FAQ } from "./content";
import { Section, SectionHeading } from "./section";

/** The questions and answers, each opening on a tap. Search engines read the answers either way. */
export function Faq() {
  return (
    <Section id="faq">
      <SectionHeading id="faq" eyebrow="FAQ" title="Questions and answers" />
      <div className="mx-auto mt-12 max-w-3xl divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {FAQ.map(({ question, answer }) => (
          <details key={question} className="group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-left [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-medium text-zinc-900 sm:text-lg dark:text-zinc-100">{question}</h3>
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-500 transition-transform group-open:rotate-45 dark:border-zinc-700 dark:text-zinc-400"
              >
                +
              </span>
            </summary>
            <p className="pb-5 leading-relaxed text-zinc-600 dark:text-zinc-400">{answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/** The end of the page: a second way to sign in, for anyone who read this far. */
export function GetStarted() {
  return (
    <section id="get-started" aria-labelledby="get-started-title" className="bg-linear-to-br from-blue-50 to-pink-50 py-20 sm:py-24 dark:from-blue-950/40 dark:to-pink-950/40">
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 text-center">
        <h2 id="get-started-title" className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-100">
          Start your family tree today
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          It&apos;s free. Sign in with Google, add your parents&apos; names and invite the family.
        </p>
        <div className="mt-8">
          <SignInButton label="Continue with Google" />
        </div>
      </div>
    </section>
  );
}
