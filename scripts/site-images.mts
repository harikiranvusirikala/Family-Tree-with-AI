// Makes the site's pictures: `npm run images`. Run it again after changing the icon or the README
// screenshots it uses.
// - From src/app/icon.svg: favicon.ico (16, 32 and 48 px) and apple-icon.png (180 px, square, since
//   iPhones round the corners themselves).
// - From the icon and docs/screenshots/chat.png and phone-tree.png: the link preview that search
//   results, chat apps and social sites show (src/app/opengraph-image.png, 1200 × 630), and GitHub's
//   social preview (docs/social-preview.png, 1280 × 640, uploaded in the repository's settings).
// - From docs/screenshots: the landing page's pictures (src/components/landing/images/*.webp), at
//   twice their largest size on the page. Ready-made, so the page needn't use Vercel's image quota.
// Text is drawn with Helvetica Neue (on macOS; elsewhere a similar font). sharp is Next.js's own
// image library, installed with it.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

const icon = await readFile("src/app/icon.svg", "utf8");
const dataUrl = (type: string, data: Buffer | string) => `data:${type};base64,${Buffer.from(data).toString("base64")}`;

/** The icon at `size` px: drawn four times larger, then scaled down, for smooth edges. */
const iconPng = (svg: string, size: number) => sharp(Buffer.from(svg), { density: (72 * size * 4) / 64 }).resize(size, size).png().toBuffer();

/** An .ico file holding PNG images (every browser since 2010 reads them). */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size, entry); // width
    header.writeUInt8(size, entry + 1); // height
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

const sizes = [16, 32, 48];
await writeFile("src/app/favicon.ico", ico(await Promise.all(sizes.map(async (size) => ({ size, png: await iconPng(icon, size) })))));
// The tile without its rounded corners: iPhones and iPads cut their own.
const square = icon.replace(/(<rect id="tile"[^>]*?) rx="[\d.]+"/, "$1");
if (square === icon) throw new Error('src/app/icon.svg: no <rect id="tile" … rx="…"> to square off');
await writeFile("src/app/apple-icon.png", await iconPng(square, 180));

// The tree's right part and the chat, from just before "+ New sheet" down to below the proposal card
// (1600 × 1000 → 1150 × 880).
const desktop = dataUrl("image/png", await sharp("docs/screenshots/chat.png").extract({ left: 450, top: 0, width: 1150, height: 880 }).png().toBuffer());
const phone = dataUrl("image/png", await readFile("docs/screenshots/phone-tree.png"));

/**
 * The preview, laid out on a 1280 × 640 page and scaled to fit `width` × `height`: the name, what it
 * does and the address on the left; the tree with Ask AI's proposal on a computer, and a phone, on the
 * right. Everything that matters stays 80 px in from the edges (GitHub's repository card template:
 * sites crop the edges), so only the background reaches them.
 */
function preview(width: number, height: number): string {
  const scale = Math.min(width / 1280, height / 640);
  const dx = (width - 1280 * scale) / 2;
  const dy = (height - 640 * scale) / 2;
  const line = (y: number, size: number, weight: number, fill: string, text: string, extra = "") =>
    `<text x="80" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${text}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f4f4f5"/></linearGradient>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.1" fill="#d4d4d8"/></pattern>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0.3" stop-color="#ffffff"/><stop offset="0.62" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
    <radialGradient id="blue-glow"><stop offset="0" stop-color="#bfdbfe" stop-opacity="0.85"/><stop offset="1" stop-color="#bfdbfe" stop-opacity="0"/></radialGradient>
    <radialGradient id="pink-glow"><stop offset="0" stop-color="#fbcfe8" stop-opacity="0.85"/><stop offset="1" stop-color="#fbcfe8" stop-opacity="0"/></radialGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#db2777"/></linearGradient>
    <filter id="shadow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="14"/><feOffset dy="12"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.2"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="window"><rect width="580" height="474" rx="14"/></clipPath>
    <clipPath id="screen"><rect x="7" y="7" width="156" height="266" rx="20"/></clipPath>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#paper)"/>
  <rect width="${width}" height="${height}" fill="url(#dots)"/>
  <rect width="${width}" height="${height}" fill="url(#fade)"/>
  <g transform="translate(${dx} ${dy}) scale(${scale})">
    <circle cx="1130" cy="90" r="360" fill="url(#blue-glow)"/>
    <circle cx="700" cy="660" r="340" fill="url(#pink-glow)"/>
    <image x="80" y="80" width="56" height="56" href="${dataUrl("image/svg+xml", icon)}"/>
    <text x="152" y="118" font-family="${FONT}" font-size="28" font-weight="700" fill="#18181b">Family Tree with AI</text>
    ${line(226, 58, 800, "#18181b", "Build your", 'letter-spacing="-1.4"')}
    ${line(292, 58, 800, "url(#brand)", "family tree", 'letter-spacing="-1.4"')}
    ${line(358, 58, 800, "#18181b", "together.", 'letter-spacing="-1.4"')}
    ${line(410, 22, 400, "#52525b", "Add relatives by hand, or just tell")}
    ${line(440, 22, 400, "#52525b", "the AI assistant. Share it privately")}
    ${line(470, 22, 400, "#52525b", "with your family. Free and open source.")}
    ${line(548, 19, 500, "#71717a", "family-tree-with-ai.vercel.app")}
    <g transform="translate(620 83)">
      <rect width="580" height="474" rx="14" fill="#ffffff" filter="url(#shadow)"/>
      <g clip-path="url(#window)">
        <rect width="580" height="30" fill="#f4f4f5"/>
        <circle cx="20" cy="15" r="5.5" fill="#f87171"/><circle cx="38" cy="15" r="5.5" fill="#fbbf24"/><circle cx="56" cy="15" r="5.5" fill="#34d399"/>
        <image y="30" width="580" height="444" href="${desktop}"/>
      </g>
      <rect width="580" height="474" rx="14" fill="none" stroke="#e4e4e7" stroke-width="1.5"/>
    </g>
    <g transform="translate(560 280)">
      <rect width="170" height="280" rx="26" fill="#18181b" filter="url(#shadow)"/>
      <image x="7" y="7" width="156" height="266" preserveAspectRatio="xMidYMin slice" clip-path="url(#screen)" href="${phone}"/>
    </g>
  </g>
</svg>`;
}

/** As small a PNG as looks the same: chat apps skip big link previews (WhatsApp's limit is about 300 KB). */
const png = (svg: string) => sharp(Buffer.from(svg)).png({ palette: true, quality: 90, effort: 10 }).toBuffer();

await writeFile("src/app/opengraph-image.png", await png(preview(1200, 630)));
await writeFile("docs/social-preview.png", await png(preview(1280, 640)));

/**
 * The landing page's pictures: screenshot → its name there, the width it's saved at, and optionally the
 * part kept (the Wheel and the Network without the person panel, so their names are bigger).
 */
const CANVAS = { left: 0, top: 100, width: 1280, height: 900 }; // from the view switcher down, left of the panel
const LANDING: [string, string, number, typeof CANVAS?][] = [
  ["chat.png", "chat.webp", 1600], // up to 900 px wide on the page
  ["phone-tree.png", "phone-tree.webp", 585], // phones: up to 260 px
  ["phone-panel.png", "phone-panel.webp", 585],
  ["phone-everyone-upcoming.png", "phone-upcoming.webp", 585],
  ["everyone-wheel.png", "wheel.webp", 1280, CANVAS], // beside their text: up to 690 px
  ["everyone-network-chosen.png", "network.webp", 1280, CANVAS],
  ["dashboard-upcoming.png", "dashboard-upcoming.webp", 768], // as big as it is
];
await mkdir("src/components/landing/images", { recursive: true });
for (const [screenshot, name, width, part] of LANDING) {
  const image = sharp(`docs/screenshots/${screenshot}`);
  if (part) image.extract(part);
  await image.resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 6 }).toFile(`src/components/landing/images/${name}`);
}
console.log("Wrote favicon.ico, apple-icon.png and opengraph-image.png in src/app, docs/social-preview.png and the landing page's pictures");
