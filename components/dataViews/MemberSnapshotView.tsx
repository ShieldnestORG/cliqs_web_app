/**
 * Member Snapshot View
 *
 * File: components/dataViews/MemberSnapshotView.tsx
 *
 * Displays the member snapshot captured at proposal creation time.
 * Shows who was eligible to vote when the proposal was created.
 *
 * Phase 2: Group-Backed Multisig
 */

"use client";

import { useMemo } from "react";
import { Clock, Users, Shield } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AddressDisplay } from "@/components/ui/address-display";

// ============================================================================
// Types
// ============================================================================

interface MemberSnapshotMember {
  addr: string;
  weight: number;
}

interface MemberSnapshotViewProps {
  /** Proposal ID */
  proposalId: number;
  /** Members at snapshot time */
  members: MemberSnapshotMember[];
  /** Total weight at snapshot time */
  totalWeight: number;
  /** Block height when snapshot was taken */
  snapshotHeight: number;
  /** Timestamp when snapshot was taken */
  snapshotTime: string;
  /** Current members for comparison */
  currentMembers?: MemberSnapshotMember[];
  /** Current total weight for comparison */
  currentTotalWeight?: number;
}

// ============================================================================
// Component
// ============================================================================

export default function MemberSnapshotView({
  proposalId,
  members,
  totalWeight,
  snapshotHeight,
  snapshotTime,
  currentMembers,
  currentTotalWeight,
}: MemberSnapshotViewProps) {
  // Calculate differences if current members provided
  const memberChanges = useMemo(() => {
    if (!currentMembers) return null;

    const snapshotAddrs = new Set(members.map((m) => m.addr.toLowerCase()));
    const currentAddrs = new Set(currentMembers.map((m) => m.addr.toLowerCase()));

    const added = currentMembers.filter((m) => !snapshotAddrs.has(m.addr.toLowerCase()));
    const removed = members.filter((m) => !currentAddrs.has(m.addr.toLowerCase()));
    const changed = members.filter((m) => {
      const current = currentMembers.find((c) => c.addr.toLowerCase() === m.addr.toLowerCase());
      return current && current.weight !== m.weight;
    });

    return {
      added,
      removed,
      changed,
      hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0,
    };
  }, [members, currentMembers]);

  // Format timestamp
  const formattedTime = useMemo(() => {
    try {
      return new Date(snapshotTime).toLocaleString();
    } catch {
      return snapshotTime;
    }
  }, [snapshotTime]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Member Snapshot
        </CardTitle>
        <CardDescription>
          Members eligible to vote when proposal #{proposalId} was created
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Snapshot metadata */}
        <div className="flex flex-wrap gap-4 text-sm">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formattedTime}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Block height: {snapshotHeight.toLocaleString()}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>
              Total weight: {totalWeight}
              {currentTotalWeight !== undefined && currentTotalWeight !== totalWeight && (
                <span className="ml-1 text-yellow-600">(now: {currentTotalWeight})</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>

        {/* Changes indicator */}
        {memberChanges?.hasChanges && (
          <div className="flex flex-wrap gap-2">
            {memberChanges.added.length > 0 && (
              <Badge className="bg-green-accent/20 text-green-accent">
                +{memberChanges.added.length} added since
              </Badge>
            )}
            {memberChanges.removed.length > 0 && (
              <Badge className="bg-red-100 text-red-800">
                -{memberChanges.removed.length} removed since
              </Badge>
            )}
            {memberChanges.changed.length > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800">
                {memberChanges.changed.length} weight changed
              </Badge>
            )}
          </div>
        )}

        {/* Members table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Address</TableHead>
              <TableHead className="w-24 text-right">Weight</TableHead>
              <TableHead className="w-24 text-right">%</TableHead>
              {currentMembers && <TableHead className="w-24">Status</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const currentMember = currentMembers?.find(
                (c) => c.addr.toLowerCase() === member.addr.toLowerCase(),
              );
              const wasRemoved = currentMembers && !currentMember;
              const weightChanged = currentMember && currentMember.weight !== member.weight;

              return (
                <TableRow key={member.addr} className={wasRemoved ? "opacity-50" : ""}>
                  <TableCell>
                    <AddressDisplay address={member.addr} copyLabel="member address" />
                  </TableCell>
                  <TableCell className="text-right">
                    {member.weight}
                    {weightChanged && (
                      <span className="ml-1 text-yellow-600">→ {currentMember?.weight}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {((member.weight / totalWeight) * 100).toFixed(1)}%
                  </TableCell>
                  {currentMembers && (
                    <TableCell>
                      {wasRemoved && (
                        <Badge variant="outline" className="text-red-600">
                          Removed
                        </Badge>
                      )}
                      {weightChanged && (
                        <Badge variant="outline" className="text-yellow-600">
                          Changed
                        </Badge>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
