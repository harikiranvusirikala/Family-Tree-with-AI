import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SITE_NAME } from "./content";

/** Links to the landing page's parts; the header shows them on tablets and computers. */
export const PAGE_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#ai-assistant", label: "AI assistant" },
  { href: "#features", label: "Features" },
  { href: "#privacy", label: "Privacy" },
  { href: "#faq", label: "FAQ" },
];

export const pageLink = "inline-flex items-center text-zinc-600 hover:text-zinc-900 pointer-coarse:min-h-11 dark:text-zinc-400 dark:hover:text-zinc-100";

/** The app's icon and name. */
export function Logo() {
  return (
    <span className="flex items-center gap-2.5 font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
      <Image src="/icon.svg" alt="" width={32} height={32} className="size-8 rounded-[22%] dark:ring-1 dark:ring-white/15" />
      {SITE_NAME}
    </span>
  );
}

/** The landing page's header: it stays at the top while the page scrolls. */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <a href="#top" aria-label={`${SITE_NAME}, top of the page`} className="pointer-coarse:min-h-11 flex items-center">
          <Logo />
        </a>
        <nav aria-label="Page sections" className="hidden items-center gap-7 text-sm md:flex">
          {PAGE_LINKS.map(({ href, label }) => (
            <a key={href} href={href} className={pageLink}>
              {label}
            </a>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
