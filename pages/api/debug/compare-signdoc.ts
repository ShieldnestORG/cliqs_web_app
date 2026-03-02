/**
 * Debug API: Compare SignDoc between CLI and App
 *
 * This endpoint helps diagnose signature verification failures by comparing
 * what the app generates vs what the CLI generates.
 *
 * POST /api/debug/compare-signdoc
 * Body: {
 *   cliTxJson: string,  // Raw JSON from: cored tx ... --generate-only -o json
 *   appTx: {            // Transaction data from our app
 *     accountNumber: number,
 *     sequence: number,
 *     chainId: string,
 *     msgs: EncodeObject[],
 *     fee: StdFee,
 *     memo: string
 *   }
 * }
 */

import { NextApiRequest, NextApiResponse } from "next";
import { makeSignDoc, serializeSignDoc, AminoMsg } from "@cosmjs/amino";
import { sha256 } from "@cosmjs/crypto";
import { toBase64, toHex } from "@cosmjs/encoding";
import { AminoTypes } from "@cosmjs/stargate";
import { EncodeObject } from "@cosmjs/proto-signing";
import { aminoConverters } from "@/lib/msg";

interface CompareRequest {
  cliTxJson: string;
  appTx: {
    accountNumber: number;
    sequence: number;
    chainId: string;
    msgs: EncodeObject[];
    fee: {
      amount: Array<{ denom: string; amount: string }>;
      gas: string;
    };
    memo: string;
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CLITransaction {
  body: {
    messages: Array<{ "@type": string; [key: string]: any }>;
    memo: string;
    timeout_height: string;
    extension_options: any[];
    non_critical_extension_options: any[];
  };
  auth_info: {
    signer_infos: any[];
    fee: {
      amount: Array<{ denom: string; amount: string }>;
      gas_limit: string;
      payer: string;
      granter: string;
    };
  };
  signatures: string[];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { cliTxJson, appTx } = req.body as CompareRequest;

    // Parse CLI transaction
    const cliTx: CLITransaction = JSON.parse(cliTxJson);

    // Initialize amino types using shared converters
    const aminoTypes = new AminoTypes(aminoConverters);

    // Generate SignDoc from app transaction
    const appAminoMsgs: AminoMsg[] = appTx.msgs.map((msg) => aminoTypes.toAmino(msg));

    const appSignDoc = makeSignDoc(
      appAminoMsgs,
      { amount: appTx.fee.amount, gas: appTx.fee.gas },
      appTx.chainId,
      appTx.memo,
      String(appTx.accountNumber),
      String(appTx.sequence),
    );

    const appSignDocBytes = serializeSignDoc(appSignDoc);
    const appSignDocHash = sha256(appSignDocBytes);

    // Compare structures
    const comparison = {
      app: {
        signDocJson: JSON.parse(new TextDecoder().decode(appSignDocBytes)),
        signDocHashBase64: toBase64(appSignDocHash),
        signDocHashHex: toHex(appSignDocHash),
        aminoMsgs: appAminoMsgs,
      },
      cli: {
        messages: cliTx.body.messages,
        fee: cliTx.auth_info.fee,
        memo: cliTx.body.memo,
      },
      differences: [] as string[],
    };

    // Check message count
    if (cliTx.body.messages.length !== appTx.msgs.length) {
      comparison.differences.push(
        `Message count: CLI=${cliTx.body.messages.length} vs App=${appTx.msgs.length}`,
      );
    }

    // Check message types
    for (let i = 0; i < Math.max(cliTx.body.messages.length, appTx.msgs.length); i++) {
      const cliMsg = cliTx.body.messages[i];
      const appMsg = appTx.msgs[i];

      if (cliMsg && appMsg) {
        if (cliMsg["@type"] !== appMsg.typeUrl) {
          comparison.differences.push(
            `Message[${i}] typeUrl: CLI="${cliMsg["@type"]}" vs App="${appMsg.typeUrl}"`,
          );
        }
      }
    }

    // Check fee
    if (cliTx.auth_info.fee.gas_limit !== appTx.fee.gas) {
      comparison.differences.push(
        `Gas: CLI="${cliTx.auth_info.fee.gas_limit}" vs App="${appTx.fee.gas}"`,
      );
    }

    const cliFeeStr = JSON.stringify(cliTx.auth_info.fee.amount);
    const appFeeStr = JSON.stringify(appTx.fee.amount);
    if (cliFeeStr !== appFeeStr) {
      comparison.differences.push(`Fee amount: CLI=${cliFeeStr} vs App=${appFeeStr}`);
    }

    // Check memo
    if ((cliTx.body.memo || "") !== (appTx.memo || "")) {
      comparison.differences.push(`Memo: CLI="${cliTx.body.memo}" vs App="${appTx.memo}"`);
    }

    // Check Amino message type strings
    comparison.differences.push("--- Amino Message Type Comparison ---");
    appAminoMsgs.forEach((aminoMsg, i) => {
      comparison.differences.push(`App Amino[${i}].type = "${aminoMsg.type}"`);
    });

    res.status(200).json({
      success: true,
      comparison,
      verdict:
        comparison.differences.filter((d) => !d.startsWith("---")).length === 0
          ? "✅ No structural differences found"
          : `❌ Found ${comparison.differences.filter((d) => !d.startsWith("---")).length} differences`,
    });
  } catch (error) {
    console.error("SignDoc comparison error:", error);
    res.status(500).json({
      error: "Comparison failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
