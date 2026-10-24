// The landing page's words that search engines read twice: its title and description (the page's
// metadata, and the link previews), and its questions and answers (the page, and its structured data).
// A plain module: the page, a server component, and the tests import it.

export const SITE_NAME = "Family Tree with AI";
export const TITLE = "Family Tree with AI: build your family tree together";
/** Up to about 160 characters: search results cut longer ones. */
export const DESCRIPTION =
  "Build your family tree together, by hand or by chatting with an AI assistant. Free and private: invite relatives, add photos, track birthdays, import GEDCOM.";

/**
 * Google Search Console's check that the owner runs the live site (2026-10-22). It only works for the
 * owner's site; a copy of the app puts its own code here, or deletes this and its use in src/app/page.tsx.
 */
export const GOOGLE_SITE_VERIFICATION = "iS4OF4-2DT8drLIM-FZU8JA8b-ALGsTFZEbWyQEoj8Y";

/** The code, linked from the page's footer. */
export const SOURCE_URL = "https://github.com/harikiranvusirikala/Family-Tree-with-AI";

export interface Question {
  question: string;
  answer: string;
}

/** Shown on the page and given to search engines as they are, so they always match. */
export const FAQ: Question[] = [
  {
    question: "Is Family Tree with AI free?",
    answer:
      "Yes. It's free to use, with no ads and no subscription, and its code is open source under the MIT license. The AI assistant answers up to 50 messages per person each day.",
  },
  {
    question: "Who can see my family tree?",
    answer:
      "Only the people you invite. A family tree stays private until an Admin invites someone by email, shares an invite link that expires, or lets in someone who asked, and each person gets a role: View, Maintain, Admin or Owner. Search engines never see it.",
  },
  {
    question: "How does the AI assistant work?",
    answer:
      "Ask about your family or tell it news in plain words, like “Priya married Ravi in 2010.” It looks people up in your tree, asks when a name could mean two people, and proposes the changes on a card. Nothing is saved until you press Confirm. The assistant runs on Anthropic's Claude, which receives your question and the family details it needs to answer it.",
  },
  {
    question: "Can I import my tree from Ancestry, MyHeritage or FamilySearch?",
    answer:
      "Yes. Download a GEDCOM file there and import it here, into your family tree or as a new one. A preview shows anyone who may already be in your tree before anything is saved. A file can hold up to 2,000 people.",
  },
  {
    question: "Can I download or print my family tree?",
    answer:
      "Yes. Save any sheet as a picture or print it (and so save a PDF). Download your family's data as GEDCOM, for other genealogy apps, or as JSON, which keeps everything.",
  },
  {
    question: "Does it know Telugu relationship names?",
    answer:
      "Yes. The relatives wheel names everyone from any person's point of view in Telugu, written in English letters (Amma, Nanna, Ammamma, Thathayya, Babai, Pinni, Attha, Mavayya, Bava, Vadina…), or in English with one tap.",
  },
  {
    question: "Does it work on phones?",
    answer: "Yes. It works in the web browser on phones, tablets and computers, with nothing to install, in a day or a night theme.",
  },
  {
    question: "Can I run my own copy?",
    answer:
      "Yes. The code is on GitHub with step-by-step instructions for running your own copy on the free plans of Vercel, MongoDB Atlas and Cloudinary. Only the AI assistant costs money, a few cents a month.",
  },
];

/** What the app does, for search engines (schema.org's featureList). */
const FEATURES = [
  "An AI assistant that answers questions about the family and proposes changes for you to confirm",
  "A family tree laid out automatically, with a sheet for each side of the family",
  "Private sharing by invitation, with View, Maintain, Admin and Owner roles",
  "Photos, full dates and ages",
  "Birthdays and wedding anniversaries, with milestones",
  "Relationship names in Telugu or English",
  "GEDCOM and JSON import and export, pictures and printing",
  "Phones, tablets and computers, in a day or night theme",
];

/**
 * Structured data for search engines (JSON-LD, schema.org): the site, the app, and the questions and
 * answers. `site` is the site's address without a trailing slash (siteUrl in src/server/site.ts).
 */
export function structuredData(site: string) {
  const home = `${site}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${home}#website`, url: home, name: SITE_NAME, description: DESCRIPTION, inLanguage: "en" },
      {
        "@type": "WebApplication",
        "@id": `${home}#app`,
        name: SITE_NAME,
        url: home,
        description: DESCRIPTION,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Any, in a web browser",
        browserRequirements: "Requires JavaScript",
        image: `${site}/opengraph-image.png`,
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: FEATURES,
        license: "https://opensource.org/license/mit",
      },
      {
        "@type": "FAQPage",
        "@id": `${home}#faq`,
        mainEntity: FAQ.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
      },
    ],
  };
}
