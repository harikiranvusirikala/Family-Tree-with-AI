// A stand-in for Cloudinary's upload API during e2e runs (playwright.config.ts starts it), so no test
// reaches Cloudinary. Like Cloudinary, it refuses requests whose signature doesn't match, and it
// remembers what was uploaded (with each photo's size in pixels) and deleted: GET /calls.
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { Readable } from "node:stream";

const port = Number(process.env.PORT);
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const calls = { uploaded: [] as string[], sizes: {} as Record<string, { width: number; height: number } | null>, deleted: [] as string[] };

/** A PNG's or JPEG's size in pixels (the header, or a JPEG's frame marker), or null. */
function imageSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.subarray(1, 4).toString() === "PNG") return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  for (let at = 2; at + 9 < bytes.length; ) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    // SOF0–SOF15, apart from DHT (C4), JPG (C8) and DAC (CC), hold the frame's size.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  return null;
}

/** Cloudinary's check, written separately from the app's signParams so a mistake there shows up here. */
function signedCorrectly({ signature, api_key, ...params }: Record<string, string>) {
  const text = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const fresh = Math.abs(Date.now() / 1000 - Number(params.timestamp)) < 3600;
  return api_key === apiKey && fresh && signature === createHash("sha1").update(text + apiSecret).digest("hex");
}

createServer(async (request, response) => {
  const send = (status: number, body: unknown) => {
    // The browser uploads from the app's origin.
    response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
    response.end(JSON.stringify(body));
  };
  const path = new URL(request.url ?? "/", "http://stub").pathname;
  if (request.method === "GET" && path === "/") return send(200, { ok: true }); // Playwright's readiness check
  if (request.method === "GET" && path === "/calls") return send(200, calls);
  const action = /^\/v1_1\/[^/]+\/image\/(upload|destroy)$/.exec(path)?.[1];
  if (request.method !== "POST" || !action) return send(404, { error: { message: "Not found" } });

  const form = await new Response(Readable.toWeb(request) as ReadableStream, {
    headers: { "content-type": request.headers["content-type"] ?? "" },
  }).formData();
  const fields: Record<string, string> = {};
  for (const [key, value] of form) if (typeof value === "string") fields[key] = value;
  if (!signedCorrectly(fields)) return send(401, { error: { message: "Invalid Signature" } });

  if (action === "upload") {
    const file = form.get("file");
    if (!(file instanceof Blob)) return send(400, { error: { message: "Missing required parameter - file" } });
    calls.uploaded.push(fields.public_id);
    calls.sizes[fields.public_id] = imageSize(Buffer.from(await file.arrayBuffer()));
    return send(200, { public_id: fields.public_id, resource_type: "image", format: "png" });
  }
  calls.deleted.push(fields.public_id);
  send(200, { result: "ok" });
}).listen(port);
