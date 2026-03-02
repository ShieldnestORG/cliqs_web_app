import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@/context/WalletContext";
import { explorerLinkAccount } from "@/lib/displayHelpers";
import { cn } from "@/lib/utils";
import { ArrowUpRightSquare, Loader2, Unplug } from "lucide-react";
import Image from "next/image";
import { useChains } from "../../../context/ChainsContext";
import { Button } from "../../ui/button";
import BalancesTable from "../BalancesTable";
import { CopyButton } from "@/components/ui/copy-button";

export default function AccountView() {
  const { chain } = useChains();
  const { walletInfo, loading, connectKeplr, connectLedger, disconnect } = useWallet();

  const explorerLink =
    explorerLinkAccount(chain.explorerLinks.account, walletInfo?.address || "") || "";

  return (
    <div className="mt-6 flex flex-col gap-4">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center text-2xl">
            {walletInfo?.type ? (
              <Image
                alt=""
                src={`/assets/icons/${walletInfo.type.toLowerCase()}.svg`}
                width={walletInfo.type === "Ledger" ? 30 : 27}
                height={walletInfo.type === "Ledger" ? 30 : 27}
                className={cn("mr-2", walletInfo.type === "Ledger" && "bg-white p-0.5")}
              />
            ) : null}
            {walletInfo?.type ? `Connected to ${walletInfo.type}` : "Connect to a wallet"}
          </CardTitle>
          <CardDescription>
            {walletInfo
              ? "Your wallet is connected. You can view your account details below."
              : "Choose between Keplr or Ledger to show its account info"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {walletInfo ? (
            <Button variant="outline" onClick={disconnect} className="w-full">
              <Unplug className="mr-2 h-auto w-5 text-destructive" />
              Disconnect {walletInfo.type}
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              <Button
                onClick={connectKeplr}
                disabled={loading.keplr || loading.ledger}
                variant="outline"
              >
                {loading.keplr ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Image
                    alt=""
                    src="/assets/icons/keplr.svg"
                    width={20}
                    height={20}
                    className="mr-2"
                  />
                )}
                Connect Keplr
              </Button>
              <Button
                onClick={connectLedger}
                disabled={loading.keplr || loading.ledger}
                variant="outline"
              >
                {loading.ledger ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Image
                    alt=""
                    src="/assets/icons/ledger.svg"
                    width={23}
                    height={23}
                    className="mr-2 bg-white p-0.5"
                  />
                )}
                Connect Ledger
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {walletInfo?.address ? (
        <Card>
          <CardHeader>
            <CardTitle>Account info</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {walletInfo ? (
              <div className="flex items-center space-x-4 rounded-md border bg-muted/30 p-4 transition-colors">
                <CopyButton value={walletInfo.address} copyLabel="address" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">Address</p>
                  <p className="text-sm text-muted-foreground">{walletInfo.address}</p>
                </div>
              </div>
            ) : null}
            {walletInfo ? (
              <div className="flex items-center space-x-4 rounded-md border bg-muted/30 p-4 transition-colors">
                <CopyButton value={walletInfo.pubKey} copyLabel="public key" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">Public key</p>
                  <p className="text-sm text-muted-foreground">{walletInfo.pubKey}</p>
                </div>
              </div>
            ) : null}
            {explorerLink ? (
              <Button asChild variant="secondary">
                <a href={explorerLink} target="_blank">
                  View in explorer <ArrowUpRightSquare className="ml-1" />
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      {walletInfo?.address ? (
        <Card>
          <CardHeader>
            <CardTitle>Balances</CardTitle>
            <CardDescription>
              Your list of tokens on {chain.chainDisplayName || "Cosmos Hub"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BalancesTable walletAddress={walletInfo.address} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
