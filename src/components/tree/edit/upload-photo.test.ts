// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import type { UploadTicket } from "@/server/cloudinary";
import { STORED_PIXELS } from "@/server/cloudinary";
import { MAX_CHOSEN_BYTES, MAX_PHOTO_BYTES, photoFileProblem, SHRINK_TO, shrinkPhoto, shrunkSize, uploadPhoto, uploadSizeProblem, type ImageTools } from "./upload-photo";

const ticket: UploadTicket = {
  url: "https://api.cloudinary.com/v1_1/demo/image/upload",
  fields: { public_id: "groups/g/abc", timestamp: "1", api_key: "1234", signature: "sig" },
  publicId: "groups/g/abc",
};
const photo = new Blob(["png bytes"], { type: "image/png" });

describe("choosing a photo", () => {
  test.each([
    ["a JPEG", { name: "me.jpg", type: "image/jpeg", size: 2_000_000 }, null],
    ["a HEIC from an iPhone", { name: "IMG_0001.HEIC", type: "image/heic", size: 3_000_000 }, null],
    ["a HEIC the browser gives no type", { name: "IMG_0001.HEIC", type: "", size: 3_000_000 }, null],
    ["a 25 MB camera original (shrunk before uploading)", { name: "DSC_0001.JPG", type: "image/jpeg", size: 25 * 1024 * 1024 }, null],
    ["exactly 50 MB", { name: "big.png", type: "image/png", size: MAX_CHOSEN_BYTES }, null],
    ["over 50 MB", { name: "huge.png", type: "image/png", size: MAX_CHOSEN_BYTES + 1 }, "That photo is over 50 MB. Choose a smaller one."],
    ["a PDF", { name: "notes.pdf", type: "application/pdf", size: 1000 }, "Choose a JPEG, PNG, WebP or HEIC photo."],
    ["a GIF", { name: "fun.gif", type: "image/gif", size: 1000 }, "Choose a JPEG, PNG, WebP or HEIC photo."],
  ])("%s", (_label, file, problem) => {
    expect(photoFileProblem(file)).toBe(problem);
  });
});

test("what's uploaded must be 10 MB at most (a HEIC outside Safari isn't shrunk)", () => {
  expect(uploadSizeProblem({ size: MAX_PHOTO_BYTES })).toBeNull();
  expect(uploadSizeProblem({ size: MAX_PHOTO_BYTES + 1 })).toBe("That photo is over 10 MB. Choose a smaller one.");
});

describe("shrinking a large photo before uploading (an owner request)", () => {
  test("to what Cloudinary keeps, the long side 2400 px, keeping its shape", () => {
    expect(SHRINK_TO).toBe(STORED_PIXELS);
    expect(shrunkSize(6000, 4000)).toEqual({ width: 2400, height: 1600 });
    expect(shrunkSize(3000, 4000)).toEqual({ width: 1800, height: 2400 });
    expect(shrunkSize(2400, 1000)).toBeNull(); // small enough already
    expect(shrunkSize(800, 600)).toBeNull();
  });

  const tools = (width: number, height: number, out: Blob | null = new Blob(["small"], { type: "image/jpeg" })) => {
    const close = vi.fn();
    const encode = vi.fn<ImageTools["encode"]>(async () => out);
    return { close, encode, tools: { decode: async () => ({ width, height, close }), encode } satisfies ImageTools };
  };
  const big = new Blob([new Uint8Array(5000)], { type: "image/jpeg" });

  test("a large photo is drawn smaller as a JPEG, and the decoded image is let go", async () => {
    const t = tools(6000, 4000);
    expect(await shrinkPhoto(big, t.tools)).toBe(await t.encode.mock.results[0]?.value);
    expect(t.encode).toHaveBeenCalledWith(expect.anything(), 2400, 1600);
    expect(t.close).toHaveBeenCalled();
  });

  test("a small photo, an unreadable one (HEIC outside Safari), or one that comes out bigger is uploaded as it is", async () => {
    const small = tools(1200, 900);
    expect(await shrinkPhoto(big, small.tools)).toBe(big);
    expect(small.encode).not.toHaveBeenCalled();
    expect(await shrinkPhoto(big, { decode: () => Promise.reject(new Error("can't read HEIC")), encode: vi.fn() })).toBe(big);
    const bigger = tools(6000, 4000, new Blob([new Uint8Array(9000)]));
    expect(await shrinkPhoto(big, bigger.tools)).toBe(big);
    expect(await shrinkPhoto(big, tools(6000, 4000, null).tools)).toBe(big); // the canvas failed
  });
});

describe("uploading to Cloudinary", () => {
  test("posts the file with the signed fields, and gives the photo's id", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ public_id: "groups/g/abc" }));
    expect(await uploadPhoto(ticket, photo, fetchImpl)).toEqual({ photoId: "groups/g/abc" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ticket.url);
    const body = init.body as FormData;
    expect(body.get("signature")).toBe("sig");
    expect(body.get("public_id")).toBe("groups/g/abc");
    expect(body.get("file")).toBeInstanceOf(Blob);
  });

  test("Cloudinary's reason is shown; anything else gets a general message", async () => {
    const answer = (body: unknown, status = 200) => vi.fn(async () => Response.json(body, { status }));
    expect(await uploadPhoto(ticket, photo, answer({ error: { message: "Invalid image file" } }, 400))).toEqual({
      error: "The photo couldn't be uploaded: Invalid image file.",
    });
    const general = { error: "The photo couldn't be uploaded. Try again, or choose another photo." };
    expect(await uploadPhoto(ticket, photo, answer({ public_id: "groups/g/other" }))).toEqual(general); // not the id it was given
    expect(await uploadPhoto(ticket, photo, vi.fn(async () => Promise.reject(new TypeError("offline"))))).toEqual(general);
  });
});
