/**
 * Policies API
 *
 * File: pages/api/chain/[chainId]/[address]/policies/index.ts
 *
 * GET: List policies for a multisig
 * POST: Create a new policy
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import type { NextApiRequest, NextApiResponse } from "next";

import * as localDb from "@/lib/localDb";
import { PolicyType } from "@/lib/policies/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { chainId, address } = req.query;

  if (typeof chainId !== "string" || typeof address !== "string") {
    return res.status(400).json({ error: "Invalid chain ID or address" });
  }

  try {
    switch (req.method) {
      case "GET": {
        const policies = localDb.getPolicies(address, chainId);
        return res.status(200).json({ policies });
      }

      case "POST": {
        const { type, name, config, priority, enabled } = req.body;

        if (!type || !name || !config) {
          return res.status(400).json({ error: "Missing required fields: type, name, config" });
        }

        const validTypes: PolicyType[] = [
          "timelock",
          "emergency",
          "msg_type",
          "spend_limit",
          "allowlist",
          "denylist",
          "custom",
        ];

        if (!validTypes.includes(type)) {
          return res.status(400).json({ error: `Invalid policy type: ${type}` });
        }

        const policyId = localDb.upsertPolicy({
          multisigAddress: address,
          chainId,
          type,
          name,
          configJSON: typeof config === "string" ? config : JSON.stringify(config),
          enabled: enabled ?? true,
          priority: priority ?? getPriorityForType(type),
        });

        const policy = localDb.getPolicyById(policyId);

        return res.status(201).json({ policy });
      }

      default:
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error("Policies API error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

function getPriorityForType(type: PolicyType): number {
  const priorities: Record<PolicyType, number> = {
    timelock: 10,
    emergency: 20,
    msg_type: 30,
    spend_limit: 40,
    allowlist: 50,
    denylist: 50,
    custom: 60,
  };
  return priorities[type] ?? 50;
}
