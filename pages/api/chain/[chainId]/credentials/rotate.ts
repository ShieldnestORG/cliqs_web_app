/**
 * Rotate Signer API
 *
 * File: pages/api/chain/[chainId]/credentials/rotate.ts
 *
 * API route for rotating a signer's credential.
 *
 * POST - Rotate a signer (revoke old credential, issue new one)
 *
 * Phase 3: Identity NFTs (Credential-Gated Multisig)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import * as localDb from "@/lib/localDb";

// ============================================================================
// Types
// ============================================================================

interface RotateSignerRequest {
  classId: string;
  oldSignerAddress: string;
  newSignerAddress: string;
  newTokenId: string;
  role: "member" | "admin" | "proposer" | "executor";
  teamAddress: string;
  actor: string;
  burnTxHash: string;
  mintTxHash: string;
  burnHeight: number;
  mintHeight: number;
  expiry?: string;
}

interface RotationResponse {
  success: boolean;
  revokedCredential: {
    classId: string;
    tokenId: string;
    ownerAddress: string;
    revokedAt: string;
  };
  newCredential: {
    classId: string;
    tokenId: string;
    ownerAddress: string;
    role: string;
    version: number;
    issuedAt: string;
  };
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
  res: NextApiResponse<RotationResponse | ErrorResponse>,
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
    const body = req.body as RotateSignerRequest;

    // Validate required fields
    if (!body.classId) {
      return res.status(400).json({ error: "classId is required" });
    }
    if (!body.oldSignerAddress) {
      return res.status(400).json({ error: "oldSignerAddress is required" });
    }
    if (!body.newSignerAddress) {
      return res.status(400).json({ error: "newSignerAddress is required" });
    }
    if (!body.newTokenId) {
      return res.status(400).json({ error: "newTokenId is required" });
    }
    if (!body.teamAddress) {
      return res.status(400).json({ error: "teamAddress is required" });
    }
    if (!body.role) {
      return res.status(400).json({ error: "role is required" });
    }

    // Get the old credential
    const oldCredential = localDb.getCredentialByOwner(
      chainId,
      body.teamAddress,
      body.oldSignerAddress,
    );

    if (!oldCredential) {
      return res.status(404).json({
        error: "No credential found for old signer",
        code: "CREDENTIAL_NOT_FOUND",
      });
    }

    if (oldCredential.status !== "active") {
      return res.status(409).json({
        error: "Old credential is not active",
        code: "CREDENTIAL_NOT_ACTIVE",
      });
    }

    // Check if new signer already has a credential
    const existingNewCredential = localDb.getCredentialByOwner(
      chainId,
      body.teamAddress,
      body.newSignerAddress,
    );

    if (existingNewCredential && existingNewCredential.status === "active") {
      return res.status(409).json({
        error: "New signer already has an active credential",
        code: "NEW_SIGNER_HAS_CREDENTIAL",
      });
    }

    const now = new Date().toISOString();
    const newVersion = oldCredential.version + 1;

    // Step 1: Revoke old credential
    localDb.updateCredentialStatus(oldCredential.classId, oldCredential.tokenId, "revoked", now);

    // Step 2: Create new credential
    localDb.createCredential({
      classId: body.classId,
      tokenId: body.newTokenId,
      ownerAddress: body.newSignerAddress,
      teamAddress: body.teamAddress,
      chainId,
      role: body.role,
      version: newVersion,
      status: "active",
      issuedAt: now,
      expiry: body.expiry || null,
    });

    // Record the rotation event
    localDb.recordCredentialEvent({
      classId: body.classId,
      tokenId: oldCredential.tokenId,
      eventType: "rotated",
      actor: body.actor,
      targetAddress: body.newSignerAddress,
      txHash: body.mintTxHash || "",
      height: body.mintHeight || 0,
      chainId,
    });

    return res.status(200).json({
      success: true,
      revokedCredential: {
        classId: oldCredential.classId,
        tokenId: oldCredential.tokenId,
        ownerAddress: oldCredential.ownerAddress,
        revokedAt: now,
      },
      newCredential: {
        classId: body.classId,
        tokenId: body.newTokenId,
        ownerAddress: body.newSignerAddress,
        role: body.role,
        version: newVersion,
        issuedAt: now,
      },
    });
  } catch (error) {
    console.error("Failed to rotate signer:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to rotate signer",
    });
  }
}
