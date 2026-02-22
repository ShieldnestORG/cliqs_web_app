/**
 * Individual Policy API
 * 
 * File: pages/api/chain/[chainId]/[address]/policies/[policyId].ts
 * 
 * GET: Get a specific policy
 * PUT: Update a policy
 * DELETE: Delete a policy
 * 
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import type { NextApiRequest, NextApiResponse } from "next";

import * as localDb from "@/lib/localDb";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { chainId, address, policyId } = req.query;

  if (
    typeof chainId !== "string" ||
    typeof address !== "string" ||
    typeof policyId !== "string"
  ) {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  try {
    switch (req.method) {
      case "GET": {
        const policy = localDb.getPolicyById(policyId);
        
        if (!policy) {
          return res.status(404).json({ error: "Policy not found" });
        }

        if (policy.multisigAddress !== address || policy.chainId !== chainId) {
          return res.status(404).json({ error: "Policy not found" });
        }

        return res.status(200).json({ policy });
      }

      case "PUT": {
        const policy = localDb.getPolicyById(policyId);
        
        if (!policy) {
          return res.status(404).json({ error: "Policy not found" });
        }

        if (policy.multisigAddress !== address || policy.chainId !== chainId) {
          return res.status(404).json({ error: "Policy not found" });
        }

        const { name, config, priority, enabled } = req.body;

        const updates: Parameters<typeof localDb.updatePolicy>[1] = {};
        
        if (name !== undefined) updates.name = name;
        if (config !== undefined) {
          updates.configJSON = typeof config === "string" ? config : JSON.stringify(config);
        }
        if (priority !== undefined) updates.priority = priority;
        if (enabled !== undefined) updates.enabled = enabled;

        localDb.updatePolicy(policyId, updates);

        const updatedPolicy = localDb.getPolicyById(policyId);

        return res.status(200).json({ policy: updatedPolicy });
      }

      case "DELETE": {
        const policy = localDb.getPolicyById(policyId);
        
        if (!policy) {
          return res.status(404).json({ error: "Policy not found" });
        }

        if (policy.multisigAddress !== address || policy.chainId !== chainId) {
          return res.status(404).json({ error: "Policy not found" });
        }

        const deleted = localDb.deletePolicy(policyId);

        if (!deleted) {
          return res.status(404).json({ error: "Policy not found" });
        }

        return res.status(200).json({ success: true });
      }

      default:
        res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error("Policy API error:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    });
  }
}

