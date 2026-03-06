import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { FetchedMultisigs, getDbUserMultisigs } from "@/lib/api";
import { toastError } from "@/lib/utils";
import { MultisigThresholdPubkey } from "@cosmjs/amino";
import { Loader2, MoveRightIcon, RefreshCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export default function ListUserMultisigs() {
  const { chain } = useChains();
  const {
    walletInfo,
    loading: walletLoading,
    connectKeplr,
    isConnecting,
    verify,
    verificationSignature,
    isVerified,
    isVerifying,
  } = useWallet();

  const [loadingMultisigs, setLoadingMultisigs] = useState(false);
  const [showBelonged, setShowBelonged] = useState(false);
  const [multisigs, setMultisigs] = useState<FetchedMultisigs | null>(null);

  const fetchMultisigs = useCallback(async () => {
    if (!walletInfo || walletInfo.type !== "Keplr") {
      return;
    }

    try {
      setLoadingMultisigs(true);

      const fetchedMultisigs =
        isVerified && verificationSignature
          ? await getDbUserMultisigs(chain, { signature: verificationSignature })
          : await getDbUserMultisigs(chain, {
              address: walletInfo.address,
              pubkey: walletInfo.pubKey,
            });
      setMultisigs(fetchedMultisigs);
    } catch (e: unknown) {
      console.error("Failed to fetch multisigs:", e);
      toastError({
        description: "Failed to fetch multisigs",
        fullError: e instanceof Error ? e : undefined,
      });
    } finally {
      setLoadingMultisigs(false);
    }
  }, [chain, walletInfo, verificationSignature, isVerified]);

  // Auto-fetch multisigs when wallet is verified (user must manually verify first)
  useEffect(() => {
    if (isVerified && walletInfo?.type === "Keplr" && !multisigs && !loadingMultisigs) {
      fetchMultisigs();
    }
  }, [isVerified, walletInfo, multisigs, loadingMultisigs, fetchMultisigs]);

  // Clear multisigs when wallet disconnects
  useEffect(() => {
    if (!walletInfo) {
      setMultisigs(null);
    }
  }, [walletInfo]);

  const handleConnect = useCallback(async () => {
    await connectKeplr();
  }, [connectKeplr]);

  const handleVerifyAndFetch = useCallback(async () => {
    const signature = await verify();
    if (!signature) {
      return;
    }
    await fetchMultisigs();
  }, [fetchMultisigs, verify]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Multisigs</CardTitle>
        <CardDescription>
          Your list of created multisigs on {chain.chainDisplayName}.
          {!walletInfo && " Connect your wallet to see your multisigs."}
          {walletInfo &&
            !isVerified &&
            " Lookup works immediately with your connected wallet; verification improves discovery accuracy."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Not connected state */}
        {!walletInfo ? (
          <Button onClick={handleConnect} disabled={isConnecting} variant="outline">
            {walletLoading.keplr ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Image alt="" src="/assets/icons/keplr.svg" width={20} height={20} className="mr-2" />
            )}
            Connect Keplr
          </Button>
        ) : null}

        {/* Connected but not verified - Keplr only */}
        {walletInfo &&
        walletInfo.type === "Keplr" &&
        !isVerified &&
        !multisigs &&
        !loadingMultisigs &&
        !isVerifying ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={fetchMultisigs} disabled={loadingMultisigs} variant="outline">
              Lookup multisigs
            </Button>
            <Button
              onClick={handleVerifyAndFetch}
              disabled={loadingMultisigs || isVerifying}
              variant="outline"
            >
              <Image alt="" src="/assets/icons/keplr.svg" width={20} height={20} className="mr-2" />
              Verify identity
            </Button>
          </div>
        ) : null}

        {/* Ledger connected - can't easily verify */}
        {walletInfo && walletInfo.type === "Ledger" && !multisigs ? (
          <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            <p>
              Ledger wallet connected. To view your multisigs, please use Keplr to verify your
              identity.
            </p>
          </div>
        ) : null}

        {/* Loading states */}
        {(loadingMultisigs || isVerifying) && (
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin" />
            <p>{isVerifying ? "Verifying wallet..." : "Loading multisigs"}</p>
          </div>
        )}

        {/* Empty states */}
        {multisigs && !showBelonged && !multisigs.created.length && (
          <p className="text-sm text-muted-foreground">You have not created any multisig</p>
        )}
        {multisigs && showBelonged && !multisigs.belonged.length && (
          <p className="text-sm text-muted-foreground">You are not a member of any multisig</p>
        )}

        {/* Multisig list */}
        {multisigs?.created.length || multisigs?.belonged.length ? (
          <>
            <div className="flex items-center justify-between">
              {multisigs.created.length !== multisigs.belonged.length ? (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="multisigs-type"
                    checked={showBelonged}
                    onCheckedChange={setShowBelonged}
                  />
                  <Label htmlFor="multisigs-type">Show all multisigs I'm a member of</Label>
                </div>
              ) : (
                <div />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchMultisigs}
                disabled={loadingMultisigs || isVerifying}
              >
                <RefreshCw className={`mr-1 h-4 w-4 ${loadingMultisigs ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {(showBelonged ? multisigs.belonged : multisigs.created).map((multisig) => {
                const pubkey: MultisigThresholdPubkey = JSON.parse(multisig.pubkeyJSON);

                return (
                  <Link
                    key={multisig.address}
                    href={`/${chain.registryName}/${multisig.address}`}
                    className="flex items-center space-x-2 rounded-md border p-2 transition-colors hover:cursor-pointer hover:bg-muted/50"
                  >
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge className="text-sm text-muted-foreground">
                          {pubkey.value.threshold} / {pubkey.value.pubkeys.length}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div>
                          <p>threshold: {pubkey.value.threshold}</p>
                          <p>members: {pubkey.value.pubkeys.length}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{multisig.address}</p>
                    </div>
                    <MoveRightIcon className="w-5" />
                  </Link>
                );
              })}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
