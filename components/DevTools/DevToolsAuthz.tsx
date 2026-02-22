import { ChainInfo } from "@/context/ChainsContext/types";
import { DeploymentLogDraft } from "@/lib/deploymentLog";
import { aminoConverters, EXEC_INNER_CODECS } from "@/lib/msg";
import { toastError, toastSuccess, ensureProtocol } from "@/lib/utils";
import { OfflineSigner } from "@cosmjs/proto-signing";
import { AminoTypes, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz";
import { MsgExec, MsgGrant, MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { MsgSetWithdrawAddress, MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { MsgDelegate, MsgUndelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { Timestamp } from "cosmjs-types/google/protobuf/timestamp";
import { KeyRound, Loader2, Play, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { SelectedAccount } from "./types";

type AuthzMode = "grant" | "revoke" | "execute";
type SigningMode = "direct" | "amino";

const EXEC_MSG_TYPES = Object.keys(EXEC_INNER_CODECS);

interface ExistingGrant {
  granter: string;
  grantee: string;
  authorization: { "@type": string; msg?: string };
  expiration: string;
}

interface DevToolsAuthzProps {
  chain: ChainInfo;
  selectedAccount: SelectedAccount | null;
  walletAddress?: string;
  walletType?: "Keplr" | "Ledger" | null;
  getAminoSigner: () => Promise<OfflineSigner | null>;
  getDirectSigner: () => Promise<OfflineSigner | null>;
  onLog: (entry: DeploymentLogDraft) => void;
}

const GRANT_TYPES = [
  "/cosmos.staking.v1beta1.MsgDelegate",
  "/cosmos.staking.v1beta1.MsgUndelegate",
  "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
  "/cosmos.distribution.v1beta1.MsgSetWithdrawAddress",
  "/cosmos.bank.v1beta1.MsgSend",
  "/cosmos.authz.v1beta1.MsgExec",
  "/coreum.asset.nft.v1.MsgBurn",
];

export default function DevToolsAuthz({
  chain,
  selectedAccount,
  walletAddress,
  walletType,
  getAminoSigner,
  getDirectSigner,
  onLog,
}: DevToolsAuthzProps) {
  const isLedger = walletType === "Ledger";
  const [mode, setMode] = useState<AuthzMode>("grant");
  const [signingMode, setSigningMode] = useState<SigningMode>("amino");
  const [granteeAddress, setGranteeAddress] = useState("");
  const [msgType, setMsgType] = useState(GRANT_TYPES[0]);
  const [customMsgType, setCustomMsgType] = useState("");
  const [expirationDate, setExpirationDate] = useState("2028-01-01");
  const [working, setWorking] = useState(false);
  const [lastTxHash, setLastTxHash] = useState("");
  const [existingGrants, setExistingGrants] = useState<ExistingGrant[]>([]);
  const [selectedRevoke, setSelectedRevoke] = useState<Set<string>>(new Set());
  const [loadingGrants, setLoadingGrants] = useState(false);

  // Execute mode state
  const [execMsgType, setExecMsgType] = useState(EXEC_MSG_TYPES[0]);
  const [execGranterAddress, setExecGranterAddress] = useState("");
  const [execWithdrawAddress, setExecWithdrawAddress] = useState("");
  const [execValidatorAddress, setExecValidatorAddress] = useState("");
  const [execRecipientAddress, setExecRecipientAddress] = useState("");
  const [execAmount, setExecAmount] = useState("");
  const [execDenom, setExecDenom] = useState("");
  const [execClassId, setExecClassId] = useState("");
  const [execTokenId, setExecTokenId] = useState("");

  useEffect(() => {
    if (isLedger && signingMode === "direct") {
      setSigningMode("amino");
    }
  }, [isLedger, signingMode]);

  useEffect(() => {
    if (walletAddress && !execGranterAddress) {
      setExecGranterAddress(walletAddress);
    }
  }, [walletAddress, execGranterAddress]);

  const isWalletSelected =
    selectedAccount?.type === "wallet" && selectedAccount.address === walletAddress;
  const actorAddress = selectedAccount?.address;
  const network = chain.chainId.toLowerCase().includes("testnet") ? "testnet" : "mainnet";

  const activeMsgType = msgType === "custom" ? customMsgType.trim() : msgType;

  const getGrantKey = useCallback((grant: ExistingGrant) => {
    const msg = grant.authorization.msg || grant.authorization["@type"];
    return `${grant.grantee}:${msg}`;
  }, []);

  const fetchGrants = useCallback(async () => {
    if (!actorAddress || !isWalletSelected) return;
    setLoadingGrants(true);
    try {
      const restAddress = ensureProtocol(chain.nodeAddress).replace(":26657", ":1317");
      const response = await fetch(
        `${restAddress}/cosmos/authz/v1beta1/grants/granter/${actorAddress}`,
      );
      const data = (await response.json()) as { grants?: ExistingGrant[] };
      setExistingGrants(data.grants ?? []);
    } catch (error) {
      toastError({
        description: "Failed to load authz grants",
        fullError: error instanceof Error ? error : undefined,
      });
      setExistingGrants([]);
    } finally {
      setLoadingGrants(false);
    }
  }, [actorAddress, chain.nodeAddress, isWalletSelected]);

  useEffect(() => {
    if (mode === "revoke") {
      fetchGrants();
    }
  }, [mode, fetchGrants]);

  const authzAminoTypes = useMemo(() => new AminoTypes(aminoConverters), []);

  const getSigner = async () => {
    if (signingMode === "direct") return getDirectSigner();
    return getAminoSigner();
  };

  const handleGrant = async () => {
    if (!actorAddress || !isWalletSelected) return;
    if (!granteeAddress || !activeMsgType) {
      toastError({ description: "Grantee and msg type are required" });
      return;
    }

    setWorking(true);
    try {
      const signer = await getSigner();
      if (!signer) {
        throw new Error(
          signingMode === "direct"
            ? "Direct signer is unavailable. Switch to Amino mode."
            : "Amino signer is unavailable.",
        );
      }
      const client = await SigningStargateClient.connectWithSigner(ensureProtocol(chain.nodeAddress), signer, {
        gasPrice: GasPrice.fromString(chain.gasPrice),
        aminoTypes: authzAminoTypes,
      });
      const expirySeconds = BigInt(
        Math.floor(new Date(`${expirationDate}T00:00:00Z`).getTime() / 1000),
      );
      const grantMsg = {
        typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
        value: MsgGrant.fromPartial({
          granter: actorAddress,
          grantee: granteeAddress,
          grant: {
            authorization: {
              typeUrl: "/cosmos.authz.v1beta1.GenericAuthorization",
              value: GenericAuthorization.encode(
                GenericAuthorization.fromPartial({ msg: activeMsgType }),
              ).finish(),
            },
            expiration: Timestamp.fromPartial({ seconds: expirySeconds, nanos: 0 }),
          },
        }),
      };

      const result = await client.signAndBroadcast(actorAddress, [grantMsg], "auto", "DevTools authz grant");
      if (result.code !== 0) {
        throw new Error(result.rawLog || "Grant transaction failed");
      }
      setLastTxHash(result.transactionHash);
      onLog({
        stage: "authz-grant",
        network,
        chainId: chain.chainId,
        wallet: actorAddress,
        txHash: result.transactionHash,
        detail: `${granteeAddress}:${activeMsgType}`,
      });
      toastSuccess("Grant created — switch to the Execute tab to use it", result.transactionHash);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("signature verification failed")) {
        toastError({
          description:
            "Signature verification failed. This can happen if a previous transaction is still pending. " +
            "Wait a few seconds and try again.",
        });
      } else {
        toastError({
          description: "Failed to create authz grant",
          fullError: error instanceof Error ? error : undefined,
        });
      }
    } finally {
      setWorking(false);
    }
  };

  const handleRevoke = async () => {
    if (!actorAddress || !isWalletSelected || selectedRevoke.size === 0) return;
    setWorking(true);
    try {
      const signer = await getSigner();
      if (!signer) {
        throw new Error(
          signingMode === "direct"
            ? "Direct signer is unavailable. Switch to Amino mode."
            : "Amino signer is unavailable.",
        );
      }
      const client = await SigningStargateClient.connectWithSigner(ensureProtocol(chain.nodeAddress), signer, {
        gasPrice: GasPrice.fromString(chain.gasPrice),
        aminoTypes: authzAminoTypes,
      });
      const targets = existingGrants.filter((grant) => selectedRevoke.has(getGrantKey(grant)));
      const revokeMsgs = targets.map((grant) => ({
        typeUrl: "/cosmos.authz.v1beta1.MsgRevoke",
        value: MsgRevoke.fromPartial({
          granter: actorAddress,
          grantee: grant.grantee,
          msgTypeUrl: grant.authorization.msg || "",
        }),
      }));
      const result = await client.signAndBroadcast(
        actorAddress,
        revokeMsgs,
        "auto",
        "DevTools authz revoke",
      );
      if (result.code !== 0) {
        throw new Error(result.rawLog || "Revoke transaction failed");
      }
      setLastTxHash(result.transactionHash);
      onLog({
        stage: "authz-revoke",
        network,
        chainId: chain.chainId,
        wallet: actorAddress,
        txHash: result.transactionHash,
        detail: `revoked:${targets.length}`,
      });
      toastSuccess("Authz grants revoked", result.transactionHash);
      setSelectedRevoke(new Set());
      await fetchGrants();
    } catch (error) {
      toastError({
        description: "Failed to revoke grants",
        fullError: error instanceof Error ? error : undefined,
      });
    } finally {
      setWorking(false);
    }
  };

  const buildExecInnerMsg = useCallback((): { typeUrl: string; encoded: Uint8Array } | null => {
    const granter = execGranterAddress.trim();
    if (!granter) return null;

    switch (execMsgType) {
      case "/cosmos.distribution.v1beta1.MsgSetWithdrawAddress": {
        const addr = execWithdrawAddress.trim();
        if (!addr) return null;
        const msg = MsgSetWithdrawAddress.fromPartial({ delegatorAddress: granter, withdrawAddress: addr });
        return { typeUrl: execMsgType, encoded: MsgSetWithdrawAddress.encode(msg).finish() };
      }
      case "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward": {
        const val = execValidatorAddress.trim();
        if (!val) return null;
        const msg = MsgWithdrawDelegatorReward.fromPartial({ delegatorAddress: granter, validatorAddress: val });
        return { typeUrl: execMsgType, encoded: MsgWithdrawDelegatorReward.encode(msg).finish() };
      }
      case "/cosmos.staking.v1beta1.MsgDelegate":
      case "/cosmos.staking.v1beta1.MsgUndelegate": {
        const val = execValidatorAddress.trim();
        const amt = execAmount.trim();
        const denom = execDenom.trim() || chain.displayDenom?.toLowerCase() || "uatom";
        if (!val || !amt) return null;
        const partial = { delegatorAddress: granter, validatorAddress: val, amount: { denom, amount: amt } };
        if (execMsgType.includes("Delegate") && !execMsgType.includes("Undelegate")) {
          const msg = MsgDelegate.fromPartial(partial);
          return { typeUrl: execMsgType, encoded: MsgDelegate.encode(msg).finish() };
        }
        const msg = MsgUndelegate.fromPartial(partial);
        return { typeUrl: execMsgType, encoded: MsgUndelegate.encode(msg).finish() };
      }
      case "/cosmos.bank.v1beta1.MsgSend": {
        const to = execRecipientAddress.trim();
        const amt = execAmount.trim();
        const denom = execDenom.trim() || chain.displayDenom?.toLowerCase() || "uatom";
        if (!to || !amt) return null;
        const msg = MsgSend.fromPartial({ fromAddress: granter, toAddress: to, amount: [{ denom, amount: amt }] });
        return { typeUrl: execMsgType, encoded: MsgSend.encode(msg).finish() };
      }
      case "/coreum.asset.nft.v1.MsgBurn": {
        const classId = execClassId.trim();
        const tokenId = execTokenId.trim();
        if (!classId || !tokenId) return null;
        const codec = EXEC_INNER_CODECS[execMsgType];
        const burnMsg = codec.fromAmino({ sender: granter, class_id: classId, id: tokenId });
        return { typeUrl: execMsgType, encoded: codec.encode(burnMsg).finish() };
      }
      default:
        return null;
    }
  }, [execMsgType, execGranterAddress, execWithdrawAddress, execValidatorAddress, execRecipientAddress, execAmount, execDenom, execClassId, execTokenId, chain.displayDenom]);

  const handleExecute = async () => {
    if (!actorAddress || !isWalletSelected) return;
    const innerMsg = buildExecInnerMsg();
    if (!innerMsg) {
      toastError({ description: "Fill in all required fields" });
      return;
    }

    setWorking(true);
    try {
      const signer = await getSigner();
      if (!signer) {
        throw new Error(
          signingMode === "direct"
            ? "Direct signer is unavailable. Switch to Amino mode."
            : "Amino signer is unavailable.",
        );
      }
      const client = await SigningStargateClient.connectWithSigner(ensureProtocol(chain.nodeAddress), signer, {
        gasPrice: GasPrice.fromString(chain.gasPrice),
        aminoTypes: authzAminoTypes,
      });

      const execMsg = {
        typeUrl: "/cosmos.authz.v1beta1.MsgExec",
        value: MsgExec.fromPartial({
          grantee: actorAddress,
          msgs: [{ typeUrl: innerMsg.typeUrl, value: innerMsg.encoded }],
        }),
      };

      const result = await client.signAndBroadcast(actorAddress, [execMsg], "auto", "DevTools authz exec");
      if (result.code !== 0) {
        throw new Error(result.rawLog || "Authz exec transaction failed");
      }
      setLastTxHash(result.transactionHash);
      onLog({
        stage: "authz-grant",
        network,
        chainId: chain.chainId,
        wallet: actorAddress,
        txHash: result.transactionHash,
        detail: `exec:${innerMsg.typeUrl} granter:${execGranterAddress}`,
      });
      toastSuccess("Authz exec successful", result.transactionHash);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("authorization not found")) {
        toastError({
          description:
            `No grant exists for grantee ${actorAddress} from granter ${execGranterAddress.trim()} ` +
            `for ${execMsgType.split(".").pop()}. ` +
            `Switch to the Grant tab and create the grant first, then come back here to execute.`,
        });
      } else {
        toastError({
          description: "Failed to execute authz message",
          fullError: error instanceof Error ? error : undefined,
        });
      }
    } finally {
      setWorking(false);
    }
  };

  const canGrant = useMemo(() => isWalletSelected && !!granteeAddress && !!activeMsgType, [
    isWalletSelected,
    granteeAddress,
    activeMsgType,
  ]);

  const canExecute = useMemo(() => isWalletSelected && !!buildExecInnerMsg(), [
    isWalletSelected,
    buildExecInnerMsg,
  ]);

  return (
    <Card variant="institutional" bracket="purple-round" className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <KeyRound className="h-5 w-5 text-purple-accent" />
          Authz Manager
        </CardTitle>
        <CardDescription>
          Grant, revoke, and execute delegated permissions with direct or amino signing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isWalletSelected && (
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            Select your connected wallet account to manage authz permissions.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant={mode === "grant" ? "default" : "outline"} size="sm" onClick={() => setMode("grant")}>
            Grant
          </Button>
          <Button variant={mode === "execute" ? "default" : "outline"} size="sm" onClick={() => setMode("execute")}>
            Execute
          </Button>
          <Button variant={mode === "revoke" ? "default" : "outline"} size="sm" onClick={() => setMode("revoke")}>
            Revoke
          </Button>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>Signer</span>
            <Button
              variant={signingMode === "direct" ? "default" : "outline"}
              size="sm"
              onClick={() => setSigningMode("direct")}
              disabled={isLedger}
              title={isLedger ? "Ledger does not support Direct signing" : undefined}
            >
              Direct
            </Button>
            <Button
              variant={signingMode === "amino" ? "default" : "outline"}
              size="sm"
              onClick={() => setSigningMode("amino")}
            >
              Amino
            </Button>
          </div>
        </div>

        {mode === "grant" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">Step 1 of 2 — Grant Permission</p>
              Allow another address (the grantee) to perform a specific action on your behalf.
              After granting, switch to the <button type="button" onClick={() => setMode("execute")} className="font-semibold text-purple-accent underline underline-offset-2">Execute</button> tab
              to carry out the action (e.g. set a withdrawal address).
            </div>
            <div className="space-y-2">
              <Label htmlFor="authz-grantee">Grantee Address</Label>
              <Input
                id="authz-grantee"
                value={granteeAddress}
                onChange={(event) => setGranteeAddress(event.target.value)}
                placeholder={`${chain.addressPrefix}1...`}
                variant="institutional"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Message Type</Label>
                <Select value={msgType} onValueChange={setMsgType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRANT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="authz-expiration">Expiration Date</Label>
                <Input
                  id="authz-expiration"
                  type="date"
                  value={expirationDate}
                  onChange={(event) => setExpirationDate(event.target.value)}
                />
              </div>
            </div>
            {msgType === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="authz-custom-type">Custom Message Type</Label>
                <Input
                  id="authz-custom-type"
                  value={customMsgType}
                  onChange={(event) => setCustomMsgType(event.target.value)}
                  placeholder="/cosmos.bank.v1beta1.MsgSend"
                  variant="institutional"
                />
              </div>
            )}
            <Button
              variant="action"
              className="w-full gap-2"
              onClick={handleGrant}
              disabled={!canGrant || working}
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {working ? "Granting..." : "Grant Permission"}
            </Button>
          </div>
        )}

        {mode === "execute" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">Step 2 of 2 — Execute on Behalf</p>
              Use an existing grant to perform an action as the granter.
              Your connected wallet is the <strong>grantee</strong> (executor).
              The <strong>granter</strong> is the account that gave you permission.
              {execMsgType === "/cosmos.distribution.v1beta1.MsgSetWithdrawAddress" && (
                <span className="mt-1 block">
                  The <strong>withdrawal address</strong> below is where rewards will be sent — it can be any address
                  (a different wallet, a smart contract, etc.), independent of both granter and grantee.
                </span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="exec-granter">Granter Address</Label>
                {walletAddress && execGranterAddress !== walletAddress && (
                  <button
                    type="button"
                    onClick={() => setExecGranterAddress(walletAddress)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Use my wallet
                  </button>
                )}
              </div>
              <Input
                id="exec-granter"
                value={execGranterAddress}
                onChange={(event) => setExecGranterAddress(event.target.value)}
                placeholder={`${chain.addressPrefix}1... (account that granted permission)`}
                variant="institutional"
              />
              {execGranterAddress === walletAddress && (
                <p className="text-xs text-muted-foreground">
                  Pre-filled with your wallet. Change if executing on behalf of a different account.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Message to Execute</Label>
              <Select value={execMsgType} onValueChange={setExecMsgType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXEC_MSG_TYPES.map((type) => {
                    const short = type.split(".").pop() || type;
                    return (
                      <SelectItem key={type} value={type}>
                        {short}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {execMsgType === "/cosmos.distribution.v1beta1.MsgSetWithdrawAddress" && (
              <div className="space-y-2 rounded-lg border border-purple-accent/30 bg-purple-accent/5 p-3">
                <Label htmlFor="exec-withdraw-addr" className="text-sm font-semibold">
                  Withdrawal Address
                </Label>
                <Input
                  id="exec-withdraw-addr"
                  value={execWithdrawAddress}
                  onChange={(event) => setExecWithdrawAddress(event.target.value)}
                  placeholder={`${chain.addressPrefix}1... (contract, wallet, or any address)`}
                  variant="institutional"
                />
                <p className="text-xs text-muted-foreground">
                  This is the destination for staking rewards — separate from both the granter and your wallet.
                </p>
              </div>
            )}

            {execMsgType === "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward" && (
              <div className="space-y-2">
                <Label htmlFor="exec-val-addr">Validator Address</Label>
                <Input
                  id="exec-val-addr"
                  value={execValidatorAddress}
                  onChange={(event) => setExecValidatorAddress(event.target.value)}
                  placeholder={`${chain.addressPrefix}valoper1...`}
                  variant="institutional"
                />
              </div>
            )}

            {(execMsgType === "/cosmos.staking.v1beta1.MsgDelegate" ||
              execMsgType === "/cosmos.staking.v1beta1.MsgUndelegate") && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="exec-stake-val">Validator Address</Label>
                  <Input
                    id="exec-stake-val"
                    value={execValidatorAddress}
                    onChange={(event) => setExecValidatorAddress(event.target.value)}
                    placeholder={`${chain.addressPrefix}valoper1...`}
                    variant="institutional"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="exec-amount">Amount</Label>
                    <Input
                      id="exec-amount"
                      value={execAmount}
                      onChange={(event) => setExecAmount(event.target.value)}
                      placeholder="1000000"
                      variant="institutional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exec-denom">Denom</Label>
                    <Input
                      id="exec-denom"
                      value={execDenom}
                      onChange={(event) => setExecDenom(event.target.value)}
                      placeholder={chain.displayDenom?.toLowerCase() || "uatom"}
                      variant="institutional"
                    />
                  </div>
                </div>
              </div>
            )}

            {execMsgType === "/cosmos.bank.v1beta1.MsgSend" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="exec-recipient">Recipient Address</Label>
                  <Input
                    id="exec-recipient"
                    value={execRecipientAddress}
                    onChange={(event) => setExecRecipientAddress(event.target.value)}
                    placeholder={`${chain.addressPrefix}1...`}
                    variant="institutional"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="exec-send-amount">Amount</Label>
                    <Input
                      id="exec-send-amount"
                      value={execAmount}
                      onChange={(event) => setExecAmount(event.target.value)}
                      placeholder="1000000"
                      variant="institutional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exec-send-denom">Denom</Label>
                    <Input
                      id="exec-send-denom"
                      value={execDenom}
                      onChange={(event) => setExecDenom(event.target.value)}
                      placeholder={chain.displayDenom?.toLowerCase() || "uatom"}
                      variant="institutional"
                    />
                  </div>
                </div>
              </div>
            )}

            {execMsgType === "/coreum.asset.nft.v1.MsgBurn" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="exec-class-id">Class ID</Label>
                  <Input
                    id="exec-class-id"
                    value={execClassId}
                    onChange={(event) => setExecClassId(event.target.value)}
                    placeholder="e.g. MYSYMBOL-core1abc..."
                    variant="institutional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exec-token-id">Token ID</Label>
                  <Input
                    id="exec-token-id"
                    value={execTokenId}
                    onChange={(event) => setExecTokenId(event.target.value)}
                    placeholder="e.g. Member005"
                    variant="institutional"
                  />
                </div>
              </div>
            )}

            <Button
              variant="action"
              className="w-full gap-2"
              onClick={handleExecute}
              disabled={!canExecute || working}
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {working ? "Executing..." : "Execute via Authz"}
            </Button>
          </div>
        )}

        {mode === "revoke" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Existing Grants</p>
              <Button variant="outline" size="sm" onClick={fetchGrants} disabled={loadingGrants}>
                Refresh
              </Button>
            </div>
            {loadingGrants ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading grants...
              </div>
            ) : existingGrants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No grants found for the selected wallet.</p>
            ) : (
              <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1">
                {existingGrants.map((grant) => {
                  const key = getGrantKey(grant);
                  const selected = selectedRevoke.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() =>
                        setSelectedRevoke((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        })
                      }
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selected
                          ? "border-destructive/60 bg-destructive/10"
                          : "border-border bg-card/40 hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-xs break-all">{grant.grantee}</p>
                        {selected && <Badge variant="destructive">Selected</Badge>}
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
                        {grant.authorization.msg || grant.authorization["@type"]}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={handleRevoke}
              disabled={selectedRevoke.size === 0 || working || !isWalletSelected}
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
              {working ? "Revoking..." : `Revoke Selected (${selectedRevoke.size})`}
            </Button>
          </div>
        )}

        {lastTxHash && (
          <div className="rounded-lg border border-green-accent/30 bg-green-accent/10 p-3">
            <p className="text-xs font-semibold text-green-accent">Last Transaction</p>
            <p className="font-mono text-xs text-muted-foreground break-all">{lastTxHash}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
