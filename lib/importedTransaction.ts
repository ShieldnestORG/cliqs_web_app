import { DbSignatureObjDraft, DbTransactionParsedDataJson } from "@/graphql";
import { pubkeyToAddress } from "@cosmjs/amino";
import { wasmTypes } from "@cosmjs/cosmwasm-stargate";
import { Registry, TxBodyEncodeObject } from "@cosmjs/proto-signing";
import { defaultRegistryTypes } from "@cosmjs/stargate";
import { toBase64 } from "@cosmjs/encoding";
import { msgsFromJson } from "./txMsgHelpers";
import { parseDbTransactionJson } from "./transactionJson";

export type ImportedSignatureSeed = Omit<DbSignatureObjDraft, "transaction">;

export type TransactionImportMetadata = {
  readonly chainId?: string;
  readonly accountNumber?: string | number;
  readonly sequence?: string | number;
  readonly addressPrefix?: string;
};

type TransactionImportResult =
  | {
      readonly source: "canonical" | "raw";
      readonly tx: DbTransactionParsedDataJson;
      readonly importedSignatures: readonly ImportedSignatureSeed[];
      readonly error?: never;
    }
  | {
      readonly source?: never;
      readonly tx?: never;
      readonly importedSignatures?: never;
      readonly error: string;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseMetadataNumber = (
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

const snakeToCamel = (key: string): string =>
  key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

const normalizeRawValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeRawValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (key === "@type") {
        return ["type", entryValue];
      }

      return [snakeToCamel(key), normalizeRawValue(entryValue)];
    }),
  );
};

const parseExplicitImportedSignatures = (
  value: unknown,
): { signatures: readonly ImportedSignatureSeed[]; error?: never } | { signatures?: never; error: string } => {
  if (value === undefined) {
    return { signatures: [] };
  }

  if (!Array.isArray(value)) {
    return { error: 'Field "importedSignatures" must be an array when provided.' };
  }

  const signatures: ImportedSignatureSeed[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (!isRecord(item)) {
      return { error: `importedSignatures[${i}] must be an object.` };
    }

    if (typeof item.address !== "string" || !item.address) {
      return { error: `importedSignatures[${i}].address must be a non-empty string.` };
    }
    if (typeof item.signature !== "string" || !item.signature) {
      return { error: `importedSignatures[${i}].signature must be a non-empty string.` };
    }
    if (typeof item.bodyBytes !== "string" || !item.bodyBytes) {
      return { error: `importedSignatures[${i}].bodyBytes must be a non-empty string.` };
    }

    signatures.push({
      address: item.address,
      signature: item.signature,
      bodyBytes: item.bodyBytes,
    });
  }

  return { signatures };
};

const buildBodyBytes = (tx: DbTransactionParsedDataJson): Uint8Array => {
  const registry = new Registry([...defaultRegistryTypes, ...wasmTypes]);
  const txBodyEncodeObject: TxBodyEncodeObject = {
    typeUrl: "/cosmos.tx.v1beta1.TxBody",
    value: {
      messages: msgsFromJson(tx.msgs),
      memo: tx.memo,
    },
  };

  return registry.encode(txBodyEncodeObject);
};

const signerInfoToAddress = (
  signerInfo: unknown,
  addressPrefix: string,
): string | null => {
  if (!isRecord(signerInfo)) return null;

  const publicKeyCandidate = isRecord(signerInfo.public_key)
    ? signerInfo.public_key
    : isRecord(signerInfo.publicKey)
      ? signerInfo.publicKey
      : null;

  if (!publicKeyCandidate) return null;

  const typeUrl =
    typeof publicKeyCandidate["@type"] === "string"
      ? publicKeyCandidate["@type"]
      : typeof publicKeyCandidate.typeUrl === "string"
        ? publicKeyCandidate.typeUrl
        : typeof publicKeyCandidate.type === "string"
          ? publicKeyCandidate.type
          : null;
  const value =
    typeof publicKeyCandidate.key === "string"
      ? publicKeyCandidate.key
      : typeof publicKeyCandidate.value === "string"
        ? publicKeyCandidate.value
        : null;

  if (!typeUrl || !value) return null;

  const aminoType = typeUrl.includes("secp256k1")
    ? "tendermint/PubKeySecp256k1"
    : typeUrl.includes("ed25519")
      ? "tendermint/PubKeyEd25519"
      : null;

  if (!aminoType) return null;

  return pubkeyToAddress({ type: aminoType, value }, addressPrefix);
};

const extractRawImportedSignatures = (
  parsed: Record<string, unknown>,
  tx: DbTransactionParsedDataJson,
  addressPrefix?: string,
): { signatures: readonly ImportedSignatureSeed[]; error?: never } | { signatures?: never; error: string } => {
  const rawSignatures = parsed.signatures;
  if (rawSignatures === undefined) {
    return { signatures: [] };
  }

  if (!Array.isArray(rawSignatures)) {
    return { error: 'Field "signatures" must be an array when provided.' };
  }

  if (rawSignatures.length === 0) {
    return { signatures: [] };
  }

  if (!addressPrefix) {
    return {
      error:
        'Imported raw signatures require an address prefix to derive signer addresses. Provide explicit "importedSignatures" instead.',
    };
  }

  const authInfo = isRecord(parsed.auth_info) ? parsed.auth_info : null;
  const signerInfos = authInfo?.signer_infos;
  if (!Array.isArray(signerInfos) || signerInfos.length !== rawSignatures.length) {
    return {
      error:
        'Imported raw signatures could not be matched to signer infos. Provide explicit "importedSignatures" with address, signature, and bodyBytes.',
    };
  }

  const bodyBytes = toBase64(buildBodyBytes(tx));
  const signatures: ImportedSignatureSeed[] = [];
  for (let i = 0; i < rawSignatures.length; i++) {
    const signature = rawSignatures[i];
    if (typeof signature !== "string" || !signature) {
      return { error: `signatures[${i}] must be a non-empty string.` };
    }

    const address = signerInfoToAddress(signerInfos[i], addressPrefix);
    if (!address) {
      return {
        error:
          "Imported raw signatures could not be mapped to signer addresses. Provide explicit \"importedSignatures\" instead.",
      };
    }

    signatures.push({ address, signature, bodyBytes });
  }

  return { signatures };
};

const isCanonicalShape = (parsed: Record<string, unknown>): boolean =>
  "msgs" in parsed && "fee" in parsed && "memo" in parsed;

const isRawEnvelopeShape = (parsed: Record<string, unknown>): boolean =>
  "body" in parsed && "auth_info" in parsed;

const parseRawEnvelope = (
  parsed: Record<string, unknown>,
  metadata: TransactionImportMetadata,
  options: { expectedChainId?: string; requireNonEmptyMsgs?: boolean },
): TransactionImportResult => {
  const body = isRecord(parsed.body) ? parsed.body : null;
  if (!body) {
    return { error: 'Field "body" must be an object.' };
  }

  const authInfo = isRecord(parsed.auth_info) ? parsed.auth_info : null;
  if (!authInfo) {
    return { error: 'Field "auth_info" must be an object.' };
  }

  const fee = isRecord(authInfo.fee) ? authInfo.fee : null;
  if (!fee) {
    return { error: 'Field "auth_info.fee" must be an object.' };
  }

  const timeoutHeight = body.timeout_height;
  if (
    timeoutHeight !== undefined &&
    timeoutHeight !== null &&
    timeoutHeight !== "" &&
    timeoutHeight !== "0" &&
    timeoutHeight !== 0
  ) {
    return {
      error:
        'Only raw transactions with timeout_height "0" are currently supported for import.',
    };
  }

  if (!Array.isArray(body.messages)) {
    return { error: 'Field "body.messages" must be an array.' };
  }

  const accountNumber = parseMetadataNumber(metadata.accountNumber, "accountNumber");
  if (typeof accountNumber === "string") {
    return { error: accountNumber };
  }

  const signerInfos = Array.isArray(authInfo.signer_infos) ? authInfo.signer_infos : [];
  const signerSequence =
    metadata.sequence ??
    (isRecord(signerInfos[0]) ? signerInfos[0].sequence ?? signerInfos[0].signer_sequence : undefined);
  const sequence = parseMetadataNumber(signerSequence, "sequence");
  if (typeof sequence === "string") {
    return { error: sequence };
  }

  const chainId = metadata.chainId ?? options.expectedChainId;
  if (typeof chainId !== "string" || !chainId) {
    return {
      error: 'Missing import metadata "chainId". Raw transaction imports require the active chain.',
    };
  }

  const canonicalCandidate = {
    chainId,
    accountNumber,
    sequence,
    msgs: body.messages.map((message, index) => {
      if (!isRecord(message) || typeof message["@type"] !== "string") {
        throw new Error(`body.messages[${index}] is missing "@type".`);
      }

      const normalizedValue = normalizeRawValue(message) as Record<string, unknown>;
      delete normalizedValue.type;

      return {
        typeUrl: message["@type"],
        value: normalizedValue,
      };
    }),
    fee: {
      amount: fee.amount,
      gas: fee.gas_limit,
    },
    memo: typeof body.memo === "string" ? body.memo : "",
  };

  const parsedCanonical = parseDbTransactionJson(canonicalCandidate, {
    expectedChainId: options.expectedChainId,
    requireNonEmptyMsgs: options.requireNonEmptyMsgs,
  });
  if (parsedCanonical.error || !parsedCanonical.tx) {
    return { error: parsedCanonical.error ?? "Failed to normalize raw transaction import." };
  }

  const explicitImportedSignatures = parseExplicitImportedSignatures(parsed.importedSignatures);
  if (explicitImportedSignatures.error) {
    return { error: explicitImportedSignatures.error };
  }
  const explicitSeeds = explicitImportedSignatures.signatures ?? [];

  if (explicitSeeds.length > 0) {
    return {
      source: "raw",
      tx: parsedCanonical.tx,
      importedSignatures: explicitSeeds,
    };
  }

  const extractedSignatures = extractRawImportedSignatures(
    parsed,
    parsedCanonical.tx,
    metadata.addressPrefix,
  );
  if (extractedSignatures.error) {
    return { error: extractedSignatures.error };
  }

  return {
    source: "raw",
    tx: parsedCanonical.tx,
    importedSignatures: extractedSignatures.signatures ?? [],
  };
};

export const parseImportedTransactionInput = (
  raw: string | unknown,
  metadata: TransactionImportMetadata,
  options: { expectedChainId?: string; requireNonEmptyMsgs?: boolean } = {},
): TransactionImportResult => {
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

  if (isCanonicalShape(parsed)) {
    const parsedCanonical = parseDbTransactionJson(parsed, options);
    if (parsedCanonical.error || !parsedCanonical.tx) {
      return { error: parsedCanonical.error ?? "Failed to normalize transaction JSON." };
    }

    const explicitImportedSignatures = parseExplicitImportedSignatures(parsed.importedSignatures);
    if (explicitImportedSignatures.error) {
      return { error: explicitImportedSignatures.error };
    }
    const explicitSeeds = explicitImportedSignatures.signatures ?? [];

    return {
      source: "canonical",
      tx: parsedCanonical.tx,
      importedSignatures: explicitSeeds,
    };
  }

  if (isRawEnvelopeShape(parsed)) {
    return parseRawEnvelope(parsed, metadata, options);
  }

  return {
    error:
      'Unsupported transaction format. Paste either the app transaction shape or a raw Cosmos tx object with "body" and "auth_info".',
  };
};
