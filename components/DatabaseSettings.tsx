/**
 * Database Settings Component (BYODB)
 *
 * File: components/DatabaseSettings.tsx
 *
 * Full-featured UI for "Bring Your Own Database" configuration:
 *   - Toggle between default and custom database
 *   - Enter MongoDB connection string
 *   - Choose security level (base, passphrase, wallet signature)
 *   - Test connection
 *   - Provision (setup) database tables + indexes
 *   - Import / Export data with validation feedback
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toastError, toastSuccess, cn } from "@/lib/utils";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { requestJson } from "@/lib/request";
import {
  saveCredential,
  unlockCredential,
  getByodbStatus,
  clearByodb,
  updateMeta,
  lockCredential,
  getDecryptedUri,
  type SecurityLevel,
  type ByodbStatus,
  maskConnectionString,
} from "@/lib/byodb/storage";
import { getKeplrKey } from "@/lib/keplr";
import { fromBase64 } from "@cosmjs/encoding";
import {
  Database,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Upload,
  Download,
  TestTube,
  Wrench,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Wallet,
  KeyRound,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectionTestResult {
  ok: boolean;
  latencyMs?: number;
  serverVersion?: string;
  dbName?: string;
  error?: string;
  message?: string;
}

interface SetupResult {
  ok: boolean;
  collectionsCreated?: string[];
  indexesCreated?: number;
  stats?: {
    multisigCount: number;
    transactionCount: number;
    signatureCount: number;
    estimatedSizeMB: number;
  };
}

interface ImportResult {
  ok: boolean;
  imported?: {
    multisigs: { inserted: number; skipped: number };
    transactions: { inserted: number; skipped: number };
    signatures: { inserted: number; skipped: number };
    nonces: { inserted: number; skipped: number };
  };
  warnings?: string[];
  errors?: string[];
  error?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DatabaseSettings() {
  const { chain } = useChains();
  const { walletInfo } = useWallet();

  // State
  const [status, setStatus] = useState<ByodbStatus>({
    enabled: false,
    meta: null,
    needsUnlock: false,
  });
  const [connectionUri, setConnectionUri] = useState("");
  const [showUri, setShowUri] = useState(false);
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>(1);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [unlockPassphrase, setUnlockPassphrase] = useState("");

  // Action states
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load status on mount
  useEffect(() => {
    setStatus(getByodbStatus());
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleTestConnection = useCallback(async () => {
    const uri = getDecryptedUri() || connectionUri;
    if (!uri) {
      toastError({ title: "Enter a connection string first" });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result: ConnectionTestResult = await requestJson(
        "/api/db/test-connection",
        { body: { connectionUri: uri } },
      );
      setTestResult(result);

      if (result.ok) {
        toastSuccess(
          `Connected successfully`,
          `${result.dbName} (v${result.serverVersion}) — ${result.latencyMs}ms`,
        );
        if (status.meta) {
          updateMeta({ lastTestedAt: new Date().toISOString() });
          setStatus(getByodbStatus());
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setTestResult({ ok: false, error: msg });
      toastError({ title: "Connection test failed", description: msg });
    } finally {
      setTesting(false);
    }
  }, [connectionUri, status.meta]);

  const handleProvisionDatabase = useCallback(async () => {
    const uri = getDecryptedUri();
    if (!uri) {
      toastError({ title: "Unlock your database credentials first" });
      return;
    }

    setProvisioning(true);
    setSetupResult(null);

    try {
      const result: SetupResult = await requestJson("/api/db/setup", {
        body: { connectionUri: uri },
      });
      setSetupResult(result);

      if (result.ok) {
        toastSuccess(
          "Database provisioned",
          `${result.indexesCreated} indexes created`,
        );
        updateMeta({ provisioned: true });
        setStatus(getByodbStatus());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Setup failed";
      setSetupResult({ ok: false });
      toastError({ title: "Database setup failed", description: msg });
    } finally {
      setProvisioning(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!connectionUri) {
      toastError({ title: "Enter a connection string" });
      return;
    }

    if (
      !connectionUri.startsWith("mongodb://") &&
      !connectionUri.startsWith("mongodb+srv://")
    ) {
      toastError({ title: "Invalid connection string", description: "Must start with mongodb:// or mongodb+srv://" });
      return;
    }

    if (securityLevel === 1) {
      if (!passphrase) {
        toastError({ title: "Enter a passphrase" });
        return;
      }
      if (passphrase !== confirmPassphrase) {
        toastError({ title: "Passphrases do not match" });
        return;
      }
      if (passphrase.length < 8) {
        toastError({ title: "Passphrase too short", description: "Use at least 8 characters" });
        return;
      }
    }

    if (securityLevel === 2 && !walletInfo) {
      toastError({
        title: "Wallet required",
        description: "Connect your wallet to use Level 2 security.",
      });
      return;
    }

    setSaving(true);

    try {
      let material: string | Uint8Array | undefined;

      if (securityLevel === 1) {
        material = passphrase;
      } else if (securityLevel === 2) {
        // Request wallet signature
        const key = await getKeplrKey(chain.chainId);
        const keplr = window.keplr;
        if (!keplr) throw new Error("Keplr wallet not found");

        const message = `BYODB credential encryption key for ${chain.chainDisplayName}`;
        const sig = await keplr.signArbitrary(chain.chainId, key.bech32Address, message);
        material = fromBase64(sig.signature);
      }

      await saveCredential(connectionUri, securityLevel, material);

      toastSuccess(
        "Database credentials saved",
        `Security level ${securityLevel} — ${securityLevel === 0 ? "Base" : securityLevel === 1 ? "Passphrase" : "Wallet"} protection`,
      );

      // Clear sensitive input fields
      setConnectionUri("");
      setPassphrase("");
      setConfirmPassphrase("");
      setStatus(getByodbStatus());
    } catch (err) {
      toastError({
        title: "Failed to save credentials",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }, [connectionUri, securityLevel, passphrase, confirmPassphrase, chain, walletInfo]);

  const handleUnlock = useCallback(async () => {
    setUnlocking(true);

    try {
      const level = status.meta?.securityLevel ?? 0;
      let material: string | Uint8Array | undefined;

      if (level === 1) {
        if (!unlockPassphrase) {
          toastError({ title: "Enter your passphrase" });
          setUnlocking(false);
          return;
        }
        material = unlockPassphrase;
      } else if (level === 2) {
        const key = await getKeplrKey(chain.chainId);
        const keplr = window.keplr;
        if (!keplr) throw new Error("Keplr wallet not found");

        const message = `BYODB credential encryption key for ${chain.chainDisplayName}`;
        const sig = await keplr.signArbitrary(chain.chainId, key.bech32Address, message);
        material = fromBase64(sig.signature);
      }

      await unlockCredential(material);
      toastSuccess("Database unlocked");
      setUnlockPassphrase("");
      setStatus(getByodbStatus());
    } catch (err) {
      toastError({
        title: "Failed to unlock",
        description: err instanceof Error ? err.message : "Incorrect passphrase or signature",
      });
    } finally {
      setUnlocking(false);
    }
  }, [status.meta, unlockPassphrase, chain]);

  const handleDisconnect = useCallback(() => {
    clearByodb();
    setStatus(getByodbStatus());
    setTestResult(null);
    setSetupResult(null);
    setImportResult(null);
    toastSuccess("Reverted to default database");
  }, []);

  const handleLock = useCallback(() => {
    lockCredential();
    setStatus(getByodbStatus());
    toastSuccess("Credentials locked");
  }, []);

  const handleExport = useCallback(async () => {
    const uri = getDecryptedUri();
    if (!uri) {
      toastError({ title: "Unlock your database first" });
      return;
    }

    setExporting(true);

    try {
      const data = await requestJson("/api/db/export", {
        body: { scope: "all" },
        headers: { "x-byodb-uri": uri },
      });

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cliq-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toastSuccess("Data exported", "Check your downloads folder");
    } catch (err) {
      toastError({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setExporting(false);
    }
  }, []);

  const handleImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const uri = getDecryptedUri();
      if (!uri) {
        toastError({ title: "Unlock your database first" });
        return;
      }

      setImporting(true);
      setImportResult(null);
      setImportProgress(10);

      try {
        const text = await file.text();
        setImportProgress(30);

        // Basic pre-validation
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          toastError({ title: "Invalid file", description: "The selected file is not valid JSON" });
          setImporting(false);
          return;
        }

        setImportProgress(50);

        const result: ImportResult = await requestJson("/api/db/import", {
          body: parsed,
          headers: { "x-byodb-uri": uri },
        });

        setImportProgress(100);
        setImportResult(result);

        if (result.ok && result.imported) {
          const total =
            result.imported.multisigs.inserted +
            result.imported.transactions.inserted +
            result.imported.signatures.inserted +
            result.imported.nonces.inserted;
          toastSuccess("Import complete", `${total} records imported`);
        } else {
          toastError({
            title: "Import failed",
            description: result.errors?.join(", ") || result.message || "Unknown error",
          });
        }
      } catch (err) {
        toastError({
          title: "Import failed",
          description: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        setImporting(false);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const securityLevelIcon = (level: SecurityLevel) => {
    if (level === 0) return <Shield className="h-4 w-4" />;
    if (level === 1) return <ShieldCheck className="h-4 w-4" />;
    return <ShieldAlert className="h-4 w-4" />;
  };

  const securityLevelBadge = (level: SecurityLevel) => {
    const labels = ["Base (HTTPS only)", "Passphrase + AES-256", "Wallet Signature + AES-256"];
    const variants: Array<"secondary" | "default" | "destructive"> = ["secondary", "default", "default"];
    return (
      <Badge variant={variants[level]} className="gap-1">
        {securityLevelIcon(level)}
        Level {level}: {labels[level]}
      </Badge>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-500" />
          Database Configuration
        </CardTitle>
        <CardDescription>
          Use your own MongoDB database for full data sovereignty. All multisig data,
          transactions, and signatures will be stored exclusively on your database.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Banner */}
        {status.enabled && status.meta && (
          <Alert variant={status.needsUnlock ? "warning" : "default"}>
            {status.needsUnlock ? (
              <Lock className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {status.needsUnlock
                ? "Custom Database Locked"
                : "Custom Database Active"}
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-sm font-mono">{status.meta.maskedUri}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {securityLevelBadge(status.meta.securityLevel)}
                {status.meta.provisioned && (
                  <Badge variant="outline" className="gap-1">
                    <Wrench className="h-3 w-3" /> Provisioned
                  </Badge>
                )}
                {status.meta.lastTestedAt && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    Last tested: {new Date(status.meta.lastTestedAt).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Unlock Panel (shown when credentials are saved but locked) */}
        {status.enabled && status.needsUnlock && (
          <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/50">
            <h4 className="font-medium flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Unlock Credentials
            </h4>

            {status.meta?.securityLevel === 1 && (
              <div className="space-y-2">
                <Label htmlFor="unlock-passphrase">Passphrase</Label>
                <div className="flex gap-2">
                  <Input
                    id="unlock-passphrase"
                    type="password"
                    placeholder="Enter your passphrase"
                    value={unlockPassphrase}
                    onChange={(e) => setUnlockPassphrase(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                  />
                  <Button onClick={handleUnlock} disabled={unlocking}>
                    {unlocking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlock className="h-4 w-4" />
                    )}
                    Unlock
                  </Button>
                </div>
              </div>
            )}

            {status.meta?.securityLevel === 2 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Sign a message with your wallet to unlock your database credentials.
                </p>
                <Button onClick={handleUnlock} disabled={unlocking}>
                  {unlocking ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Wallet className="h-4 w-4 mr-2" />
                  )}
                  Sign to Unlock
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Connected Actions (shown when unlocked) */}
        {status.enabled && !status.needsUnlock && (
          <div className="space-y-4">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>

              {!status.meta?.provisioned && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleProvisionDatabase}
                  disabled={provisioning}
                >
                  {provisioning ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Wrench className="h-4 w-4 mr-2" />
                  )}
                  Setup Database
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleLock}
              >
                <Lock className="h-4 w-4 mr-2" />
                Lock
              </Button>
            </div>

            {/* Test Result */}
            {testResult && (
              <Alert variant={testResult.ok ? "default" : "destructive"}>
                {testResult.ok ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {testResult.ok ? "Connection Successful" : "Connection Failed"}
                </AlertTitle>
                <AlertDescription>
                  {testResult.ok ? (
                    <span>
                      Database: <strong>{testResult.dbName}</strong> — Server v{testResult.serverVersion} — {testResult.latencyMs}ms
                    </span>
                  ) : (
                    <span>{testResult.message || testResult.error}</span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Setup Result */}
            {setupResult?.ok && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Database Ready</AlertTitle>
                <AlertDescription>
                  {setupResult.collectionsCreated?.length
                    ? `Created collections: ${setupResult.collectionsCreated.join(", ")}. `
                    : "All collections already exist. "}
                  {setupResult.indexesCreated} indexes ensured.
                  {setupResult.stats && (
                    <span className="block mt-1 text-xs text-muted-foreground">
                      {setupResult.stats.multisigCount} multisigs, {setupResult.stats.transactionCount} transactions,{" "}
                      {setupResult.stats.signatureCount} signatures ({setupResult.stats.estimatedSizeMB} MB)
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* Import / Export */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Data Transfer</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export Data
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Import Data
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </div>

              {importing && (
                <Progress value={importProgress} className="h-2" />
              )}

              {importResult && (
                <Alert variant={importResult.ok ? "default" : "destructive"}>
                  {importResult.ok ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {importResult.ok ? "Import Complete" : "Import Failed"}
                  </AlertTitle>
                  <AlertDescription>
                    {importResult.ok && importResult.imported && (
                      <div className="text-xs space-y-0.5 mt-1">
                        <p>Multisigs: {importResult.imported.multisigs.inserted} imported, {importResult.imported.multisigs.skipped} skipped</p>
                        <p>Transactions: {importResult.imported.transactions.inserted} imported, {importResult.imported.transactions.skipped} skipped</p>
                        <p>Signatures: {importResult.imported.signatures.inserted} imported, {importResult.imported.signatures.skipped} skipped</p>
                        <p>Nonces: {importResult.imported.nonces.inserted} imported, {importResult.imported.nonces.skipped} skipped</p>
                      </div>
                    )}
                    {importResult.warnings && importResult.warnings.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Warnings:
                        </p>
                        <ul className="text-xs list-disc list-inside mt-1">
                          {importResult.warnings.slice(0, 5).map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                          {importResult.warnings.length > 5 && (
                            <li>...and {importResult.warnings.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                    {importResult.errors && (
                      <div className="mt-1">
                        {importResult.errors.slice(0, 3).map((e, i) => (
                          <p key={i} className="text-xs">{e}</p>
                        ))}
                      </div>
                    )}
                    {importResult.message && (
                      <p className="text-xs mt-1">{importResult.message}</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* Disconnect */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Disconnect Custom Database
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Custom Database?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove your saved connection credentials and revert
                    to the default shared database. Your data in the custom database
                    will remain intact — you can reconnect later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisconnect}>
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Setup Form (shown when no custom DB is configured) */}
        {!status.enabled && (
          <div className="space-y-6">
            {/* Connection String */}
            <div className="space-y-2">
              <Label htmlFor="connection-uri">MongoDB Connection String</Label>
              <div className="relative">
                <Input
                  id="connection-uri"
                  type={showUri ? "text" : "password"}
                  placeholder="mongodb+srv://user:password@cluster.mongodb.net/mydb"
                  value={connectionUri}
                  onChange={(e) => setConnectionUri(e.target.value)}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowUri(!showUri)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showUri ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get a free MongoDB Atlas database at{" "}
                <a
                  href="https://www.mongodb.com/atlas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  mongodb.com/atlas
                </a>{" "}
                (512 MB free tier)
              </p>
            </div>

            {/* Test button for new URIs */}
            {connectionUri && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
            )}

            {testResult && (
              <Alert variant={testResult.ok ? "default" : "destructive"}>
                {testResult.ok ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {testResult.ok ? "Connection Successful" : "Connection Failed"}
                </AlertTitle>
                <AlertDescription>
                  {testResult.ok ? (
                    <span>
                      Database: <strong>{testResult.dbName}</strong> — Server v{testResult.serverVersion} — {testResult.latencyMs}ms
                    </span>
                  ) : (
                    <span>{testResult.message || testResult.error}</span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* Security Level Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Credential Protection Level</Label>
              <p className="text-sm text-muted-foreground">
                Choose how your connection string is protected in this browser.
                Higher levels require unlocking each session.
              </p>

              <RadioGroup
                value={String(securityLevel)}
                onValueChange={(v) => setSecurityLevel(Number(v) as SecurityLevel)}
                className="space-y-3"
              >
                {/* Level 0 */}
                <div className="flex items-start space-x-3 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="0" id="level-0" className="mt-1" />
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="level-0" className="flex items-center gap-2 cursor-pointer">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      Level 0: Base Protection
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Credentials encoded in localStorage, transmitted over HTTPS.
                      No unlock step needed. Good for development or trusted devices.
                    </p>
                  </div>
                </div>

                {/* Level 1 */}
                <div className="flex items-start space-x-3 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="1" id="level-1" className="mt-1" />
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="level-1" className="flex items-center gap-2 cursor-pointer">
                      <KeyRound className="h-4 w-4 text-blue-500" />
                      Level 1: Passphrase Encryption
                      <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      AES-256-GCM encryption with PBKDF2 key derivation (600K iterations).
                      You&apos;ll enter a passphrase to unlock each session.
                    </p>
                  </div>
                </div>

                {/* Level 2 */}
                <div
                  className={cn(
                    "flex items-start space-x-3 rounded-lg border border-border p-4 transition-colors",
                    walletInfo ? "hover:bg-muted/50" : "opacity-70 bg-muted/30",
                  )}
                >
                  <RadioGroupItem
                    value="2"
                    id="level-2"
                    className="mt-1"
                    disabled={!walletInfo}
                  />
                  <div className="space-y-1 flex-1">
                    <Label
                      htmlFor="level-2"
                      className={cn(
                        "flex items-center gap-2",
                        walletInfo ? "cursor-pointer" : "cursor-not-allowed",
                      )}
                    >
                      <Wallet className="h-4 w-4 text-green-500" />
                      Level 2: Wallet Signature
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      AES-256-GCM encryption with key derived from a Keplr wallet signature.
                      You&apos;ll sign a message to unlock each session. Most secure for crypto users.
                    </p>
                    {!walletInfo && (
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 font-medium">
                        Connect your wallet to use Level 2 security.
                      </p>
                    )}
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Passphrase fields for Level 1 */}
            {securityLevel === 1 && (
              <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="passphrase">Encryption Passphrase</Label>
                  <Input
                    id="passphrase"
                    type="password"
                    placeholder="At least 8 characters"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-passphrase">Confirm Passphrase</Label>
                  <Input
                    id="confirm-passphrase"
                    type="password"
                    placeholder="Re-enter passphrase"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                  />
                </div>
                {passphrase && confirmPassphrase && passphrase !== confirmPassphrase && (
                  <p className="text-xs text-destructive">Passphrases do not match</p>
                )}
              </div>
            )}

            {/* Wallet notice for Level 2 */}
            {securityLevel === 2 && (
              <Alert>
                <Wallet className="h-4 w-4" />
                <AlertTitle>Wallet Signing Required</AlertTitle>
                <AlertDescription className="text-sm">
                  When you click Save, Keplr will ask you to sign a message. This
                  signature is used as the encryption key — not as a transaction.
                  No gas fees involved.
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* Privacy Notice */}
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Privacy & Security</AlertTitle>
              <AlertDescription className="text-sm space-y-1">
                <p>
                  Your connection string is encrypted locally and only sent to our server (over HTTPS)
                  during API calls. We never log, store, or cache your credentials server-side.
                </p>
                <p>
                  When BYODB is active, all data is read/written exclusively to your database.
                  Our default database is completely bypassed.
                </p>
              </AlertDescription>
            </Alert>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={saving || !connectionUri}
              className="w-full"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Save & Activate Custom Database
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
