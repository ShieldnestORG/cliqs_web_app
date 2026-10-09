import Image from "next/image";
import { Loader2, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardLabel,
  CardTitle,
} from "@/components/ui/card";
import { useWallet } from "@/context/WalletContext";

interface WalletConnectPromptProps {
  /** Small label above the title, e.g. "Home" or "Settings". */
  readonly label: string;
  /** One sentence saying what connecting unlocks on this page. */
  readonly description: string;
}

/**
 * The one in-page "connect your wallet" card. Extracted from the former
 * Operations page; it calls the same WalletContext connect functions and adds
 * no signing of its own.
 */
export default function WalletConnectPrompt({ label, description }: WalletConnectPromptProps) {
  const { connectKeplr, connectLedger, loading } = useWallet();

  return (
    <Card variant="institutional" bracket="green" className="mx-auto max-w-4xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-accent/20">
          <Wallet className="h-8 w-8 text-green-accent" />
        </div>
        <CardLabel comment className="justify-center">
          {label}
        </CardLabel>
        <CardTitle className="text-2xl">Connect your wallet</CardTitle>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={connectKeplr}
            disabled={loading.keplr || loading.ledger}
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
          >
            {loading.keplr ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Image alt="Keplr" src="/assets/icons/keplr.svg" width={24} height={24} />
            )}
            <span className="text-sm">Keplr</span>
          </Button>
          <Button
            onClick={connectLedger}
            disabled={loading.keplr || loading.ledger}
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
          >
            {loading.ledger ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Image
                alt="Ledger"
                src="/assets/icons/ledger.svg"
                width={24}
                height={24}
                className="rounded bg-white p-0.5"
              />
            )}
            <span className="text-sm">Ledger</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
