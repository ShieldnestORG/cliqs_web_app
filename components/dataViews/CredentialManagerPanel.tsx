/**
 * Credential Manager Panel
 * 
 * File: components/dataViews/CredentialManagerPanel.tsx
 * 
 * Panel for managing team credentials in a multisig.
 * Allows viewing, issuing, and revoking credentials.
 * 
 * Phase 3: Identity NFTs (Credential-Gated Multisig)
 */

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CredentialBadge,
  CredentialStatusType,
} from "@/components/ui/credential-badge";
import {
  Shield,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CopyButton } from "@/components/ui/copy-button";

// ============================================================================
// Types
// ============================================================================

interface CredentialClass {
  id: string;
  teamAddress: string;
  chainId: string;
  classId: string;
  issuer: string;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

interface Credential {
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

interface CredentialManagerPanelProps {
  teamAddress: string;
  chainId: string;
  isAdmin?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CredentialManagerPanel({
  teamAddress,
  chainId,
  isAdmin = false,
  className,
}: CredentialManagerPanelProps) {
  // State
  const [credentialClass, setCredentialClass] = useState<CredentialClass | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog state
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  
  // Form state
  const [newRecipientAddress, setNewRecipientAddress] = useState("");
  const [newRole, setNewRole] = useState<string>("member");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchCredentialClass = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/chain/${chainId}/credentials/class?teamAddress=${teamAddress}`,
      );
      
      if (response.status === 404) {
        setCredentialClass(null);
        return;
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch credential class");
      }
      
      const data = await response.json();
      setCredentialClass(data);
    } catch (err) {
      console.error("Failed to fetch credential class:", err);
    }
  }, [chainId, teamAddress]);

  const fetchCredentials = useCallback(async () => {
    if (!credentialClass) {
      setCredentials([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/chain/${chainId}/credentials/${teamAddress}?type=team`,
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch credentials");
      }
      
      const data = await response.json();
      setCredentials(data.credentials || []);
    } catch (err) {
      console.error("Failed to fetch credentials:", err);
    }
  }, [chainId, teamAddress, credentialClass]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await fetchCredentialClass();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [fetchCredentialClass]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // ============================================================================
  // Actions
  // ============================================================================

  const handleIssueCredential = async () => {
    if (!credentialClass || !newRecipientAddress) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Generate a simple token ID
      const tokenId = `cred-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      const response = await fetch(`/api/chain/${chainId}/credentials/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: credentialClass.classId,
          tokenId,
          ownerAddress: newRecipientAddress,
          teamAddress,
          role: newRole,
          issuer: credentialClass.issuer,
          txHash: "", // Would be set after broadcast
          height: 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to issue credential");
      }

      // Refresh credentials
      await fetchCredentials();
      setIsIssueDialogOpen(false);
      setNewRecipientAddress("");
      setNewRole("member");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue credential");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeCredential = async () => {
    if (!selectedCredential) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/chain/${chainId}/credentials/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedCredential.classId,
          tokenId: selectedCredential.tokenId,
          actor: credentialClass?.issuer || "",
          txHash: "",
          height: 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to revoke credential");
      }

      // Refresh credentials
      await fetchCredentials();
      setIsRevokeDialogOpen(false);
      setSelectedCredential(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke credential");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCredentialStatus = (cred: Credential): CredentialStatusType => {
    if (cred.status === "revoked") return "revoked";
    if (cred.status === "expired") return "expired";
    if (cred.expiry && new Date(cred.expiry) < new Date()) return "expired";
    return "valid";
  };

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 10)}...${address.slice(-6)}`;
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!credentialClass) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Credentials
          </CardTitle>
          <CardDescription>
            This team does not have credential gating enabled
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Credential gating is not enabled for this multisig. All members can vote without holding a credential NFT.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-500" />
              Credential Management
            </CardTitle>
            <CardDescription>
              Manage identity NFT credentials for team members
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => setIsIssueDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Issue
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Class Info */}
        <div className="bg-muted/50 rounded-lg p-4 mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Class ID</span>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-background px-2 py-1 rounded">
                {truncateAddress(credentialClass.classId)}
              </code>
              <CopyButton
                value={credentialClass.classId}
                copyLabel="class ID"
                className="h-6 w-6"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Features</span>
            <div className="flex gap-1">
              {credentialClass.features.map((f) => (
                <span
                  key={f}
                  className="text-xs bg-background px-2 py-1 rounded capitalize"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Credentials</span>
            <span className="text-sm font-medium">
              {credentials.filter((c) => c.status === "active").length} active
            </span>
          </div>
        </div>

        {/* Credentials Table */}
        {credentials.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No credentials issued yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                {isAdmin && <TableHead className="w-[50px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map((cred) => (
                <TableRow key={cred.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-xs">
                        {truncateAddress(cred.ownerAddress)}
                      </code>
                      <CopyButton
                        value={cred.ownerAddress}
                        copyLabel="member address"
                        className="h-5 w-5"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="capitalize text-sm">{cred.role}</span>
                  </TableCell>
                  <TableCell>
                    <CredentialBadge
                      status={getCredentialStatus(cred)}
                      role={cred.role}
                      compact
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(cred.issuedAt).toLocaleDateString()}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {cred.status === "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            setSelectedCredential(cred);
                            setIsRevokeDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Issue Credential Dialog */}
      <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Credential</DialogTitle>
            <DialogDescription>
              Issue a new credential NFT to a team member
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Address</Label>
              <Input
                id="recipient"
                placeholder="core1..."
                value={newRecipientAddress}
                onChange={(e) => setNewRecipientAddress(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="proposer">Proposer</SelectItem>
                  <SelectItem value="executor">Executor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsIssueDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleIssueCredential}
              disabled={isSubmitting || !newRecipientAddress}
            >
              {isSubmitting ? "Issuing..." : "Issue Credential"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Credential Dialog */}
      <Dialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Credential</DialogTitle>
            <DialogDescription>
              This action will burn the credential NFT and immediately revoke access
            </DialogDescription>
          </DialogHeader>
          
          {selectedCredential && (
            <div className="py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You are about to revoke the credential for{" "}
                  <code className="text-xs">
                    {truncateAddress(selectedCredential.ownerAddress)}
                  </code>
                  . This action cannot be undone.
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRevokeDialogOpen(false);
                setSelectedCredential(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeCredential}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Revoking..." : "Revoke Credential"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default CredentialManagerPanel;

