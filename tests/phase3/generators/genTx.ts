/**
 * Phase 3: Transaction Generator
 *
 * File: tests/phase3/generators/genTx.ts
 *
 * Generates randomized and malformed transactions for fuzzing.
 * Tests transaction building, signing, and broadcast resilience.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface GeneratedTx {
  id: string;
  messages: TxMessage[];
  fee: TxFee;
  memo: string;
  timeoutHeight: string;
  accountNumber: string;
  sequence: string;
  chainId: string;
  signers: string[];
  signatures: TxSignature[];
  txBytes?: Uint8Array;
  _generator: string;
  _seed: number;
  _malformationType?: string;
}

export interface TxMessage {
  typeUrl: string;
  value: unknown;
}

export interface TxFee {
  amount: Array<{ denom: string; amount: string }>;
  gas: string;
  payer?: string;
  granter?: string;
}

export interface TxSignature {
  pubkey: string;
  signature: string;
  accountNumber: string;
  sequence: string;
}

// ============================================================================
// RANDOM UTILITIES
// ============================================================================

let seededRandom: (() => number) | null = null;

export function setSeed(seed: number): void {
  let s = seed;
  seededRandom = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function resetRandom(): void {
  seededRandom = null;
}

function rand(): number {
  return seededRandom ? seededRandom() : Math.random();
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randBech32(prefix = "cosmos"): string {
  const chars = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  let addr = prefix + "1";
  for (let i = 0; i < 38; i++) {
    addr += chars[Math.floor(rand() * chars.length)];
  }
  return addr;
}

function randHex(length: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(rand() * chars.length)];
  }
  return result;
}

function randBase64(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(rand() * chars.length)];
  }
  return result;
}

// ============================================================================
// TX GENERATORS
// ============================================================================

/**
 * Generate a valid transaction
 */
export function genTx(seed?: number): GeneratedTx {
  if (seed !== undefined) setSeed(seed);

  const numMessages = randInt(1, 3);
  const numSigners = randInt(1, 5);

  return {
    id: `tx_${randHex(16)}`,
    messages: Array.from({ length: numMessages }, () => ({
      typeUrl: randChoice([
        "/cosmos.bank.v1beta1.MsgSend",
        "/cosmos.staking.v1beta1.MsgDelegate",
        "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
      ]),
      value: {
        fromAddress: randBech32("cosmos"),
        toAddress: randBech32("cosmos"),
        amount: [{ denom: "ucore", amount: String(randInt(1, 1000000)) }],
      },
    })),
    fee: {
      amount: [{ denom: "ucore", amount: String(randInt(1000, 50000)) }],
      gas: String(randInt(100000, 500000)),
    },
    memo: `Generated tx ${randHex(4)}`,
    timeoutHeight: "0",
    accountNumber: String(randInt(1, 100000)),
    sequence: String(randInt(0, 1000)),
    chainId: randChoice(["cosmoshub-4", "coreum-mainnet-1", "coreum-testnet-1"]),
    signers: Array.from({ length: numSigners }, () => randBech32("cosmos")),
    signatures: Array.from({ length: numSigners }, () => ({
      pubkey: randBase64(44),
      signature: randBase64(88),
      accountNumber: String(randInt(1, 100000)),
      sequence: String(randInt(0, 1000)),
    })),
    txBytes: new Uint8Array(randInt(200, 2000)).map(() => randInt(0, 255)),
    _generator: "genTx",
    _seed: seed ?? -1,
  };
}

/**
 * Generate a malformed transaction for adversarial testing
 */
export function genMalformedTx(malformationType?: string, seed?: number): GeneratedTx {
  if (seed !== undefined) setSeed(seed);

  const baseTx = genTx(seed);
  const type =
    malformationType ??
    randChoice([
      "empty_messages",
      "invalid_addresses",
      "negative_amount",
      "overflow_amount",
      "empty_signature",
      "wrong_chain_id",
      "stale_sequence",
      "future_timeout",
      "corrupted_bytes",
      "missing_fee",
      "zero_gas",
      "invalid_denom",
    ]);

  switch (type) {
    case "empty_messages":
      return {
        ...baseTx,
        messages: [],
        _generator: "genMalformedTx",
        _malformationType: type,
      };

    case "invalid_addresses":
      return {
        ...baseTx,
        messages: [
          {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: {
              fromAddress: "invalid_address_!!!",
              toAddress: "also_invalid_@@@",
              amount: [{ denom: "ucore", amount: "1000" }],
            },
          },
        ],
        _generator: "genMalformedTx",
        _malformationType: type,
      };

    case "negative_amount":
      return {
        ...baseTx,
        messages: [
          {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: {
              fromAddress: randBech32("cosmos"),
              toAddress: randBech32("cosmos"),
              amount: [{ denom: "ucore", amount: "-1000" }],
            },
          },
        ],
        _generator: "genMalformedTx",
        _malformationType: type,
      };

    case "overflow_amount":
      return {
        ...baseTx,
        messages: [
          {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: {
              fromAddress: randBech32("cosmos"),
              toAddress: randBech32("cosmos"),
              amount: [{ denom: "ucore", amount: "999999999999999999999999999999999999999" }],
            },
          },
        ],
        _generator: "genMalformedTx",
        _malformationType: type,
      };

    case "empty_signature":
      return {
        ...baseTx,
        signatures: [{ pubkey: "", signature: "", accountNumber: "0", sequence: "0" }],
        _generator: "genMalformedTx",
        _malformationType: type,
      };

    case "wrong_chain_id":
      return {
        ...baseTx,
        chainId: "wrong-chain-id-12345",
        _generator: "genMalformedTx",
        _malformationType: type,
      };

    case "stale_sequence":
      return {
        ...baseTx,
        sequence: "0", // Always stale
        signatures: baseTx.signatures.map((s) => ({ ...s, sequence: "0" })),
        _generator: "genMalformedTx",
        _malformationType: type,
      };

    case "future_timeout":
      return {
        ...baseTx,
        timeoutHeight: "999999999999",
        _generator: "genMalformedTx",
        _malformationType: type,
      };

    case "corrupted_bytes":
      return {
        ...baseTx,
        txBytes: new Uint8Array([0, 0, 0, 255, 255, 255]), // Garbage bytes
        _generator: "genMalformedTx",
        _malformationType: type,
      };

    case "missing_fee":
      return {
        ...baseTx,
        fee: { amount: [], gas: "0" },
        _generator: "genMalformedTx",
        _malformationType: type,
      };

    case "zero_gas":
      return {
        ...baseTx,
        fee: { ...baseTx.fee, gas: "0" },
        _generator: "genMalformedTx",
        _malformationType: type,
      };

    case "invalid_denom":
      return {
        ...baseTx,
        fee: { ...baseTx.fee, amount: [{ denom: "💀", amount: "1000" }] },
        messages: [
          {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: {
              fromAddress: randBech32("cosmos"),
              toAddress: randBech32("cosmos"),
              amount: [{ denom: "💀invalid💀", amount: "1000" }],
            },
          },
        ],
        _generator: "genMalformedTx",
        _malformationType: type,
      };

    default:
      return { ...baseTx, _generator: "genMalformedTx", _malformationType: "unknown" };
  }
}

/**
 * Generate a replay attack transaction (duplicate of an existing tx)
 */
export function genReplayTx(originalTx: GeneratedTx): GeneratedTx {
  return {
    ...originalTx,
    id: `replay_${originalTx.id}`,
    _generator: "genReplayTx",
    _malformationType: "replay_attack",
  };
}

/**
 * Generate a stale signature transaction
 */
export function genStaleSigTx(seed?: number): GeneratedTx {
  if (seed !== undefined) setSeed(seed);

  const tx = genTx(seed);
  const staleSequence = String(randInt(0, 10)); // Old sequence number

  return {
    ...tx,
    sequence: String(parseInt(staleSequence) + 100), // Current sequence is higher
    signatures: tx.signatures.map((sig) => ({
      ...sig,
      sequence: staleSequence, // Signature has old sequence
    })),
    _generator: "genStaleSigTx",
    _malformationType: "stale_signature",
  };
}

// ============================================================================
// TX BYTES UTILITIES
// ============================================================================

/**
 * Generate deterministic tx bytes from a GeneratedTx
 */
export function txToBytes(tx: GeneratedTx): Uint8Array {
  const json = JSON.stringify({
    messages: tx.messages,
    fee: tx.fee,
    memo: tx.memo,
    signatures: tx.signatures,
    chainId: tx.chainId,
    accountNumber: tx.accountNumber,
    sequence: tx.sequence,
  });
  return new TextEncoder().encode(json);
}

/**
 * Compute a simple hash for tx bytes (for tracking)
 */
export function hashTxBytes(bytes: Uint8Array): string {
  let hash = 0;
  for (const byte of bytes) {
    hash = ((hash << 5) - hash + byte) | 0;
  }
  return `txhash_${hash.toString(16).padStart(8, "0")}`;
}

/**
 * Generate corrupted bytes from valid bytes
 */
export function corruptBytes(bytes: Uint8Array, corruptionRate = 0.1): Uint8Array {
  const corrupted = new Uint8Array(bytes);
  for (let i = 0; i < corrupted.length; i++) {
    if (Math.random() < corruptionRate) {
      corrupted[i] = Math.floor(Math.random() * 256);
    }
  }
  return corrupted;
}

/**
 * Generate a batch of transactions for comprehensive testing
 */
export function genTxBatch(count: number, seed?: number): GeneratedTx[] {
  const txs: GeneratedTx[] = [];
  const malformationTypes = [
    "empty_messages",
    "invalid_addresses",
    "negative_amount",
    "overflow_amount",
    "empty_signature",
    "wrong_chain_id",
    "stale_sequence",
    "corrupted_bytes",
    "missing_fee",
    "zero_gas",
    "invalid_denom",
  ];

  for (let i = 0; i < count; i++) {
    const itemSeed = seed !== undefined ? seed + i : undefined;

    if (i % 3 === 0) {
      // Valid tx
      txs.push(genTx(itemSeed));
    } else if (i % 3 === 1) {
      // Malformed tx
      const malType = malformationTypes[i % malformationTypes.length];
      txs.push(genMalformedTx(malType, itemSeed));
    } else {
      // Stale signature tx
      txs.push(genStaleSigTx(itemSeed));
    }
  }

  return txs;
}

