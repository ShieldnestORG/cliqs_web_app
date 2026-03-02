/**
 * Revoke Credential API
 *
 * File: pages/api/chain/[chainId]/credentials/revoke.ts
 *
 * API route for revoking (burning) credentials.
 *
 * POST - Revoke a credential
 *
 * Phase 3: Identity NFTs (Credential-Gated Multisig)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import * as localDb from "@/lib/localDb";

// ============================================================================
// Types
// ============================================================================

interface RevokeCredentialRequest {
  classId: string;
  tokenId: string;
  actor: string;
  reason?: string;
  txHash: string;
  height: number;
}

interface ErrorResponse {
  error: string;
  code?: string;
}

// ============================================================================
// Handler
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; revokedAt: string } | ErrorResponse>,
) {
  const { chainId } = req.query;

  if (typeof chainId !== "string") {
    return res.status(400).json({ error: "Invalid chainId" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const body = req.body as RevokeCredentialRequest;

    // Validate required fields
    if (!body.classId) {
      return res.status(400).json({ error: "classId is required" });
    }
    if (!body.tokenId) {
      return res.status(400).json({ error: "tokenId is required" });
    }
    if (!body.actor) {
      return res.status(400).json({ error: "actor is required" });
    }

    // Check if credential exists
    const credential = localDb.getCredential(body.classId, body.tokenId);
    if (!credential) {
      return res.status(404).json({
        error: "Credential not found",
        code: "CREDENTIAL_NOT_FOUND",
      });
    }

    // Check if already revoked
    if (credential.status === "revoked") {
      return res.status(409).json({
        error: "Credential is already revoked",
        code: "ALREADY_REVOKED",
      });
    }

    const revokedAt = new Date().toISOString();

    // Update credential status
    localDb.updateCredentialStatus(body.classId, body.tokenId, "revoked", revokedAt);

    // Record the event
    localDb.recordCredentialEvent({
      classId: body.classId,
      tokenId: body.tokenId,
      eventType: "revoked",
      actor: body.actor,
      targetAddress: credential.ownerAddress,
      txHash: body.txHash || "",
      height: body.height || 0,
      chainId,
    });

    return res.status(200).json({ success: true, revokedAt });
  } catch (error) {
    console.error("Failed to revoke credential:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to revoke credential",
    });
  }
}
