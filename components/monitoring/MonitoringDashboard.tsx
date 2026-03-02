/**
 * Monitoring Dashboard Component
 *
 * File: components/monitoring/MonitoringDashboard.tsx
 *
 * Displays metrics, alerts, and recent events for a multisig.
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

"use client";

import { useState } from "react";
import { Activity, AlertTriangle, Bell, Check, TrendingUp, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MultisigEvent } from "@/lib/monitoring/event-stream";
import { Anomaly } from "@/lib/monitoring/anomaly-detector";
import { Alert } from "@/lib/alerts/engine";

// ============================================================================
// Types
// ============================================================================

interface MetricData {
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
}

interface MonitoringDashboardProps {
  multisigAddress: string;
  chainId: string;
  metrics: MetricData[];
  recentEvents: MultisigEvent[];
  recentAnomalies: Anomaly[];
  recentAlerts: Alert[];
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function MonitoringDashboard({
  multisigAddress: _multisigAddress,
  chainId: _chainId,
  metrics,
  recentEvents,
  recentAnomalies,
  recentAlerts,
  isLoading: _isLoading = false,
}: MonitoringDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");

  // ============================================================================
  // Helpers
  // ============================================================================

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
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

  const getEventIcon = (type: string) => {
    if (type.includes("FAILED") || type.includes("VIOLATION")) return XCircle;
    if (type.includes("EXECUTED") || type.includes("COMPLETED")) return Check;
    if (type.includes("EMERGENCY") || type.includes("PAUSED")) return AlertTriangle;
    return Activity;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-500";
      case "high":
        return "text-orange-500";
      case "medium":
        return "text-yellow-500";
      default:
        return "text-blue-500";
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              {metric.change !== undefined && (
                <p
                  className={`text-xs ${metric.change >= 0 ? "text-green-accent" : "text-red-500"}`}
                >
                  {metric.change >= 0 ? "+" : ""}
                  {metric.change}% {metric.changeLabel || "from last period"}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Events
            <Badge variant="secondary" className="ml-1">
              {recentEvents.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Anomalies
            <Badge
              variant={recentAnomalies.length > 0 ? "destructive" : "secondary"}
              className="ml-1"
            >
              {recentAnomalies.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alerts
            <Badge variant="secondary" className="ml-1">
              {recentAlerts.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Events Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>Real-time stream of multisig activity</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {recentEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Activity className="mb-4 h-12 w-12" />
                    <p>No events recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentEvents.map((event) => {
                      const Icon = getEventIcon(event.type);
                      return (
                        <div
                          key={event.id}
                          className="flex items-start gap-4 rounded-lg bg-muted/50 p-3"
                        >
                          <div className="rounded-full bg-background p-2">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {event.type.replace(/_/g, " ")}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {formatTimestamp(event.timestamp)}
                              </Badge>
                            </div>
                            {event.actor && (
                              <p className="truncate text-xs text-muted-foreground">
                                by {event.actor.slice(0, 12)}...
                              </p>
                            )}
                            {event.data && Object.keys(event.data).length > 0 && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {JSON.stringify(event.data).slice(0, 100)}...
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies">
          <Card>
            <CardHeader>
              <CardTitle>Detected Anomalies</CardTitle>
              <CardDescription>Suspicious patterns that may require attention</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {recentAnomalies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Check className="mb-4 h-12 w-12 text-green-accent" />
                    <p>No anomalies detected</p>
                    <p className="text-sm">All systems operating normally</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentAnomalies.map((anomaly) => (
                      <div
                        key={anomaly.id}
                        className={`rounded-lg border p-4 ${
                          anomaly.severity === "critical"
                            ? "border-red-500 bg-red-500/10"
                            : anomaly.severity === "high"
                              ? "border-orange-500 bg-orange-500/10"
                              : "border-yellow-500 bg-yellow-500/10"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle
                              className={`h-5 w-5 ${getSeverityColor(anomaly.severity)}`}
                            />
                            <span className="font-medium">
                              {anomaly.type.replace(/_/g, " ").toUpperCase()}
                            </span>
                          </div>
                          <Badge
                            variant={
                              anomaly.severity === "critical"
                                ? "destructive"
                                : anomaly.severity === "high"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {anomaly.severity}
                          </Badge>
                        </div>
                        <p className="text-sm">{anomaly.message}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatTimestamp(anomaly.detectedAt)}</span>
                          <span>Rule: {anomaly.ruleId}</span>
                          <span>{anomaly.relatedEvents.length} related events</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Alert History</CardTitle>
              <CardDescription>Notifications sent to configured channels</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {recentAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Bell className="mb-4 h-12 w-12" />
                    <p>No alerts sent</p>
                    <p className="text-sm">Configure alert rules to get notified</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentAlerts.map((alert) => (
                      <div key={alert.id} className="rounded-lg border bg-muted/50 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium">{alert.title}</span>
                          <Badge
                            variant={
                              alert.severity === "critical"
                                ? "destructive"
                                : alert.severity === "warning"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatTimestamp(alert.timestamp)}</span>
                          <span>Source: {alert.source}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MonitoringDashboard;
