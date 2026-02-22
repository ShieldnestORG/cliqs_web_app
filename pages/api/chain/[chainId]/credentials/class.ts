/**
 * Credential Class API
 * 
 * File: pages/api/chain/[chainId]/credentials/class.ts
 * 
 * API routes for creating and querying credential classes.
 * 
 * POST - Create a new credential class for a team
 * GET  - Get credential class for a team (by teamAddress query param)
 * 
 * Phase 3: Identity NFTs (Credential-Gated Multisig)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import * as localDb from "@/lib/localDb";

// ============================================================================
// Types
// ============================================================================

interface CreateClassRequest {
  teamAddress: string;
  classId: string;
  issuer: string;
  name: string;
  symbol: string;
  description?: string;
  features: string[];
}

interface CredentialClassResponse {
  id: string;
  teamAddress: string;
  chainId: string;
  classId: string;
  issuer: string;
  features: string[];
  createdAt: string;
  updatedAt: string;
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
  res: NextApiResponse<CredentialClassResponse | ErrorResponse | { success: boolean; id: string }>,
) {
  const { chainId } = req.query;

  if (typeof chainId !== "string") {
    return res.status(400).json({ error: "Invalid chainId" });
  }

  switch (req.method) {
    case "POST":
      return handleCreateClass(req, res, chainId);
    case "GET":
      return handleGetClass(req, res, chainId);
    default:
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}

// ============================================================================
// POST - Create Credential Class
// ============================================================================

async function handleCreateClass(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; id: string } | ErrorResponse>,
  chainId: string,
) {
  try {
    const body = req.body as CreateClassRequest;

    // Validate required fields
    if (!body.teamAddress) {
      return res.status(400).json({ error: "teamAddress is required" });
    }
    if (!body.classId) {
      return res.status(400).json({ error: "classId is required" });
    }
    if (!body.issuer) {
      return res.status(400).json({ error: "issuer is required" });
    }

    // Check if class already exists for this team
    const existing = localDb.getCredentialClass(chainId, body.teamAddress);
    if (existing) {
      return res.status(409).json({
        error: "Credential class already exists for this team",
        code: "CLASS_EXISTS",
      });
    }

    // Ensure required features
    const features = new Set(body.features || []);
    if (!features.has("soulbound") && !features.has("disable_sending")) {
      features.add("soulbound");
    }
    if (!features.has("burning")) {
      features.add("burning");
    }

    // Create the credential class record
    const id = localDb.createCredentialClass({
      teamAddress: body.teamAddress,
      chainId,
      classId: body.classId,
      issuer: body.issuer,
      features: Array.from(features),
    });

    // Record the event
    localDb.recordCredentialEvent({
      classId: body.classId,
      tokenId: "", // No token for class creation
      eventType: "class_created",
      actor: body.issuer,
      targetAddress: body.teamAddress,
      txHash: "", // Would be set by caller after broadcast
      height: 0,
      chainId,
    });

    return res.status(201).json({ success: true, id });
  } catch (error) {
    console.error("Failed to create credential class:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to create credential class",
    });
  }
}

// ============================================================================
// GET - Get Credential Class
// ============================================================================

async function handleGetClass(
  req: NextApiRequest,
  res: NextApiResponse<CredentialClassResponse | ErrorResponse>,
  chainId: string,
) {
  try {
    const { teamAddress, classId } = req.query;

    let credentialClass;

    if (typeof teamAddress === "string") {
      credentialClass = localDb.getCredentialClass(chainId, teamAddress);
    } else if (typeof classId === "string") {
      credentialClass = localDb.getCredentialClassById(chainId, classId);
    } else {
      return res.status(400).json({
        error: "Either teamAddress or classId query parameter is required",
      });
    }

    if (!credentialClass) {
      return res.status(404).json({
        error: "Credential class not found",
        code: "CLASS_NOT_FOUND",
      });
    }

    return res.status(200).json(credentialClass);
  } catch (error) {
    console.error("Failed to get credential class:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get credential class",
    });
  }
}

