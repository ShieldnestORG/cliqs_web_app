import { DbTransactionParsedDataJson } from "@/graphql";

type ParsedTxResult =
  | { tx: DbTransactionParsedDataJson; error?: never }
  | { tx?: never; error: string };

type ParseOptions = {
  readonly expectedChainId?: string;
  readonly requireNonEmptyMsgs?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseNumberField = (
  value: unknown,
  fieldName: "accountNumber" | "sequence",
): number | string => {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      return `Field "${fieldName}" must be a non-negative safe integer.`;
    }

    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      return `Field "${fieldName}" must be a non-negative safe integer.`;
    }

    return parsed;
  }

  return `Missing or invalid field "${fieldName}" (must be a number or numeric string).`;
};

export const parseDbTransactionJson = (
  raw: string | unknown,
  options: ParseOptions = {},
): ParsedTxResult => {
  let parsed: unknown;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: "Invalid JSON - could not parse the input." };
    }
  } else {
    parsed = raw;
  }

  if (!isRecord(parsed)) {
    return { error: "Expected a JSON object at the top level." };
  }

  const accountNumber = parseNumberField(parsed.accountNumber, "accountNumber");
  if (typeof accountNumber === "string") {
    return { error: accountNumber };
  }

  const sequence = parseNumberField(parsed.sequence, "sequence");
  if (typeof sequence === "string") {
    return { error: sequence };
  }

  if (typeof parsed.chainId !== "string" || !parsed.chainId) {
    return { error: 'Missing or invalid field "chainId" (must be a non-empty string).' };
  }

  if (options.expectedChainId && parsed.chainId !== options.expectedChainId) {
    return {
      error: `Chain ID mismatch: transaction is for "${parsed.chainId}" but the active chain is "${options.expectedChainId}". Switch chains or import the correct transaction.`,
    };
  }

  if (!Array.isArray(parsed.msgs)) {
    return { error: 'Missing or invalid field "msgs" (must be an array).' };
  }

  if (options.requireNonEmptyMsgs && parsed.msgs.length === 0) {
    return { error: 'Missing or invalid field "msgs" (must be a non-empty array).' };
  }

  for (let i = 0; i < parsed.msgs.length; i++) {
    const msg = parsed.msgs[i];
    if (!isRecord(msg)) {
      return { error: `msg[${i}] must be an object.` };
    }
    if (typeof msg.typeUrl !== "string" || !msg.typeUrl) {
      return { error: `msg[${i}] is missing "typeUrl".` };
    }
    if (msg.value === undefined || msg.value === null) {
      return { error: `msg[${i}] is missing "value".` };
    }
  }

  if (!isRecord(parsed.fee)) {
    return { error: 'Missing or invalid field "fee" (must be an object).' };
  }

  if (typeof parsed.fee.gas !== "string") {
    return { error: 'Field "fee.gas" must be a string.' };
  }

  if (!Array.isArray(parsed.fee.amount)) {
    return { error: 'Field "fee.amount" must be an array.' };
  }

  for (let i = 0; i < parsed.fee.amount.length; i++) {
    const coin = parsed.fee.amount[i];
    if (!isRecord(coin)) {
      return { error: `fee.amount[${i}] must be an object.` };
    }
    if (typeof coin.denom !== "string" || !coin.denom) {
      return { error: `fee.amount[${i}].denom must be a non-empty string.` };
    }
    if (typeof coin.amount !== "string") {
      return { error: `fee.amount[${i}].amount must be a string.` };
    }
  }

  if (typeof parsed.memo !== "string") {
    return { error: 'Missing or invalid field "memo" (must be a string).' };
  }

  return {
    tx: {
      accountNumber,
      sequence,
      chainId: parsed.chainId,
      msgs: parsed.msgs as DbTransactionParsedDataJson["msgs"],
      fee: {
        amount: parsed.fee.amount as DbTransactionParsedDataJson["fee"]["amount"],
        gas: parsed.fee.gas,
      },
      memo: parsed.memo,
    },
  };
};

export const normalizeDbTransactionJson = (
  raw: string | unknown,
  options: ParseOptions = {},
): DbTransactionParsedDataJson => {
  const result = parseDbTransactionJson(raw, options);
  if (result.error || !result.tx) {
    throw new Error(result.error ?? "Failed to normalize transaction JSON.");
  }

  return result.tx;
};
