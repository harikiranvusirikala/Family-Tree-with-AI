// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";
import { cloudinaryConfig, deletePhotos, signParams, uploadTicket, type CloudinaryConfig } from "./cloudinary";

const config: CloudinaryConfig = { cloudName: "demo", apiKey: "1234", apiSecret: "shh", apiUrl: "https://api.cloudinary.com" };
const groupId = "65f0c0ffee0000000000abcd";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Cloudinary signatures", () => {
  test("the worked example from Cloudinary's documentation", () => {
    const params = { eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: "1315060510" };
    expect(signParams(params, "abcd")).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });

  test("the order parameters are given in doesn't matter, and a & can't add a parameter", () => {
    expect(signParams({ b: "2", a: "1" }, "s")).toBe(signParams({ a: "1", b: "2" }, "s"));
    expect(signParams({ a: "1&b=2" }, "s")).not.toBe(signParams({ a: "1", b: "2" }, "s"));
  });

  test("photos are set up only when all three variables are", () => {
    const env = { CLOUDINARY_CLOUD_NAME: "demo", CLOUDINARY_API_KEY: "1234", CLOUDINARY_API_SECRET: "shh" };
    expect(cloudinaryConfig(env)).toEqual(config);
    expect(cloudinaryConfig({ ...env, CLOUDINARY_API_SECRET: "" })).toBeUndefined();
    expect(cloudinaryConfig({ ...env, CLOUDINARY_API_URL: "http://localhost:3101" })?.apiUrl).toBe("http://localhost:3101");
  });
});

describe("upload tickets", () => {
  test("a random id in the group's folder, tagged and limited, with every sent parameter signed", () => {
    const ticket = uploadTicket(config, groupId, "familytree_preview", Date.UTC(2026, 9, 18) + 999);
    expect(ticket.url).toBe("https://api.cloudinary.com/v1_1/demo/image/upload");
    expect(ticket.publicId).toMatch(new RegExp(`^groups/${groupId}/[\\w-]{22}$`));
    const { signature, api_key, ...signed } = ticket.fields;
    expect(signed).toEqual({
      public_id: ticket.publicId,
      timestamp: String(Date.UTC(2026, 9, 18) / 1000),
      tags: "familytree_preview",
      allowed_formats: "jpg,png,webp,heic",
      transformation: "c_limit,w_1600,h_1600",
    });
    expect(api_key).toBe("1234");
    expect(signature).toBe(signParams(signed, "shh"));
  });

  test("every ticket gets its own id", () => {
    expect(uploadTicket(config, groupId, "t").publicId).not.toBe(uploadTicket(config, groupId, "t").publicId);
  });
});

describe("deleting photos", () => {
  test("one signed destroy request per photo, also clearing the CDN", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ result: "ok" }));
    await deletePhotos([`groups/${groupId}/a1`, `groups/${groupId}/b2`], config, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cloudinary.com/v1_1/demo/image/destroy");
    const { signature, api_key, ...signed } = Object.fromEntries(init.body as URLSearchParams);
    expect(signed).toMatchObject({ public_id: `groups/${groupId}/a1`, invalidate: "true" });
    expect(api_key).toBe("1234");
    expect(signature).toBe(signParams(signed, "shh"));
  });

  test("a failure is logged, not thrown: the change is already saved", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await deletePhotos(["groups/x/1"], config, vi.fn(async () => Response.json({ error: { message: "Invalid Signature" } }, { status: 401 })));
    await deletePhotos(["groups/x/2"], config, vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect(logged).toHaveBeenCalledTimes(2);
    // Already gone counts as deleted.
    await deletePhotos(["groups/x/3"], config, vi.fn(async () => Response.json({ result: "not found" })));
    expect(logged).toHaveBeenCalledTimes(2);
  });

  test("without Cloudinary settings, nothing is sent", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn();
    await deletePhotos(["groups/x/1"], undefined, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
