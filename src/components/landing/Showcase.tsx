import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";
import { ChatPreview } from "./ChatPreview";
import { BrowserFrame, PhoneFrame } from "./frames";
import { LineIcon } from "@/components/ui/icons";
import { Eyebrow, Section, SectionHeading } from "./section";
import dashboardUpcoming from "./images/dashboard-upcoming.webp";
import network from "./images/network.webp";
import phonePanel from "./images/phone-panel.webp";
import phoneTree from "./images/phone-tree.webp";
import phoneUpcoming from "./images/phone-upcoming.webp";
import wheel from "./images/wheel.webp";

/**
 * One feature told at length: the words on one side, a picture on the other (swapped when `flip`), the
 * picture's side wider on computers.
 */
function Spotlight(props: { id: string; eyebrow: string; title: string; points: ReactNode[]; flip?: boolean; picture: ReactNode; children: ReactNode }) {
  const { id, eyebrow, title, points, flip = false, picture, children } = props;
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`grid scroll-mt-24 items-center gap-10 lg:gap-16 ${flip ? "lg:grid-cols-[3fr_2fr]" : "lg:grid-cols-[2fr_3fr]"}`}
    >
      <div className={flip ? "lg:order-2" : undefined}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={`${id}-title`} className="mt-2 text-3xl font-semibold tracking-tight text-balance text-zinc-900 sm:text-4xl dark:text-zinc-100">
          {title}
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</p>
        <ul className="mt-6 flex flex-col gap-3">
          {points.map((point, i) => (
            <li key={i} className="flex gap-3 text-zinc-700 dark:text-zinc-300">
              <LineIcon name="check" className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? "lg:order-1" : undefined}>{picture}</div>
    </section>
  );
}

function Screenshot({ image, alt }: { image: StaticImageData; alt: string }) {
  return (
    <BrowserFrame>
      <Image src={image} alt={alt} unoptimized className="h-auto w-full" />
    </BrowserFrame>
  );
}

/** The assistant, the relatives wheel, the network and the birthdays, one after another. */
export function Spotlights() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-24 px-6 py-20 sm:gap-32 sm:py-28">
      <Spotlight
        id="ai-assistant"
        eyebrow="AI assistant"
        title="Just tell it what happened"
        points={[
          <>Ask anything: &ldquo;Who are Jake&apos;s grandchildren?&rdquo;</>,
          <>Share news: &ldquo;Priya married Ravi in 2010.&rdquo;</>,
          "It asks when a name could mean two people",
          "Nothing is saved until you press Confirm",
        ]}
        picture={<ChatPreview />}
      >
        Ask about your family or share news in plain words. The assistant knows everyone in your tree, asks when it isn&apos;t sure, and shows exactly what it
        will change before anything is saved.
      </Spotlight>
      <Spotlight
        id="relatives-wheel"
        eyebrow="Relatives wheel"
        title="Relationship names in Telugu or English"
        points={["Telugu names in English letters, or English with one tap", "Knows elder and younger, and whose side of the family", "Find anyone to put them in the middle"]}
        flip
        picture={
          <Screenshot
            image={wheel}
            alt="The relatives wheel around Steve Cruz: everyone else in rings by how close they are, each labelled in Telugu, such as Amma, Nanna, Thathayya and Menamama"
          />
        }
      >
        Put anyone in the middle and everyone else falls into rings by how close they are, each named from that person&apos;s point of view: Ammamma, Babai, Attha,
        Bava, or grandmother, uncle, aunt, brother-in-law.
      </Spotlight>
      <Spotlight
        id="network"
        eyebrow="The whole family"
        title="See how everyone is connected"
        points={["See everyone as one tree, a network, a wheel or a list", "Find anyone by name", "Bigger circles for people with more relations"]}
        picture={
          <Screenshot
            image={network}
            alt="The family network: every person as a circle, hearts joining couples and arrows from parents to children, with one person's parents, partners and children lit up"
          />
        }
      >
        Every person and every relation on one canvas: hearts join couples and arrows run from parents to children. Choose someone to light up their parents,
        partners and children.
      </Spotlight>
      <Spotlight
        id="birthdays"
        eyebrow="Birthdays and anniversaries"
        title="Never miss a birthday or an anniversary"
        points={["The next twelve months, month by month", "Your dashboard shows the next 30 days across all your families", "Ages worked out for you"]}
        flip
        picture={
          <Screenshot
            image={dashboardUpcoming}
            alt="Upcoming on the dashboard: today's and tomorrow's birthdays, then the next ones with how soon they are, and a Shashtipurti badge for a 60th birthday"
          />
        }
      >
        Add full dates and the family calendar fills itself in: who&apos;s turning what, every couple&apos;s wedding anniversary, and milestones like
        Shashtipurti, Silver and Golden.
      </Spotlight>
    </div>
  );
}

const PHONES: { image: StaticImageData; caption: string; alt: string }[] = [
  { image: phoneTree, caption: "The tree, easy to read", alt: "A family tree on a phone, with names and years readable" },
  { image: phonePanel, caption: "Anyone's details, a tap away", alt: "A person's details on a phone: parents, partners, children and their age" },
  { image: phoneUpcoming, caption: "Birthdays coming up", alt: "Upcoming birthdays and anniversaries on a phone" },
];

/** Three phone screens side by side. */
export function Phones() {
  return (
    <Section id="phones" tinted>
      <SectionHeading id="phones" eyebrow="Everywhere" title="Made for phones, tablets and computers">
        Nothing to install: open it in the browser on any screen, by day or by night. Share the link with the family on WhatsApp.
      </SectionHeading>
      <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-3 sm:gap-8">
        {PHONES.map(({ image, caption, alt }) => (
          <figure key={caption} className="flex flex-col items-center gap-4">
            <PhoneFrame className="w-full">
              <Image src={image} alt={alt} unoptimized className="h-auto w-full" />
            </PhoneFrame>
            <figcaption className="text-center text-sm text-zinc-600 dark:text-zinc-400">{caption}</figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
