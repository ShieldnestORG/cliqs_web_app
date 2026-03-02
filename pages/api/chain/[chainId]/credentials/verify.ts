/**
 * Verify Credential API
 *
 * File: pages/api/chain/[chainId]/credentials/verify.ts
 *
 * API route for verifying credential validity.
 *
 * GET - Verify if an address holds a valid credential for a team
 *
 * Phase 3: Identity NFTs (Credential-Gated Multisig)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import * as localDb from "@/lib/localDb";

// ============================================================================
// Types
// ============================================================================

interface VerificationResponse {
  isValid: boolean;
  credential?: {
    classId: string;
    tokenId: string;
    role: string;
    version: number;
    status: string;
    issuedAt: string;
    expiry: string | null;
  };
  reason?: string;
  verifiedAt: string;
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
  res: NextApiResponse<VerificationResponse | ErrorResponse>,
) {
  const { chainId } = req.query;

  if (typeof chainId !== "string") {
    return res.status(400).json({ error: "Invalid chainId" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { teamAddress, signerAddress, role } = req.query;

    // Validate required fields
    if (typeof teamAddress !== "string") {
      return res.status(400).json({ error: "teamAddress query parameter is required" });
    }
    if (typeof signerAddress !== "string") {
      return res.status(400).json({ error: "signerAddress query parameter is required" });
    }

    const verifiedAt = new Date().toISOString();

    // Check if credential class exists for this team
    const credentialClass = localDb.getCredentialClass(chainId, teamAddress);
    if (!credentialClass) {
      return res.status(200).json({
        isValid: false,
        reason: "no_credential_class",
        verifiedAt,
      });
    }

    // Get credential for this signer and team
    const credential = localDb.getCredentialByOwner(chainId, teamAddress, signerAddress);

    if (!credential) {
      return res.status(200).json({
        isValid: false,
        reason: "not_found",
        verifiedAt,
      });
    }

    // Check status
    if (credential.status !== "active") {
      return res.status(200).json({
        isValid: false,
        reason: credential.status === "revoked" ? "revoked" : "expired",
        verifiedAt,
      });
    }

    // Check expiry
    if (credential.expiry && new Date(credential.expiry) < new Date()) {
      // Update status to expired
      localDb.updateCredentialStatus(credential.classId, credential.tokenId, "expired");

      return res.status(200).json({
        isValid: false,
        reason: "expired",
        verifiedAt,
      });
    }

    // Check role if specified
    const requiredRole = typeof role === "string" ? role : undefined;
    if (requiredRole && credential.role !== requiredRole && credential.role !== "admin") {
      return res.status(200).json({
        isValid: false,
        reason: "wrong_role",
        verifiedAt,
      });
    }

    // Valid credential
    return res.status(200).json({
      isValid: true,
      credential: {
        classId: credential.classId,
        tokenId: credential.tokenId,
        role: credential.role,
        version: credential.version,
        status: credential.status,
        issuedAt: credential.issuedAt,
        expiry: credential.expiry,
      },
      verifiedAt,
    });
  } catch (error) {
    console.error("Failed to verify credential:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to verify credential",
    });
  }
}
