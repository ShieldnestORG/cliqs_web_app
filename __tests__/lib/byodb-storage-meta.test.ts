/**
 * @jest-environment jsdom
 *
 * The BYODB metadata blob sits in localStorage unencrypted, next to the
 * encrypted credential. Anything in it that is derived from the connection
 * string becomes an offline oracle: an attacker who can read localStorage can
 * verify password guesses directly, at one cheap hash per guess, instead of
 * attacking AES-GCM through PBKDF2 at 600k iterations.
 *
 * A `fingerprint` field (unsalted truncated SHA-256 of the whole URI) used to be
 * written here at every security level and read by nothing. These tests exist so
 * it cannot come back, and so browsers that already stored one get it removed.
 */
import { saveCredential, getByodbStatus, clearByodb } from "@/lib/byodb/storage";

const META_KEY = "byodb:meta";
const STORAGE_KEY = "byodb:credential";
const URI = "mongodb+srv://alice:hunter2@cluster0.example.mongodb.net/cliqs";

describe("BYODB credential metadata", () => {
  beforeEach(() => {
    localStorage.clear();
    clearByodb();
    localStorage.clear();
  });

  it("stores nothing derived from the credential alongside it", async () => {
    await saveCredential(URI, 0);

    const meta = JSON.parse(localStorage.getItem(META_KEY) as string);
    expect(meta).not.toHaveProperty("fingerprint");

    // Belt and braces: no value in the blob may be a hash of the URI or contain
    // the password, whatever the field is called.
    const serialised = JSON.stringify(meta);
    expect(serialised).not.toContain("hunter2");

    // The mask is allowed to reveal non-secret fields, but not the password.
    expect(meta.maskedUri).toContain("cluster0.example.mongodb.net");
    expect(meta.maskedUri).not.toContain("hunter2");
  });

  it("strips a legacy fingerprint left by an earlier version and rewrites storage", async () => {
    await saveCredential(URI, 0);

    // Simulate a browser that saved a credential before the field was removed.
    const stored = JSON.parse(localStorage.getItem(META_KEY) as string);
    localStorage.setItem(META_KEY, JSON.stringify({ ...stored, fingerprint: "deadbeefdeadbeef" }));
    expect(localStorage.getItem(META_KEY)).toContain("fingerprint");

    const status = getByodbStatus();

    // Removed from what callers see...
    expect(status.meta).not.toHaveProperty("fingerprint");
    // ...and from disk, or the oracle would still be sitting there.
    expect(localStorage.getItem(META_KEY)).not.toContain("fingerprint");
  });

  it("keeps the credential usable while stripping the legacy field", async () => {
    await saveCredential(URI, 0);
    const stored = JSON.parse(localStorage.getItem(META_KEY) as string);
    localStorage.setItem(META_KEY, JSON.stringify({ ...stored, fingerprint: "deadbeefdeadbeef" }));

    const status = getByodbStatus();

    expect(status.enabled).toBe(true);
    expect(status.meta?.securityLevel).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });
});
