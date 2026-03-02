/**
 * Incident Panel Component
 *
 * File: components/emergency/IncidentPanel.tsx
 *
 * Displays and manages incidents for a multisig.
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, Clock, Eye, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DbIncident } from "@/lib/localDb";

// ============================================================================
// Types
// ============================================================================

interface IncidentPanelProps {
  multisigAddress: string;
  chainId: string;
  incidents: DbIncident[];
  onAcknowledge: (incidentId: string) => Promise<void>;
  onResolve: (incidentId: string) => Promise<void>;
  onRunPlaybook: (incidentId: string, playbookId: string) => Promise<void>;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function IncidentPanel({
  multisigAddress: _multisigAddress,
  chainId: _chainId,
  incidents,
  onAcknowledge,
  onResolve,
  onRunPlaybook: _onRunPlaybook,
  isLoading: _isLoading = false,
}: IncidentPanelProps) {
  const [selectedIncident, setSelectedIncident] = useState<DbIncident | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleAcknowledge = async (incidentId: string) => {
    setActionLoading(incidentId);
    try {
      await onAcknowledge(incidentId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (incidentId: string) => {
    setActionLoading(incidentId);
    try {
      await onResolve(incidentId);
      setSelectedIncident(null);
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return AlertCircle;
      case "acknowledged":
        return Eye;
      case "resolved":
        return CheckCircle;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "text-red-500";
      case "acknowledged":
        return "text-yellow-500";
      case "resolved":
        return "text-green-accent";
      default:
        return "text-muted-foreground";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "warning":
        return "default";
      default:
        return "secondary";
    }
  };

  // Sort incidents: open first, then by created date
  const sortedIncidents = [...incidents].sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === "open") return -1;
      if (b.status === "open") return 1;
      if (a.status === "acknowledged") return -1;
      if (b.status === "acknowledged") return 1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const openCount = incidents.filter((i) => i.status === "open").length;
  const acknowledgedCount = incidents.filter((i) => i.status === "acknowledged").length;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{openCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{acknowledgedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resolved (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-accent">
              {incidents.filter((i) => i.status === "resolved").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incident List */}
      <Card>
        <CardHeader>
          <CardTitle>Incidents</CardTitle>
          <CardDescription>Security incidents requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {sortedIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircle className="mb-4 h-12 w-12 text-green-accent" />
                <p>No incidents</p>
                <p className="text-sm">All systems operating normally</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedIncidents.map((incident) => {
                  const StatusIcon = getStatusIcon(incident.status);
                  const incidentLoading = actionLoading === incident.id;

                  return (
                    <div
                      key={incident.id}
                      className={`rounded-lg border p-4 ${
                        incident.status === "open"
                          ? "border-red-500/50 bg-red-500/5"
                          : incident.status === "acknowledged"
                            ? "border-yellow-500/50 bg-yellow-500/5"
                            : "bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <StatusIcon
                            className={`mt-0.5 h-5 w-5 ${getStatusColor(incident.status)}`}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{incident.title}</span>
                              <Badge
                                variant={
                                  getSeverityBadge(incident.severity) as
                                    | "destructive"
                                    | "default"
                                    | "secondary"
                                }
                              >
                                {incident.severity}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {incident.description}
                            </p>
                            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Created {formatTimestamp(incident.createdAt)}</span>
                              <span>Type: {incident.type}</span>
                              {incident.playbookId && <span>Playbook: {incident.playbookId}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {incident.status === "open" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcknowledge(incident.id)}
                              disabled={incidentLoading}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              Acknowledge
                            </Button>
                          )}
                          {incident.status !== "resolved" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setSelectedIncident(incident)}
                              disabled={incidentLoading}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Playbook Status */}
                      {incident.playbookId && incident.playbookStatus && (
                        <div className="mt-3 border-t pt-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Play className="h-4 w-4" />
                            <span>Playbook: {incident.playbookId}</span>
                            <Badge
                              variant={
                                incident.playbookStatus === "completed"
                                  ? "secondary"
                                  : incident.playbookStatus === "running"
                                    ? "default"
                                    : incident.playbookStatus === "failed"
                                      ? "destructive"
                                      : "outline"
                              }
                            >
                              {incident.playbookStatus}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Incident</DialogTitle>
            <DialogDescription>
              Mark this incident as resolved. This action confirms the issue has been addressed.
            </DialogDescription>
          </DialogHeader>
          {selectedIncident && (
            <div className="py-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Incident:</span>
                  <span>{selectedIncident.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Severity:</span>
                  <Badge
                    variant={
                      getSeverityBadge(selectedIncident.severity) as
                        | "destructive"
                        | "default"
                        | "secondary"
                    }
                  >
                    {selectedIncident.severity}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{formatTimestamp(selectedIncident.createdAt)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedIncident(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedIncident && handleResolve(selectedIncident.id)}
              disabled={actionLoading === selectedIncident?.id}
            >
              {actionLoading === selectedIncident?.id ? "Resolving..." : "Mark Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default IncidentPanel;
