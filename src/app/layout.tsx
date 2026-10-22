import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { THEME_SCRIPT } from "@/components/theme-script";
import type { AuthUrlEnv } from "@/server/auth-urls";
import { siteUrl } from "@/server/site";
import "./globals.css";

export const metadata: Metadata = {
  // Makes link-preview images and the landing page's canonical link full addresses (src/server/site.ts).
  metadataBase: new URL(siteUrl(process.env as AuthUrlEnv)),
  title: "Family Tree",
  description: "Build your family tree together and share it privately with your relatives.",
  // The name under the icon on an iPhone's home screen.
  appleWebApp: { title: "Family Tree" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the theme script adds "dark" to the class before React hydrates.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
