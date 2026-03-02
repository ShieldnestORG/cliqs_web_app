import { ChainInfo } from "@/context/ChainsContext/types";
import { DeploymentLogDraft } from "@/lib/deploymentLog";
import { toastError, toastSuccess } from "@/lib/utils";
import { OfflineSigner } from "@cosmjs/proto-signing";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import { Loader2, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { SelectedAccount } from "./types";

interface DevToolsUploaderProps {
  chain: ChainInfo;
  selectedAccount: SelectedAccount | null;
  walletAddress?: string;
  getAminoSigner: () => Promise<OfflineSigner | null>;
  onLog: (entry: DeploymentLogDraft) => void;
}

interface UploadResult {
  codeId: number;
  txHash: string;
}

export default function DevToolsUploader({
  chain,
  selectedAccount,
  walletAddress,
  getAminoSigner,
  onLog,
}: DevToolsUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const canUpload = selectedAccount?.type === "wallet" && selectedAccount.address === walletAddress;
  const network = chain.chainId.toLowerCase().includes("testnet") ? "testnet" : "mainnet";

  const fileSize = useMemo(() => {
    if (!file) return "";
    const bytes = file.size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }, [file]);

  const onFileChange = async (nextFile: File | null) => {
    if (!nextFile) {
      setFile(null);
      setFileBytes(null);
      setUploadResult(null);
      return;
    }
    if (!nextFile.name.endsWith(".wasm")) {
      toastError({ description: "Please select a .wasm file" });
      return;
    }
    const arrayBuffer = await nextFile.arrayBuffer();
    setFile(nextFile);
    setFileBytes(new Uint8Array(arrayBuffer));
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!canUpload || !selectedAccount || !fileBytes) return;
    setIsUploading(true);
    try {
      const signer = await getAminoSigner();
      if (!signer) throw new Error("No signer available");

      const client = await SigningCosmWasmClient.connectWithSigner(chain.nodeAddress, signer, {
        gasPrice: GasPrice.fromString(chain.gasPrice),
      });
      const result = await client.upload(
        selectedAccount.address,
        fileBytes,
        "auto",
        `DevTools upload: ${file?.name ?? "contract.wasm"}`,
      );

      setUploadResult({ codeId: result.codeId, txHash: result.transactionHash });
      onLog({
        stage: "upload",
        network,
        chainId: chain.chainId,
        wallet: selectedAccount.address,
        contractType: "wasm",
        label: file?.name,
        codeId: result.codeId,
        txHash: result.transactionHash,
      });
      toastSuccess("WASM uploaded successfully", result.transactionHash);
    } catch (error) {
      toastError({
        description: "WASM upload failed",
        fullError: error instanceof Error ? error : undefined,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card variant="institutional" bracket="green-round" className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <UploadCloud className="h-5 w-5 text-green-accent" />
          Upload WASM
        </CardTitle>
        <CardDescription>
          Upload compiled contract binaries directly from the developer console.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="wasm-upload">Contract Binary</Label>
          <input
            id="wasm-upload"
            type="file"
            accept=".wasm,application/wasm"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold"
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              {file.name} {fileSize ? `(${fileSize})` : ""}
            </p>
          )}
        </div>

        {!canUpload && (
          <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Select your connected wallet account to upload contract code.
          </p>
        )}

        {uploadResult && (
          <div className="rounded-lg border border-green-accent/30 bg-green-accent/10 p-3 text-sm">
            <p className="font-semibold text-green-accent">Upload Complete</p>
            <p className="text-xs text-muted-foreground">Code ID: {uploadResult.codeId}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {uploadResult.txHash}
            </p>
          </div>
        )}

        <Button
          variant="action"
          className="w-full gap-2"
          onClick={handleUpload}
          disabled={isUploading || !fileBytes || !canUpload}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          {isUploading ? "Uploading..." : "Upload to Chain"}
        </Button>
      </CardContent>
    </Card>
  );
}
