/**
 * Google Tag Manager's two snippets, as Tag Manager gives them (Admin → Install Google Tag Manager),
 * for the container `id` from gtmId(), or nothing without one. Only the landing page draws them (an
 * owner request): signed-in pages, with families' names, dates and photos, load nothing from other
 * sites. Google asks for the script high in <head> and the frame right after <body>, but only the
 * root layout owns <head>, and it can't tell which page it holds without making every page dynamic,
 * so the landing page puts both first: right after <body>.
 */
export function GoogleTagManager({ id }: { id: string | undefined }) {
  if (!id) return null;
  return (
    <>
      {/* Runs on a full page load only: React never runs a script it adds while navigating. */}
      <script dangerouslySetInnerHTML={{ __html: tagManagerScript(id) }} />
      {/* For visitors without JavaScript. */}
      <noscript>
        <iframe src={`https://www.googletagmanager.com/ns.html?id=${id}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
      </noscript>
    </>
  );
}

/**
 * Google's script word for word, apart from the ID, which is written in as a JavaScript string, and
 * one check before it: not when the address carries `?returnTo=` (the link a signed-out visitor
 * opened, set by src/proxy.ts), which can hold an invite's token or a group's and a person's ids.
 * Tag Manager's tags (Google Analytics) record each page's whole address (the owner's choice, 2026-10-22).
 */
function tagManagerScript(id: string) {
  return `if(!new URLSearchParams(location.search).has('returnTo'))
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',${JSON.stringify(id)});`;
}
