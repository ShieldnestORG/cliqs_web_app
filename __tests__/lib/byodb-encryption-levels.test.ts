/**
 * @jest-environment jsdom
 *
 * Security levels 1 and 2 were untestable until crypto.subtle was polyfilled in
 * jest.polyfills.js — which is a large part of why a level-2 defect shipped: the
 * unlock message was rebuilt from whatever chain was selected at unlock time
 * rather than the one recorded at save, so switching chains silently made the
 * credential unopenable forever.
 */
import {
  saveCredential,
  unlockCredential,
  getByodbStatus,
  clearByodb,
  lockCredential,
  getDecryptedUri,
} from "@/lib/byodb/storage";
import { detectLevel } from "@/lib/byodb/crypto";

const STORAGE_KEY = "byodb:credential";
const URI = "mongodb+srv://alice:hunter2@cluster0.example.mongodb.net/cliqs";

// Level 2 keys off raw signature bytes; the value only has to be stable.
const sigFor = (message: string) =>
  new Uint8Array(Array.from(message).map((c) => c.charCodeAt(0) % 256));

const signMessage = (chainDisplayName: string) =>
  `BYODB credential encryption key for ${chainDisplayName}`;

describe("BYODB security levels", () => {
  beforeEach(() => {
    localStorage.clear();
    clearByodb();
    localStorage.clear();
  });

  it("level 1 round-trips and rejects the wrong passphrase", async () => {
    await saveCredential(URI, 1, "correct horse battery");
    expect(detectLevel(localStorage.getItem(STORAGE_KEY) as string)).toBe(1);

    lockCredential();
    expect(getByodbStatus().needsUnlock).toBe(true);

    await expect(unlockCredential("wrong passphrase")).rejects.toThrow();
    await expect(unlockCredential("correct horse battery")).resolves.toBe(URI);
  });

  it("records the chain at save so level 2 can rebuild the same message later", async () => {
    const chain = { chainId: "cosmoshub-4", chainDisplayName: "Cosmos Hub" };
    await saveCredential(URI, 2, sigFor(signMessage(chain.chainDisplayName)), chain);

    const meta = getByodbStatus().meta;
    expect(meta?.chainId).toBe("cosmoshub-4");
    expect(meta?.chainDisplayName).toBe("Cosmos Hub");
  });

  it("level 2 still unlocks after the selected chain changes", async () => {
    const saveChain = { chainId: "cosmoshub-4", chainDisplayName: "Cosmos Hub" };
    await saveCredential(URI, 2, sigFor(signMessage(saveChain.chainDisplayName)), saveChain);
    lockCredential();

    // The user has since switched to another chain. The unlock must derive its
    // message from the chain stored in meta, NOT the one now selected.
    const nowSelected = { chainDisplayName: "Osmosis" };
    const meta = getByodbStatus().meta;
    const chainForMessage = meta?.chainDisplayName ?? nowSelected.chainDisplayName;
    expect(chainForMessage).toBe("Cosmos Hub");

    await expect(unlockCredential(sigFor(signMessage(chainForMessage)))).resolves.toBe(URI);

    // And prove the bug this guards: signing for the now-selected chain fails.
    lockCredential();
    await expect(
      unlockCredential(sigFor(signMessage(nowSelected.chainDisplayName))),
    ).rejects.toThrow();
  });

  it("upgrades level 0 to level 1 without needing the URI re-entered", async () => {
    await saveCredential(URI, 0);
    expect(getByodbStatus().needsUnlock).toBe(false);

    // Level 0 auto-unlocks, so the plaintext is already in memory for the upgrade.
    const inMemory = getDecryptedUri();
    expect(inMemory).toBe(URI);

    await saveCredential(inMemory as string, 1, "a new passphrase");

    expect(detectLevel(localStorage.getItem(STORAGE_KEY) as string)).toBe(1);
    expect(getByodbStatus().meta?.securityLevel).toBe(1);
    lockCredential();
    await expect(unlockCredential("a new passphrase")).resolves.toBe(URI);
  });

  it("keeps auto-unlocking pre-existing level 0 credentials", async () => {
    // Guards the read path for credentials written by older releases.
    await saveCredential(URI, 0);
    const encoded = localStorage.getItem(STORAGE_KEY) as string;
    expect(encoded.startsWith("byodb:v0:")).toBe(true);

    lockCredential();
    const status = getByodbStatus();
    expect(status.enabled).toBe(true);
    expect(status.needsUnlock).toBe(false);
    expect(getDecryptedUri()).toBe(URI);
  });
});
