import type { Metadata } from "next";
import { GoogleTagManager } from "@/components/GoogleTagManager";
import { DESCRIPTION, GOOGLE_SITE_VERIFICATION, SITE_NAME, TITLE, structuredData } from "@/components/landing/content";
import { Faq, GetStarted } from "@/components/landing/Faq";
import { Features, HowItWorks, Privacy } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Phones, Spotlights } from "@/components/landing/Showcase";
import type { AuthUrlEnv } from "@/server/auth-urls";
import { siteUrl } from "@/server/site";
import { gtmId, type TagManagerEnv } from "@/server/tag-manager";

// The landing page: sign-in, and the only page search engines see (robots.ts, sitemap.ts). The
// preview image beside this file (opengraph-image.png) is made by `npm run images`.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // One address for this page, also when a signed-out link adds ?returnTo= (src/proxy.ts).
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  verification: { google: GOOGLE_SITE_VERIFICATION },
};

export default function Home() {
  // `<` escaped so no text can close the script early (Next.js's JSON-LD guide).
  const jsonLd = JSON.stringify(structuredData(siteUrl(process.env as AuthUrlEnv))).replace(/</g, "\\u003c");
  return (
    <>
      {/* First, as Google asks, and on this page only (an owner request); nothing without GTM_ID. */}
      <GoogleTagManager id={gtmId(process.env as TagManagerEnv)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Spotlights />
        <Phones />
        <Features />
        <Privacy />
        <Faq />
        <GetStarted />
      </main>
      <LandingFooter />
    </>
  );
}
