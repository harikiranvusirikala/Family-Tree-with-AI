// @vitest-environment node
import { describe, expect, test } from "vitest";
import { FAQ, SITE_NAME, structuredData } from "./content";

describe("structuredData", () => {
  const site = "https://family-tree-with-ai.vercel.app";
  const graph = structuredData(site)["@graph"];
  const ofType = (type: string) => graph.find((node) => node["@type"] === type)!;

  test("the site and the app, at the site's own address, free to use", () => {
    expect(ofType("WebSite")).toMatchObject({ url: `${site}/`, name: SITE_NAME });
    expect(ofType("WebApplication")).toMatchObject({
      url: `${site}/`,
      name: SITE_NAME,
      image: `${site}/opengraph-image.png`,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0" },
    });
  });

  test("every question, with its answer word for word", () => {
    expect(ofType("FAQPage")).toMatchObject({
      mainEntity: FAQ.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
    });
    expect(FAQ.length).toBeGreaterThanOrEqual(6);
  });
});
