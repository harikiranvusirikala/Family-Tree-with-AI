// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import type { UploadTicket } from "@/server/cloudinary";
import { MAX_PHOTO_BYTES, photoFileProblem, uploadPhoto } from "./upload-photo";

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
    ["exactly 10 MB", { name: "big.png", type: "image/png", size: MAX_PHOTO_BYTES }, null],
    ["over 10 MB", { name: "huge.png", type: "image/png", size: MAX_PHOTO_BYTES + 1 }, "That photo is over 10 MB. Choose a smaller one."],
    ["a PDF", { name: "notes.pdf", type: "application/pdf", size: 1000 }, "Choose a JPEG, PNG, WebP or HEIC photo."],
    ["a GIF", { name: "fun.gif", type: "image/gif", size: 1000 }, "Choose a JPEG, PNG, WebP or HEIC photo."],
  ])("%s", (_label, file, problem) => {
    expect(photoFileProblem(file)).toBe(problem);
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
