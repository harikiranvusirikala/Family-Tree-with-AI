import { afterEach, describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GoogleTagManager } from "./GoogleTagManager";

// The owner's snippets, as Tag Manager gives them (Admin → Install Google Tag Manager).
const GOOGLE_SCRIPT = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KZDLK4PQ');`;
const GOOGLE_NOSCRIPT = `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KZDLK4PQ" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
const RETURN_TO_CHECK = "if(!new URLSearchParams(location.search).has('returnTo'))\n";

const script = () => {
  const html = renderToStaticMarkup(<GoogleTagManager id="GTM-KZDLK4PQ" />);
  return html.slice("<script>".length, html.indexOf("</script>"));
};

// Drawn on the server, as the landing page is: in the browser, React never draws inside <noscript>.
describe("Google Tag Manager's snippets (owner request)", () => {
  test("Google's script after the returnTo check, then the frame for visitors without JavaScript; only the quotes around the ID differ", () => {
    expect(renderToStaticMarkup(<GoogleTagManager id="GTM-KZDLK4PQ" />)).toBe(
      `<script>${RETURN_TO_CHECK}${GOOGLE_SCRIPT.replace("'GTM-KZDLK4PQ'", '"GTM-KZDLK4PQ"')}</script>${GOOGLE_NOSCRIPT}`,
    );
  });

  test("nothing without a container", () => {
    expect(renderToStaticMarkup(<GoogleTagManager id={undefined} />)).toBe("");
  });
});

// The script run in the page (jsdom loads no outside scripts, so nothing reaches Google).
describe("the script in the page", () => {
  const run = (address: string) => {
    window.history.replaceState(null, "", address);
    document.head.append(document.createElement("script")); // Google's script goes before the page's first one
    new Function(script())();
  };
  const tagManager = () => document.querySelector('script[src^="https://www.googletagmanager.com/gtm.js"]');
  const dataLayer = () => (window as unknown as { dataLayer?: { event?: string }[] }).dataLayer;

  afterEach(() => {
    document.head.innerHTML = "";
    delete (window as unknown as { dataLayer?: unknown }).dataLayer;
    window.history.replaceState(null, "", "/");
  });

  test("loads Tag Manager for the container, as Google's snippet does", () => {
    run("/?error=access_denied");
    expect(tagManager()?.getAttribute("src")).toBe("https://www.googletagmanager.com/gtm.js?id=GTM-KZDLK4PQ");
    expect(dataLayer()?.[0]).toMatchObject({ event: "gtm.js" });
  });

  test("loads nothing when the address carries the link a signed-out visitor opened: an invite's token stays out of Google", () => {
    run("/?returnTo=%2Finvite%2Fsecret-invite-token");
    expect(tagManager()).toBeNull();
    expect(dataLayer()).toBeUndefined();
  });
});
