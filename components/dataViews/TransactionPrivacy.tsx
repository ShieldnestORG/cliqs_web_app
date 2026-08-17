/**
 * Transaction Privacy Component
 *
 * File: components/dataViews/TransactionPrivacy.tsx
 *
 * Self-service data controls for a cliq's off-chain history in the hosted DB:
 *   - Export history as JSON
 *   - Wipe completed (broadcast) transactions
 *   - Delete the cliq record entirely
 *
 * Every action signs a fresh ADR-36 message at click time: the server nonce
 * advances on each authenticated call, so the WalletContext cached signature
 * must NOT be reused here.
 */

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { exportTransactions, getDbNonce, wipeTransactions } from "@/lib/api";
import { getKeplrVerifySignature } from "@/lib/keplr";
import { toastError, toastSuccess } from "@/lib/utils";
import { StdSignature } from "@cosmjs/amino";
import { Download, Eraser, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { useRouter } from "next/router";
import { useState } from "react";

interface TransactionPrivacyProps {
  readonly multisigAddress: string;
  readonly memberCount: number;
}

type BusyAction = "export" | "wipe" | "delete" | null;

export default function TransactionPrivacy({
  multisigAddress,
  memberCount,
}: TransactionPrivacyProps) {
  const router = useRouter();
  const { chain } = useChains();
  const { walletInfo } = useWallet();
  const [busy, setBusy] = useState<BusyAction>(null);

  const isKeplr = walletInfo?.type === "Keplr";

  // Sign fresh at click time — the server nonce advances on every authenticated
  // call, so a cached signature (WalletContext.verificationSignature) would fail.
  const acquireSignature = async (): Promise<StdSignature> => {
    if (!walletInfo || walletInfo.type !== "Keplr") {
      throw new Error("Connect a Keplr wallet to manage stored data");
    }
    const nonce = await getDbNonce(walletInfo.address, chain.chainId);
    return getKeplrVerifySignature(walletInfo.address, chain, nonce);
  };

  const handleExport = async () => {
    try {
      setBusy("export");
      const signature = await acquireSignature();
      const result = await exportTransactions(multisigAddress, chain, signature);

      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cliq-history-${multisigAddress.slice(0, 12)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);

      toastSuccess(
        "History exported",
        `${result.transactionCount} transaction(s) downloaded as JSON`,
      );
    } catch (e) {
      console.error("Failed to export history:", e);
      toastError({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Could not export transaction history",
        fullError: e instanceof Error ? e : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleWipeCompleted = async () => {
    try {
      setBusy("wipe");
      const signature = await acquireSignature();
      const result = await wipeTransactions(multisigAddress, chain, "completed", signature);

      if (result.localDbNotice) {
        toastError({ title: "Wipe not supported", description: result.localDbNotice });
        return;
      }
      toastSuccess(
        "Completed transactions wiped",
        `Deleted ${result.deletedTransactions} transaction(s) and ${result.deletedSignatures} signature(s)`,
      );
    } catch (e) {
      console.error("Failed to wipe completed transactions:", e);
      toastError({
        title: "Wipe failed",
        description: e instanceof Error ? e.message : "Could not wipe completed transactions",
        fullError: e instanceof Error ? e : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteMultisig = async () => {
    try {
      setBusy("delete");
      const signature = await acquireSignature();
      const result = await wipeTransactions(multisigAddress, chain, "multisig", signature);

      if (result.localDbNotice) {
        toastError({ title: "Deletion not supported", description: result.localDbNotice });
        return;
      }
      toastSuccess(
        "Cliq deleted from database",
        `Deleted ${result.deletedTransactions} transaction(s) and ${result.deletedSignatures} signature(s)`,
      );
      router.push(`/${chain.registryName}`);
    } catch (e) {
      console.error("Failed to delete cliq:", e);
      toastError({
        title: "Deletion failed",
        description: e instanceof Error ? e.message : "Could not delete the cliq",
        fullError: e instanceof Error ? e : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          Data & Privacy
        </CardTitle>
        <CardDescription>
          Export or delete this cliq&apos;s off-chain history stored in the database. Deletions
          affect all {memberCount} members. You will be asked to sign a message proving cliq
          membership.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isKeplr && (
          <p className="text-sm text-muted-foreground">
            Connect a Keplr wallet to manage stored data.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {/* Export history */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!isKeplr || busy !== null}>
                {busy === "export" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export History
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Export transaction history?</AlertDialogTitle>
                <AlertDialogDescription>
                  Downloads this cliq&apos;s full transaction history — including pending
                  transactions and all {memberCount} members&apos; signatures — as a JSON file. You
                  will be asked to sign a message with your wallet first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleExport}>Sign & Export</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Wipe completed transactions */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={!isKeplr || busy !== null}>
                {busy === "wipe" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Eraser className="mr-2 h-4 w-4" />
                )}
                Wipe Completed
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Wipe completed transactions?</AlertDialogTitle>
                <AlertDialogDescription>
                  Permanently deletes all completed (broadcast) transactions and their signatures
                  from the database for all {memberCount} members. On-chain records are not
                  affected, but free-text memos stored here cannot be recovered — consider exporting
                  the history first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleWipeCompleted}>Sign & Wipe</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete multisig record */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={!isKeplr || busy !== null}>
                {busy === "delete" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete Cliq Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this cliq from the database?</AlertDialogTitle>
                <AlertDialogDescription>
                  Permanently deletes the cliq record, its entire transaction history, and all
                  signatures for all {memberCount} members. The cliq will disappear from the app for
                  ALL members until someone re-imports it, and its name and description cannot be
                  recovered. On-chain funds are not affected. Consider exporting the history first.
                  Deletion is refused while pending transactions carry other members&apos;
                  signatures — cancel those first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteMultisig}>Sign & Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
