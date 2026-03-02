/**
 * Issue Credential API
 *
 * File: pages/api/chain/[chainId]/credentials/issue.ts
 *
 * API route for issuing credentials to team members.
 *
 * POST - Issue a new credential
 *
 * Phase 3: Identity NFTs (Credential-Gated Multisig)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import * as localDb from "@/lib/localDb";

// ============================================================================
// Types
// ============================================================================

interface IssueCredentialRequest {
  classId: string;
  tokenId: string;
  ownerAddress: string;
  teamAddress: string;
  role: "member" | "admin" | "proposer" | "executor";
  expiry?: string;
  txHash: string;
  height: number;
  issuer: string;
}

interface CredentialResponse {
  id: string;
  classId: string;
  tokenId: string;
  ownerAddress: string;
  teamAddress: string;
  role: string;
  version: number;
  status: string;
  issuedAt: string;
  expiry: string | null;
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
  res: NextApiResponse<CredentialResponse | ErrorResponse>,
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
    const body = req.body as IssueCredentialRequest;

    // Validate required fields
    if (!body.classId) {
      return res.status(400).json({ error: "classId is required" });
    }
    if (!body.tokenId) {
      return res.status(400).json({ error: "tokenId is required" });
    }
    if (!body.ownerAddress) {
      return res.status(400).json({ error: "ownerAddress is required" });
    }
    if (!body.teamAddress) {
      return res.status(400).json({ error: "teamAddress is required" });
    }
    if (!body.role) {
      return res.status(400).json({ error: "role is required" });
    }

    // Check if credential class exists
    const credentialClass = localDb.getCredentialClassById(chainId, body.classId);
    if (!credentialClass) {
      return res.status(404).json({
        error: "Credential class not found",
        code: "CLASS_NOT_FOUND",
      });
    }

    // Check if credential already exists
    const existing = localDb.getCredential(body.classId, body.tokenId);
    if (existing) {
      return res.status(409).json({
        error: "Credential already exists",
        code: "CREDENTIAL_EXISTS",
      });
    }

    // Check if owner already has a credential for this team
    const existingForOwner = localDb.getCredentialByOwner(
      chainId,
      body.teamAddress,
      body.ownerAddress,
    );
    if (existingForOwner) {
      return res.status(409).json({
        error: "Owner already has a credential for this team",
        code: "OWNER_HAS_CREDENTIAL",
      });
    }

    const issuedAt = new Date().toISOString();

    // Create the credential
    const id = localDb.createCredential({
      classId: body.classId,
      tokenId: body.tokenId,
      ownerAddress: body.ownerAddress,
      teamAddress: body.teamAddress,
      chainId,
      role: body.role,
      version: 1,
      status: "active",
      issuedAt,
      expiry: body.expiry || null,
    });

    // Record the event
    localDb.recordCredentialEvent({
      classId: body.classId,
      tokenId: body.tokenId,
      eventType: "issued",
      actor: body.issuer || credentialClass.issuer,
      targetAddress: body.ownerAddress,
      txHash: body.txHash || "",
      height: body.height || 0,
      chainId,
    });

    return res.status(201).json({
      id,
      classId: body.classId,
      tokenId: body.tokenId,
      ownerAddress: body.ownerAddress,
      teamAddress: body.teamAddress,
      role: body.role,
      version: 1,
      status: "active",
      issuedAt,
      expiry: body.expiry || null,
    });
  } catch (error) {
    console.error("Failed to issue credential:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to issue credential",
    });
  }
}
