import { LineIcon, type IconName } from "./icons";
import { Section, SectionHeading } from "./section";

const STEPS = [
  {
    title: "Sign in and name your parents",
    text: "Sign in with Google and start a family tree with your father's and mother's names. Each side of the family gets its own sheet.",
  },
  {
    title: "Add your relatives",
    text: "Tap anyone to add their parents, partner or children, with photos and dates. Or tell the AI assistant in plain words.",
  },
  {
    title: "Invite the family",
    text: "Invite relatives by email and send them the link on WhatsApp. Choose who can only look and who can edit, and build it together.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" tinted>
      <SectionHeading id="how-it-works" eyebrow="How it works" title="Make your family tree in three steps" />
      <ol className="mt-14 grid gap-6 md:grid-cols-3">
        {STEPS.map(({ title, text }, i) => (
          <li key={title} className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">
              {i + 1}
            </span>
            <h3 className="mt-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            <p className="mt-2 leading-relaxed text-zinc-600 dark:text-zinc-400">{text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** Small cards with an icon, a title and a sentence, two or three to a row. */
function Cards({ items, columns }: { items: { icon: IconName; title: string; text: string }[]; columns: string }) {
  return (
    <ul className={`mt-14 grid gap-6 sm:grid-cols-2 ${columns}`}>
      {items.map(({ icon, title, text }, i) => (
        <li key={title} className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <span
            className={`flex size-10 items-center justify-center rounded-xl ${i % 2 ? "bg-pink-50 text-pink-600 dark:bg-pink-950/60 dark:text-pink-400" : "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"}`}
          >
            <LineIcon name={icon} className="size-5" />
          </span>
          <h3 className="mt-5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <p className="mt-2 leading-relaxed text-zinc-600 dark:text-zinc-400">{text}</p>
        </li>
      ))}
    </ul>
  );
}

export function Features() {
  return (
    <Section id="features">
      <SectionHeading id="features" eyebrow="Features" title="Everything your family tree needs">
        A classic family tree that draws itself, and the tools to keep it up to date together.
      </SectionHeading>
      <Cards
        columns="lg:grid-cols-3"
        items={[
          {
            icon: "tree",
            title: "Laid out for you",
            text: "Couples side by side with a heart between them, children below, eldest first. Add someone and the tree makes room.",
          },
          {
            icon: "sheets",
            title: "A sheet for each side",
            text: "Your father's family, your mother's family, and one for anyone who marries in. Everyone is stored once and appears on every sheet that reaches them.",
          },
          {
            icon: "photo",
            title: "Photos, or just initials",
            text: "Add a photo to anyone, iPhone photos included. One tap shows initials instead, for sharing a picture without faces.",
          },
          {
            icon: "calendar",
            title: "Dates and ages",
            text: "Full birth, death and wedding dates, with ages worked out for you. Leave out what you don't know: a year is enough.",
          },
          {
            icon: "transfer",
            title: "Import and export",
            text: "Bring your tree from Ancestry, FamilySearch or MyHeritage with GEDCOM. Take it anywhere as GEDCOM or JSON, a picture, or a printed PDF.",
          },
          {
            icon: "code",
            title: "Free and open source",
            text: "No ads and no subscription. Every line of code is public on GitHub under the MIT license.",
          },
        ]}
      />
    </Section>
  );
}

export function Privacy() {
  return (
    <Section id="privacy" tinted>
      <SectionHeading id="privacy" eyebrow="Privacy" title="Private by design">
        Family details are personal. Only your family sees them, and nothing changes without someone choosing to change it.
      </SectionHeading>
      <Cards
        columns="lg:grid-cols-4"
        items={[
          {
            icon: "lock",
            title: "Only the people you invite",
            text: "Your family tree is never public, and search engines can't see it. An invite works only for the Google account it was sent to.",
          },
          {
            icon: "people",
            title: "A role for everyone",
            text: "View, Maintain, Admin or Owner. Relatives who only look can't change anything, and only Admins let new people in.",
          },
          {
            icon: "sparkle",
            title: "The AI asks first",
            text: "It proposes changes on a card. Nothing is saved until you press Confirm, and every change is checked like one made by hand.",
          },
          {
            icon: "shield",
            title: "Backed up every night",
            text: "The database is copied, encrypted, every night, and each copy is test-restored before it's kept.",
          },
        ]}
      />
    </Section>
  );
}
