/**
 * Credentials by Address API
 *
 * File: pages/api/chain/[chainId]/credentials/[address].ts
 *
 * API route for listing credentials for an address.
 *
 * GET - List credentials for an address or team
 *
 * Phase 3: Identity NFTs (Credential-Gated Multisig)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import * as localDb from "@/lib/localDb";

// ============================================================================
// Types
// ============================================================================

interface CredentialItem {
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
  revokedAt: string | null;
}

interface CredentialsListResponse {
  credentials: CredentialItem[];
  count: number;
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
  res: NextApiResponse<CredentialsListResponse | ErrorResponse>,
) {
  const { chainId, address } = req.query;

  if (typeof chainId !== "string") {
    return res.status(400).json({ error: "Invalid chainId" });
  }

  if (typeof address !== "string") {
    return res.status(400).json({ error: "Invalid address" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { type, status, role } = req.query;

    // Determine if address is a team address or owner address
    const isTeam = type === "team";

    let credentials: localDb.DbCredential[];

    if (isTeam) {
      // Get all credentials for a team
      credentials = localDb.getCredentialsByTeam(chainId, address);
    } else {
      // Get all credentials owned by an address
      credentials = localDb.getCredentialsByOwner(chainId, address);
    }

    // Apply filters
    if (typeof status === "string") {
      credentials = credentials.filter((c) => c.status === status);
    }
    if (typeof role === "string") {
      credentials = credentials.filter((c) => c.role === role);
    }

    const response: CredentialsListResponse = {
      credentials: credentials.map((c) => ({
        id: c.id,
        classId: c.classId,
        tokenId: c.tokenId,
        ownerAddress: c.ownerAddress,
        teamAddress: c.teamAddress,
        role: c.role,
        version: c.version,
        status: c.status,
        issuedAt: c.issuedAt,
        expiry: c.expiry,
        revokedAt: c.revokedAt,
      })),
      count: credentials.length,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Failed to list credentials:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list credentials",
    });
  }
}
