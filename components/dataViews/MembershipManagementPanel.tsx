/**
 * Membership Management Panel
 * 
 * File: components/dataViews/MembershipManagementPanel.tsx
 * 
 * UI component for managing CW4 group membership in flex-style multisigs.
 * Provides admin controls to add, remove, and update member weights.
 * 
 * Features:
 * - View current members with weights
 * - Add new members (admin only)
 * - Remove members (admin only)
 * - Update member weights (admin only)
 * - Preview pending changes before submission
 * - Warning for changes affecting open proposals
 * 
 * Phase 2: Group-Backed Multisig
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  AlertTriangle, 
  Users, 
  Shield,
  RefreshCw,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { GroupMember, MemberUpdate } from "@/lib/group/types";

// ============================================================================
// Types
// ============================================================================

interface MembershipManagementPanelProps {
  /** Current members of the group */
  members: GroupMember[];
  /** Total weight of all members */
  totalWeight: number;
  /** Address of the group admin */
  adminAddress: string | null;
  /** Current user's address */
  userAddress: string | null;
  /** Group contract address */
  groupAddress: string;
  /** Chain address prefix */
  addressPrefix: string;
  /** Whether there are open proposals */
  hasOpenProposals?: boolean;
  /** Number of open proposals */
  openProposalCount?: number;
  /** Callback when membership is updated */
  onMembershipUpdate?: (updates: MemberUpdate[]) => Promise<void>;
  /** Callback to refresh members */
  onRefresh?: () => Promise<void>;
  /** Whether updates are being processed */
  isUpdating?: boolean;
}

interface PendingChange {
  type: "add" | "remove" | "update";
  address: string;
  weight?: number;
  originalWeight?: number;
}

// ============================================================================
// Component
// ============================================================================

export default function MembershipManagementPanel({
  members,
  totalWeight,
  adminAddress,
  userAddress,
  groupAddress,
  addressPrefix,
  hasOpenProposals = false,
  openProposalCount = 0,
  onMembershipUpdate,
  onRefresh,
  isUpdating = false,
}: MembershipManagementPanelProps) {
  // State
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState<number>(1);
  const [newMemberAddress, setNewMemberAddress] = useState("");
  const [newMemberWeight, setNewMemberWeight] = useState<number>(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  // Derived state
  const isAdmin = useMemo(() => {
    return userAddress !== null && adminAddress === userAddress;
  }, [userAddress, adminAddress]);

  const hasChanges = pendingChanges.length > 0;

  // Calculate new total weight after pending changes
  const projectedTotalWeight = useMemo(() => {
    let weight = totalWeight;
    
    for (const change of pendingChanges) {
      switch (change.type) {
        case "add":
          weight += change.weight ?? 0;
          break;
        case "remove":
          weight -= change.originalWeight ?? 0;
          break;
        case "update":
          weight += (change.weight ?? 0) - (change.originalWeight ?? 0);
          break;
      }
    }
    
    return weight;
  }, [totalWeight, pendingChanges]);

  // Get display members (with pending changes applied)
  const displayMembers = useMemo(() => {
    const memberMap = new Map<string, GroupMember & { pending?: PendingChange }>();
    
    // Add current members
    for (const member of members) {
      memberMap.set(member.address, { ...member });
    }
    
    // Apply pending changes
    for (const change of pendingChanges) {
      if (change.type === "add") {
        memberMap.set(change.address, {
          address: change.address,
          weight: change.weight ?? 1,
          pending: change,
        });
      } else if (change.type === "remove") {
        const existing = memberMap.get(change.address);
        if (existing) {
          memberMap.set(change.address, { ...existing, pending: change });
        }
      } else if (change.type === "update") {
        const existing = memberMap.get(change.address);
        if (existing) {
          memberMap.set(change.address, {
            ...existing,
            weight: change.weight ?? existing.weight,
            pending: change,
          });
        }
      }
    }
    
    return Array.from(memberMap.values());
  }, [members, pendingChanges]);

  // Handlers
  const handleAddMember = useCallback(() => {
    if (!newMemberAddress.trim()) {
      toast.error("Please enter a member address");
      return;
    }

    // Check if already exists
    const exists = members.some(
      (m) => m.address.toLowerCase() === newMemberAddress.toLowerCase()
    );
    const pendingAdd = pendingChanges.some(
      (c) => c.type === "add" && c.address.toLowerCase() === newMemberAddress.toLowerCase()
    );

    if (exists || pendingAdd) {
      toast.error("Member already exists");
      return;
    }

    setPendingChanges((prev) => [
      ...prev,
      { type: "add", address: newMemberAddress.trim(), weight: newMemberWeight },
    ]);
    setNewMemberAddress("");
    setNewMemberWeight(1);
    setIsAddDialogOpen(false);
    toast.success("Member added to pending changes");
  }, [newMemberAddress, newMemberWeight, members, pendingChanges]);

  const handleRemoveMember = useCallback((address: string) => {
    const member = members.find((m) => m.address === address);
    if (!member) return;

    // Check if there's already a pending change for this member
    const existingIndex = pendingChanges.findIndex((c) => c.address === address);
    if (existingIndex >= 0) {
      // Remove the pending change
      setPendingChanges((prev) => prev.filter((_, i) => i !== existingIndex));
    }

    setPendingChanges((prev) => [
      ...prev,
      { type: "remove", address, originalWeight: member.weight },
    ]);
    toast.success("Member removal added to pending changes");
  }, [members, pendingChanges]);

  const handleStartEdit = useCallback((member: GroupMember) => {
    setEditingMember(member.address);
    setEditWeight(member.weight);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingMember) return;

    const member = members.find((m) => m.address === editingMember);
    if (!member) return;

    if (editWeight === member.weight) {
      setEditingMember(null);
      return;
    }

    // Remove any existing pending change for this member
    setPendingChanges((prev) => prev.filter((c) => c.address !== editingMember));

    setPendingChanges((prev) => [
      ...prev,
      { 
        type: "update", 
        address: editingMember, 
        weight: editWeight,
        originalWeight: member.weight,
      },
    ]);
    setEditingMember(null);
    toast.success("Weight update added to pending changes");
  }, [editingMember, editWeight, members]);

  const handleCancelEdit = useCallback(() => {
    setEditingMember(null);
  }, []);

  const handleDiscardChange = useCallback((address: string) => {
    setPendingChanges((prev) => prev.filter((c) => c.address !== address));
    toast.info("Change discarded");
  }, []);

  const handleDiscardAllChanges = useCallback(() => {
    setPendingChanges([]);
    toast.info("All changes discarded");
  }, []);

  const handleApplyChanges = useCallback(async () => {
    if (!onMembershipUpdate || pendingChanges.length === 0) return;

    const updates: MemberUpdate[] = pendingChanges.map((change) => ({
      type: change.type,
      address: change.address,
      weight: change.weight,
    }));

    try {
      await onMembershipUpdate(updates);
      setPendingChanges([]);
      setIsConfirmDialogOpen(false);
      toast.success("Membership updated successfully");
    } catch (error) {
      toast.error("Failed to update membership", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [onMembershipUpdate, pendingChanges]);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
      toast.success("Members refreshed");
    }
  }, [onRefresh]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Group Members
            </CardTitle>
            <CardDescription>
              {members.length} members · Total weight: {totalWeight}
              {hasChanges && (
                <span className="text-yellow-600 ml-2">
                  → Projected: {projectedTotalWeight}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button variant="ghost" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            {isAdmin && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Member</DialogTitle>
                    <DialogDescription>
                      Add a new member to the group with a voting weight.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-address">Address</Label>
                      <Input
                        id="new-address"
                        placeholder={`${addressPrefix}1...`}
                        value={newMemberAddress}
                        onChange={(e) => setNewMemberAddress(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-weight">Weight</Label>
                      <Input
                        id="new-weight"
                        type="number"
                        min={1}
                        value={newMemberWeight}
                        onChange={(e) => setNewMemberWeight(parseInt(e.target.value, 10) || 1)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddMember}>
                      Add Member
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Admin info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>
            Admin: {adminAddress 
              ? `${adminAddress.slice(0, 12)}...${adminAddress.slice(-8)}`
              : "No admin (immutable)"}
          </span>
          {isAdmin && (
            <Badge variant="secondary" className="ml-2">You</Badge>
          )}
        </div>

        {/* Open proposals warning */}
        {hasOpenProposals && hasChanges && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning: Open Proposals</AlertTitle>
            <AlertDescription>
              There {openProposalCount === 1 ? "is" : "are"} {openProposalCount} open proposal{openProposalCount !== 1 ? "s" : ""}.
              Changing membership may affect voting thresholds.
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Members table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Address</TableHead>
              <TableHead className="w-24 text-right">Weight</TableHead>
              <TableHead className="w-24 text-right">%</TableHead>
              {isAdmin && <TableHead className="w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayMembers.map((member) => {
              const isPendingAdd = member.pending?.type === "add";
              const isPendingRemove = member.pending?.type === "remove";
              const isPendingUpdate = member.pending?.type === "update";
              const isEditing = editingMember === member.address;

              return (
                <TableRow 
                  key={member.address}
                  className={
                    isPendingAdd ? "bg-green-50 dark:bg-green-950" :
                    isPendingRemove ? "bg-red-50 dark:bg-red-950 opacity-50" :
                    isPendingUpdate ? "bg-yellow-50 dark:bg-yellow-950" :
                    ""
                  }
                >
                  <TableCell className="font-mono text-sm">
                    {member.address.slice(0, 12)}...{member.address.slice(-8)}
                    {isPendingAdd && (
                      <Badge variant="outline" className="ml-2 text-green-600">New</Badge>
                    )}
                    {isPendingRemove && (
                      <Badge variant="outline" className="ml-2 text-red-600">Removing</Badge>
                    )}
                    {isPendingUpdate && (
                      <Badge variant="outline" className="ml-2 text-yellow-600">Updated</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        min={1}
                        value={editWeight}
                        onChange={(e) => setEditWeight(parseInt(e.target.value, 10) || 1)}
                        className="w-20 text-right"
                      />
                    ) : (
                      <span>
                        {member.weight}
                        {isPendingUpdate && member.pending?.originalWeight !== undefined && (
                          <span className="text-muted-foreground ml-1">
                            (was {member.pending.originalWeight})
                          </span>
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {((member.weight / (projectedTotalWeight || 1)) * 100).toFixed(1)}%
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleSaveEdit}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : member.pending ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDiscardChange(member.address)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStartEdit(member)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveMember(member.address)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Pending changes actions */}
        {hasChanges && isAdmin && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {pendingChanges.length} pending change{pendingChanges.length !== 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscardAllChanges}
                >
                  Discard All
                </Button>
                <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={isUpdating}>
                      <Save className="h-4 w-4 mr-2" />
                      Apply Changes
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Membership Changes</DialogTitle>
                      <DialogDescription>
                        You are about to apply the following changes to the group membership.
                        This will require a transaction.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                      {pendingChanges.map((change, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {change.type === "add" && (
                            <>
                              <Badge className="bg-green-100 text-green-800">ADD</Badge>
                              <span className="font-mono">
                                {change.address.slice(0, 12)}...{change.address.slice(-8)}
                              </span>
                              <span className="text-muted-foreground">
                                (weight: {change.weight})
                              </span>
                            </>
                          )}
                          {change.type === "remove" && (
                            <>
                              <Badge className="bg-red-100 text-red-800">REMOVE</Badge>
                              <span className="font-mono">
                                {change.address.slice(0, 12)}...{change.address.slice(-8)}
                              </span>
                            </>
                          )}
                          {change.type === "update" && (
                            <>
                              <Badge className="bg-yellow-100 text-yellow-800">UPDATE</Badge>
                              <span className="font-mono">
                                {change.address.slice(0, 12)}...{change.address.slice(-8)}
                              </span>
                              <span className="text-muted-foreground">
                                ({change.originalWeight} → {change.weight})
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    <DialogFooter>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsConfirmDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleApplyChanges}
                        disabled={isUpdating}
                      >
                        {isUpdating ? "Applying..." : "Confirm & Apply"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </>
        )}

        {/* Not admin message */}
        {!isAdmin && userAddress && (
          <div className="text-center text-sm text-muted-foreground py-4">
            Only the group admin can modify membership.
          </div>
        )}

        {/* Not connected message */}
        {!userAddress && (
          <div className="text-center text-sm text-muted-foreground py-4">
            Connect your wallet to manage membership.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

