/**
 * Incidents API
 *
 * File: pages/api/chain/[chainId]/[address]/monitoring/incidents.ts
 *
 * GET: Get incidents
 * POST: Create an incident
 * PUT: Update an incident (acknowledge/resolve)
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import type { NextApiRequest, NextApiResponse } from "next";

import * as localDb from "@/lib/localDb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { chainId, address } = req.query;

  if (typeof chainId !== "string" || typeof address !== "string") {
    return res.status(400).json({ error: "Invalid chain ID or address" });
  }

  try {
    switch (req.method) {
      case "GET": {
        const status = req.query.status as string | undefined;
        const incidents = localDb.getIncidents(
          address,
          status as "open" | "acknowledged" | "resolved" | undefined,
        );

        return res.status(200).json({ incidents });
      }

      case "POST": {
        const { type, severity, title, description, triggeredBy, playbookId } = req.body;

        if (!type || !severity || !title || !description || !triggeredBy) {
          return res.status(400).json({
            error: "Missing required fields: type, severity, title, description, triggeredBy",
          });
        }

        const incidentId = localDb.createIncident({
          multisigAddress: address,
          chainId,
          type,
          severity,
          status: "open",
          title,
          description,
          playbookId: playbookId || null,
          playbookStatus: playbookId ? "pending" : null,
          triggeredBy,
        });

        const incidents = localDb.getIncidents(address);
        const incident = incidents.find((i) => i.id === incidentId);

        return res.status(201).json({ incident });
      }

      case "PUT": {
        const { incidentId, action, actor } = req.body;

        if (!incidentId || !action || !actor) {
          return res.status(400).json({
            error: "Missing required fields: incidentId, action, actor",
          });
        }

        const now = new Date().toISOString();

        if (action === "acknowledge") {
          localDb.updateIncident(incidentId, {
            status: "acknowledged",
            acknowledgedAt: now,
            acknowledgedBy: actor,
          });
        } else if (action === "resolve") {
          localDb.updateIncident(incidentId, {
            status: "resolved",
            resolvedAt: now,
            resolvedBy: actor,
          });
        } else {
          return res.status(400).json({
            error: "Invalid action. Use 'acknowledge' or 'resolve'",
          });
        }

        const incidents = localDb.getIncidents(address);
        const incident = incidents.find((i) => i.id === incidentId);

        return res.status(200).json({ incident });
      }

      default:
        res.setHeader("Allow", ["GET", "POST", "PUT"]);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error("Incidents API error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
