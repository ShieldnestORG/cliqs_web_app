import { useChains } from "@/context/ChainsContext";
import { setChain, setNewConnection } from "@/context/ChainsContext/helpers";
import { AlertTriangle, ArrowRight, Pencil, Plug } from "lucide-react";
import { useRouter } from "next/router";
import { Button } from "../ui/button";
import ChainDigest from "./ChainDigest";

interface ConfirmConnectionProps {
  readonly closeDialog: () => void;
}

export default function ConfirmConnection({ closeDialog }: ConfirmConnectionProps) {
  const router = useRouter();
  const { chain, newConnection, chainsDispatch } = useChains();

  if (newConnection.action !== "confirm") {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[hsl(var(--accent-purple)/0.3)] bg-[hsl(var(--accent-purple)/0.1)]">
            <Plug className="h-5 w-5 text-[hsl(var(--accent-purple))]" />
          </div>
          <div>
            <span className="text-label text-label-comment text-[10px]">Network Switch</span>
            <h3 className="font-heading text-xl font-semibold text-foreground">
              Confirm Connection
            </h3>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 rounded-lg border-2 border-[hsl(43_100%_50%/0.3)] bg-[hsl(43_100%_50%/0.1)] p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[hsl(43_100%_50%)]" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Switching networks will redirect you to the homepage
          </p>
          <p className="text-xs text-muted-foreground">
            Any unsaved form data will be lost. Make sure to save your work before proceeding.
          </p>
        </div>
      </div>

      {/* Chain Comparison */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
        {/* Current Chain */}
        <div className="w-full max-w-sm rounded-lg border-2 border-border bg-muted/30 p-4 sm:w-auto">
          <span className="text-label mb-3 block text-[10px] text-destructive">{`// FROM`}</span>
          <ChainDigest chain={chain} simplify />
        </div>

        {/* Arrow */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-border bg-card sm:mt-12">
          <ArrowRight className="h-5 w-5 text-[hsl(var(--accent-green))]" />
        </div>

        {/* New Chain */}
        <div className="w-full max-w-sm rounded-lg border-2 border-[hsl(var(--accent-green)/0.3)] bg-[hsl(var(--accent-green)/0.05)] p-4 sm:w-auto">
          <span className="text-label mb-3 block text-[10px] text-[hsl(var(--accent-green-bright))]">
            {`// TO`}
          </span>
          <ChainDigest chain={newConnection.chain} simplify />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button
          variant="action-outline"
          size="action"
          onClick={() => {
            setNewConnection(chainsDispatch, { ...newConnection, action: "edit" });
          }}
          className="gap-2"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit Chain
        </Button>
        <Button
          variant="action"
          size="action"
          onClick={() => {
            setChain(chainsDispatch, newConnection.chain);
            closeDialog();
            router.push("/");
          }}
          className="gap-2"
        >
          <Plug className="h-3.5 w-3.5" />
          Connect
        </Button>
      </div>
    </div>
  );
}
