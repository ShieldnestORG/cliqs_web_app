import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@/context/WalletContext";
import { explorerLinkAccount } from "@/lib/displayHelpers";
import { cn } from "@/lib/utils";
import { ArrowUpRightSquare, Unplug } from "lucide-react";
import Image from "next/image";
import WalletConnectPrompt from "@/components/WalletConnectPrompt";
import { useChains } from "../../../context/ChainsContext";
import { Button } from "../../ui/button";
import BalancesTable from "../BalancesTable";
import { CopyButton } from "@/components/ui/copy-button";

export default function AccountView() {
  const { chain } = useChains();
  const { walletInfo, disconnect } = useWallet();

  const explorerLink =
    explorerLinkAccount(chain.explorerLinks.account, walletInfo?.address || "") || "";

  if (!walletInfo) {
    return (
      <WalletConnectPrompt
        label="Settings"
        description="Connect your wallet to see your address, public key and balances."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center text-2xl">
            {walletInfo.type ? (
              <Image
                alt=""
                src={`/assets/icons/${walletInfo.type.toLowerCase()}.svg`}
                width={walletInfo.type === "Ledger" ? 30 : 27}
                height={walletInfo.type === "Ledger" ? 30 : 27}
                className={cn("mr-2", walletInfo.type === "Ledger" && "bg-white p-0.5")}
              />
            ) : null}
            {walletInfo.type ? `Connected to ${walletInfo.type}` : "Wallet connected"}
          </CardTitle>
          <CardDescription>
            Your wallet is connected. You can view your account details below.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button variant="outline" onClick={disconnect} className="w-full">
            <Unplug className="mr-2 h-auto w-5 text-destructive" />
            Disconnect {walletInfo.type}
          </Button>
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
