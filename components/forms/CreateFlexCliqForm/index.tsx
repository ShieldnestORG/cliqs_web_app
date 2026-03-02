/**
 * Create Flex Cliq Form — Full Wizard
 *
 * File: components/forms/CreateFlexCliqForm/index.tsx
 *
 * Six-step wizard for creating a CW3-Flex + CW4-Group contract pair:
 *   1. Setup    – name, description
 *   2. Members  – addresses + weights
 *   3. Settings – threshold, voting period, group admin type
 *   4. Review   – verify everything before chain interaction
 *   5. Deploy   – upload WASMs, instantiate contracts, transfer admin
 *   6. Complete – result, download backup, retention notice
 *
 * Deploy flow:
 *   1. Upload CW4-Group WASM  (or skip if code ID provided)
 *   2. Upload CW3-Flex WASM   (or skip if code ID provided)
 *   3. Optional wallet switch
 *   4. Instantiate CW4-Group with initial members
 *   5. Instantiate CW3-Flex pointing to the group
 *   6. Transfer group admin to multisig (if applicable)
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardLabel,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toastError, ensureProtocol } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import {
  Shield,
  ShieldPlus,
  UserPlus,
  FileText,
  UsersRound,
  Check,
  ChevronRight,
  ChevronLeft,
  Clock,
  Loader2,
  Trash2,
  AlertCircle,
  Info,
  UploadCloud,
  Eye,
  Download,
  Wallet,
  Rocket,
  CheckCircle2,
  Copy,
  ExternalLink,
  Settings,
  Users,
  Link2,
} from "lucide-react";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { CW3Client } from "@/lib/contract/cw3-client";
import { CW4Client } from "@/lib/contract/cw4-client";
import {
  getCodeIdsForChain,
  getCodeIdSuggestions,
  validateCodeId,
  saveUserCodeIds,
  getChainConstraints,
  queryChainConstraints,
  getGasAdjustment,
  type CodeIdSuggestion,
  type ChainDeploymentConstraints,
} from "@/lib/contract/codeRegistry";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import {
  getCreateFlexCliqSchema,
  defaultFlexCliqFormValues,
  CreateFlexCliqFormValues,
  votingPeriodToSeconds,
  calculateTotalWeight,
  getGroupAdminDescription,
  GroupAdminType,
} from "./formSchema";
import { toast } from "sonner";
import { loadBundledWasm, formatWasmSize } from "@/lib/contract/bundledWasm";
import { validateWasm, type WasmValidationResult } from "@/lib/contract/wasmValidator";
import { getRetentionDays } from "@/lib/dataRetention";

// ============================================================================
// Types
// ============================================================================

type WizardStep = "setup" | "members" | "settings" | "review" | "deploy" | "complete";

const WIZARD_STEPS: WizardStep[] = ["setup", "members", "settings", "review", "deploy", "complete"];

const STEP_LABELS: Record<WizardStep, string> = {
  setup: "Setup",
  members: "Members",
  settings: "Settings",
  review: "Review",
  deploy: "Deploy",
  complete: "Done",
};

type FlexDeployPhase =
  | "idle"
  | "uploading-cw4"
  | "uploading-cw3"
  | "uploaded"
  | "instantiating-group"
  | "instantiating-flex"
  | "transferring-admin"
  | "done"
  | "error";

interface FlexDeployResult {
  multisigAddress: string;
  groupAddress: string;
  cw3CodeId: number;
  cw4CodeId: number;
  multisigTxHash: string;
  groupTxHash: string;
  cw3UploadTxHash?: string;
  cw4UploadTxHash?: string;
  adminTransferTxHash?: string;
}

// ============================================================================
// Component
// ============================================================================

export default function CreateFlexCliqForm() {
  const router = useRouter();
  const { chain } = useChains();
  const { walletInfo, getDirectSigner, getAminoSigner, disconnect } = useWallet();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>("setup");
  const currentStepIndex = WIZARD_STEPS.indexOf(currentStep);

  // Deploy state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deployResult, setDeployResult] = useState<FlexDeployResult | null>(null);
  const [wasmSource, setWasmSource] = useState<"bundled" | "custom">("bundled");
  const [customCw3File, setCustomCw3File] = useState<File | null>(null);
  const [customCw3Bytes, setCustomCw3Bytes] = useState<Uint8Array | null>(null);
  const [customCw4File, setCustomCw4File] = useState<File | null>(null);
  const [customCw4Bytes, setCustomCw4Bytes] = useState<Uint8Array | null>(null);
  const [showWalletSwitch, setShowWalletSwitch] = useState(false);
  const [uploadedCw3CodeId, setUploadedCw3CodeId] = useState<number | null>(null);
  const [uploadedCw4CodeId, setUploadedCw4CodeId] = useState<number | null>(null);
  const [deployPhase, setDeployPhase] = useState<FlexDeployPhase>("idle");
  const [deployError, setDeployError] = useState<string | null>(null);
  const [wasmValidation, setWasmValidation] = useState<WasmValidationResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cw3Suggestions, setCw3Suggestions] = useState<CodeIdSuggestion[]>([]);
  const [cw4Suggestions, setCw4Suggestions] = useState<CodeIdSuggestion[]>([]);
  const [cw3Status, setCw3Status] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [cw4Status, setCw4Status] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [cw3Error, setCw3Error] = useState<string | null>(null);
  const [cw4Error, setCw4Error] = useState<string | null>(null);

  // Chain config
  const registryCodeIds = getCodeIdsForChain(chain.chainId);
  const [chainConstraints, setChainConstraints] = useState<ChainDeploymentConstraints | undefined>(
    () => getChainConstraints(chain.chainId),
  );
  const isLedger = walletInfo?.type === "Ledger";

  const formSchema = useMemo(() => getCreateFlexCliqSchema(chain), [chain]);

  const form = useForm<CreateFlexCliqFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...(defaultFlexCliqFormValues as unknown as CreateFlexCliqFormValues),
      cw3FlexCodeId:
        registryCodeIds?.cw3Flex || (0 as unknown as CreateFlexCliqFormValues["cw3FlexCodeId"]),
      cw4GroupCodeId:
        registryCodeIds?.cw4Group || (0 as unknown as CreateFlexCliqFormValues["cw4GroupCodeId"]),
    },
    mode: "onBlur",
  });

  // ---------- effects ----------

  useEffect(() => {
    setCw3Suggestions(getCodeIdSuggestions(chain.chainId, "cw3-flex"));
    setCw4Suggestions(getCodeIdSuggestions(chain.chainId, "cw4-group"));
    const currentCw3 = form.getValues("cw3FlexCodeId");
    const currentCw4 = form.getValues("cw4GroupCodeId");
    if ((!currentCw3 || currentCw3 < 1) && registryCodeIds?.cw3Flex) {
      form.setValue("cw3FlexCodeId", registryCodeIds.cw3Flex);
    }
    if ((!currentCw4 || currentCw4 < 1) && registryCodeIds?.cw4Group) {
      form.setValue("cw4GroupCodeId", registryCodeIds.cw4Group);
    }
    setCw3Status("idle");
    setCw4Status("idle");
    setCw3Error(null);
    setCw4Error(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.chainId]);

  useEffect(() => {
    setChainConstraints(getChainConstraints(chain.chainId));
    if (chain.nodeAddress) {
      queryChainConstraints(ensureProtocol(chain.nodeAddress), chain.chainId)
        .then((live) => setChainConstraints(live))
        .catch(() => {});
    }
  }, [chain.chainId, chain.nodeAddress]);

  // Validate CW3-Flex code ID (only in advanced mode)
  const watchedCw3CodeId = form.watch("cw3FlexCodeId");
  useEffect(() => {
    if (!showAdvanced || !watchedCw3CodeId || watchedCw3CodeId < 1 || !chain.nodeAddress) {
      setCw3Status("idle");
      setCw3Error(null);
      return;
    }
    setCw3Status("validating");
    const timer = setTimeout(async () => {
      try {
        const result = await validateCodeId(ensureProtocol(chain.nodeAddress), watchedCw3CodeId);
        setCw3Status(result.exists ? "valid" : "invalid");
        setCw3Error(result.exists ? null : result.error || `Code ID ${watchedCw3CodeId} not found`);
      } catch {
        setCw3Status("invalid");
        setCw3Error(`Failed to validate code ID ${watchedCw3CodeId}`);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [watchedCw3CodeId, chain.nodeAddress, showAdvanced]);

  // Validate CW4-Group code ID (only in advanced mode)
  const watchedCw4CodeId = form.watch("cw4GroupCodeId");
  useEffect(() => {
    if (!showAdvanced || !watchedCw4CodeId || watchedCw4CodeId < 1 || !chain.nodeAddress) {
      setCw4Status("idle");
      setCw4Error(null);
      return;
    }
    setCw4Status("validating");
    const timer = setTimeout(async () => {
      try {
        const result = await validateCodeId(ensureProtocol(chain.nodeAddress), watchedCw4CodeId);
        setCw4Status(result.exists ? "valid" : "invalid");
        setCw4Error(result.exists ? null : result.error || `Code ID ${watchedCw4CodeId} not found`);
      } catch {
        setCw4Status("invalid");
        setCw4Error(`Failed to validate code ID ${watchedCw4CodeId}`);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [watchedCw4CodeId, chain.nodeAddress, showAdvanced]);

  // ---------- form field helpers ----------

  const {
    fields: membersFields,
    append: membersAppend,
    remove: membersRemove,
  } = useFieldArray({ name: "members", control: form.control });

  const watchedMembers = useWatch({ control: form.control, name: "members" });
  const watchedName = useWatch({ control: form.control, name: "name" });
  const watchedDescription = useWatch({ control: form.control, name: "description" });
  const watchedThreshold = useWatch({ control: form.control, name: "threshold" });
  const watchedVotingPeriod = useWatch({ control: form.control, name: "votingPeriodDays" });
  const watchedGroupAdminType = (useWatch({ control: form.control, name: "groupAdminType" }) ||
    "multisig") as GroupAdminType;

  const filledMembers = watchedMembers.filter(({ address }) => address.trim() !== "");
  const filledMembersCount = filledMembers.length;
  const totalWeight = calculateTotalWeight(filledMembers);

  const isSetupComplete = watchedName.trim().length >= 2;
  const isMembersComplete = filledMembersCount >= 2;
  const isSettingsComplete =
    watchedThreshold >= 1 && watchedThreshold <= totalWeight && watchedVotingPeriod >= 0.01;

  const hasExistingCw3 = watchedCw3CodeId > 0 && cw3Status === "valid";
  const hasExistingCw4 = watchedCw4CodeId > 0 && cw4Status === "valid";
  const needsUpload = !hasExistingCw3 || !hasExistingCw4;

  const handleAddMember = useCallback(() => {
    membersAppend({ address: "", weight: 1 }, { shouldFocus: true });
  }, [membersAppend]);

  // ---------- navigation ----------

  const goTo = (step: WizardStep) => setCurrentStep(step);
  const goNext = () => {
    const idx = WIZARD_STEPS.indexOf(currentStep);
    if (idx < WIZARD_STEPS.length - 1) setCurrentStep(WIZARD_STEPS[idx + 1]);
  };
  const goPrev = () => {
    const idx = WIZARD_STEPS.indexOf(currentStep);
    if (idx > 0) setCurrentStep(WIZARD_STEPS[idx - 1]);
  };

  // ---------- custom WASM file handlers ----------

  const onCustomCw3FileChange = async (file: File | null) => {
    if (!file) {
      setCustomCw3File(null);
      setCustomCw3Bytes(null);
      return;
    }
    if (!file.name.endsWith(".wasm")) {
      toast.error("Please select a .wasm file");
      return;
    }
    setCustomCw3File(file);
    setCustomCw3Bytes(new Uint8Array(await file.arrayBuffer()));
  };

  const onCustomCw4FileChange = async (file: File | null) => {
    if (!file) {
      setCustomCw4File(null);
      setCustomCw4Bytes(null);
      return;
    }
    if (!file.name.endsWith(".wasm")) {
      toast.error("Please select a .wasm file");
      return;
    }
    setCustomCw4File(file);
    setCustomCw4Bytes(new Uint8Array(await file.arrayBuffer()));
  };

  // ---------- deploy flow ----------

  const handleDeploy = async () => {
    try {
      setIsSubmitting(true);
      setDeployError(null);
      setDeployPhase("idle");

      const values = form.getValues();

      if (!walletInfo) {
        toast.error("Please connect your wallet first");
        return;
      }
      if (!chain.nodeAddress) {
        toast.error("Chain RPC endpoint not available");
        return;
      }

      const cliqSlug = values.name.trim().toLowerCase().replace(/\s+/g, "-");
      if (!values.groupLabel || values.groupLabel.trim().length < 3) {
        values.groupLabel = `${cliqSlug}-group`;
      }
      if (!values.multisigLabel || values.multisigLabel.trim().length < 3) {
        values.multisigLabel = `${cliqSlug}-multisig`;
      }

      const signer = (await getDirectSigner()) || (await getAminoSigner());
      if (!signer) {
        toast.error("Failed to get wallet signer");
        return;
      }

      const gasAdj = getGasAdjustment(chain.chainId);
      const signingClient = await SigningCosmWasmClient.connectWithSigner(
        ensureProtocol(chain.nodeAddress),
        signer,
        { gasPrice: GasPrice.fromString(chain.gasPrice) },
      );

      let cw4CodeId = uploadedCw4CodeId || (hasExistingCw4 ? watchedCw4CodeId : null);
      let cw3CodeId = uploadedCw3CodeId || (hasExistingCw3 ? watchedCw3CodeId : null);
      let cw4UploadTxHash: string | undefined;
      let cw3UploadTxHash: string | undefined;

      // ---- Upload CW4-Group WASM ----
      if (!cw4CodeId) {
        setDeployPhase("uploading-cw4");
        let wasmBytes: Uint8Array;
        if (wasmSource === "custom" && customCw4Bytes) {
          wasmBytes = customCw4Bytes;
        } else {
          wasmBytes = await loadBundledWasm("cw4-group");
        }

        const validation = validateWasm(wasmBytes, chainConstraints);
        if (!validation.valid) {
          setWasmValidation(validation);
          setDeployError(validation.errors.join("; "));
          setDeployPhase("error");
          toast.error("CW4-Group WASM validation failed", {
            description: validation.errors[0],
            duration: 12000,
          });
          return;
        }

        toast.info("Uploading CW4-Group contract...", {
          description: "Approve the transaction in your wallet",
        });
        const uploadResult = await signingClient.upload(
          walletInfo.address,
          wasmBytes,
          gasAdj,
          "CLIQ cw4-group upload",
        );
        cw4CodeId = uploadResult.codeId;
        cw4UploadTxHash = uploadResult.transactionHash;
        setUploadedCw4CodeId(cw4CodeId);
        toast.success(`CW4-Group uploaded! Code ID: ${cw4CodeId}`);
      }

      // ---- Upload CW3-Flex WASM ----
      if (!cw3CodeId) {
        setDeployPhase("uploading-cw3");
        let wasmBytes: Uint8Array;
        if (wasmSource === "custom" && customCw3Bytes) {
          wasmBytes = customCw3Bytes;
        } else {
          wasmBytes = await loadBundledWasm("cw3-flex");
        }

        const validation = validateWasm(wasmBytes, chainConstraints);
        if (!validation.valid) {
          setWasmValidation(validation);
          setDeployError(validation.errors.join("; "));
          setDeployPhase("error");
          toast.error("CW3-Flex WASM validation failed", {
            description: validation.errors[0],
            duration: 12000,
          });
          return;
        }

        toast.info("Uploading CW3-Flex contract...", {
          description: "Approve the transaction in your wallet",
        });
        const uploadResult = await signingClient.upload(
          walletInfo.address,
          wasmBytes,
          gasAdj,
          "CLIQ cw3-flex upload",
        );
        cw3CodeId = uploadResult.codeId;
        cw3UploadTxHash = uploadResult.transactionHash;
        setUploadedCw3CodeId(cw3CodeId);
        toast.success(`CW3-Flex uploaded! Code ID: ${cw3CodeId}`);
      }

      setDeployPhase("uploaded");

      // Pause for wallet switch if requested
      if (showWalletSwitch && needsUpload) {
        return;
      }

      // ---- Instantiate CW4-Group ----
      setDeployPhase("instantiating-group");
      toast.info("Creating CW4-Group contract...", {
        description: "Approve the transaction in your wallet",
      });

      const instantiateSigner = (await getDirectSigner()) || (await getAminoSigner());
      if (!instantiateSigner) {
        toast.error("Failed to get wallet signer");
        setDeployPhase("error");
        return;
      }
      const instantiateClient = await SigningCosmWasmClient.connectWithSigner(
        ensureProtocol(chain.nodeAddress),
        instantiateSigner,
        { gasPrice: GasPrice.fromString(chain.gasPrice) },
      );

      const members = values.members
        .filter(({ address }) => address.trim() !== "")
        .map(({ address, weight }) => ({ addr: address.trim(), weight }));

      let initialGroupAdmin: string | undefined;
      switch (values.groupAdminType) {
        case "multisig":
          initialGroupAdmin = walletInfo.address;
          break;
        case "custom":
          initialGroupAdmin = values.customAdmin || undefined;
          break;
        case "none":
          initialGroupAdmin = undefined;
          break;
      }

      const cw4Result = await CW4Client.instantiate(
        instantiateClient,
        walletInfo.address,
        cw4CodeId,
        members,
        initialGroupAdmin,
        values.groupLabel,
        gasAdj,
      );

      if (!cw4Result.success || !cw4Result.contractAddress) {
        setDeployError(cw4Result.error || "CW4-Group instantiation failed");
        setDeployPhase("error");
        toast.error("Failed to deploy CW4-Group", { description: cw4Result.error });
        return;
      }
      toast.success(`CW4-Group deployed! ${cw4Result.contractAddress.slice(0, 20)}...`);

      // ---- Instantiate CW3-Flex ----
      setDeployPhase("instantiating-flex");
      toast.info("Creating CW3-Flex multisig...", {
        description: "Approve the transaction in your wallet",
      });

      const maxVotingPeriodSeconds = votingPeriodToSeconds(values.votingPeriodDays);

      const cw3Result = await CW3Client.instantiateFlex(
        instantiateClient,
        walletInfo.address,
        cw3CodeId,
        cw4Result.contractAddress,
        values.threshold,
        maxVotingPeriodSeconds,
        values.multisigLabel,
        values.multisigAdmin || undefined,
        gasAdj,
      );

      if (!cw3Result.success || !cw3Result.contractAddress) {
        setDeployError(cw3Result.error || "CW3-Flex instantiation failed");
        setDeployPhase("error");
        toast.error("Failed to deploy CW3-Flex", { description: cw3Result.error });
        return;
      }
      toast.success(`CW3-Flex deployed! ${cw3Result.contractAddress.slice(0, 20)}...`);

      // ---- Transfer group admin ----
      let adminTransferTxHash: string | undefined;
      if (values.groupAdminType === "multisig") {
        setDeployPhase("transferring-admin");
        toast.info("Transferring group admin to multisig...", {
          description: "Approve the transaction in your wallet",
        });

        const cw4Client = new CW4Client(
          ensureProtocol(chain.nodeAddress),
          cw4Result.contractAddress,
          chain.chainId,
        );
        cw4Client.setSigningClient(instantiateClient, walletInfo.address, gasAdj);
        const adminResult = await cw4Client.updateAdmin(cw3Result.contractAddress);

        if (!adminResult.success) {
          toast.warning("Group admin transfer failed", {
            description: `${adminResult.error || "Unknown error"}. You can transfer admin manually later.`,
          });
        } else {
          adminTransferTxHash = adminResult.txHash;
          toast.success("Group admin transferred to multisig!");
        }
      }

      // ---- Save to DB ----
      try {
        const apiRes = await fetch(`/api/chain/${chain.chainId}/contract-multisig`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codeId: cw3CodeId,
            members,
            threshold: values.threshold,
            maxVotingPeriodSeconds,
            label: values.multisigLabel,
            creator: walletInfo.address,
            nodeAddress: chain.nodeAddress,
            admin: values.multisigAdmin || undefined,
            name: values.name,
            description: values.description,
            contractAddress: cw3Result.contractAddress,
            groupContractAddress: cw4Result.contractAddress,
          }),
        });
        if (!apiRes.ok) console.warn("Failed to save flex multisig to DB:", await apiRes.text());
      } catch (dbError) {
        console.warn("Failed to save flex multisig to DB:", dbError);
      }

      saveUserCodeIds(chain.chainId, { cw3Flex: cw3CodeId, cw4Group: cw4CodeId });

      const result: FlexDeployResult = {
        multisigAddress: cw3Result.contractAddress,
        groupAddress: cw4Result.contractAddress,
        cw3CodeId,
        cw4CodeId,
        multisigTxHash: cw3Result.txHash || "",
        groupTxHash: cw4Result.txHash || "",
        cw3UploadTxHash,
        cw4UploadTxHash,
        adminTransferTxHash,
      };

      setDeployResult(result);
      setDeployPhase("done");
      toast.success("Flex CLIQ created!");
      setCurrentStep("complete");
    } catch (e) {
      console.error("Flex deploy failed:", e);
      setDeployError(e instanceof Error ? e.message : "Unknown error");
      setDeployPhase("error");
      toastError({
        description: "Failed to create Flex CLIQ",
        fullError: e instanceof Error ? e : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueAfterWalletSwitch = async () => {
    setShowWalletSwitch(false);
    await handleDeploy();
  };

  // ---------- download backup ----------

  const handleDownloadBackup = () => {
    if (!deployResult) return;
    const values = form.getValues();
    const backup = {
      version: 1,
      type: "flex",
      exportedAt: new Date().toISOString(),
      chain: { chainId: chain.chainId, chainName: chain.chainDisplayName },
      multisig: {
        contractAddress: deployResult.multisigAddress,
        groupContractAddress: deployResult.groupAddress,
        cw3CodeId: deployResult.cw3CodeId,
        cw4CodeId: deployResult.cw4CodeId,
        name: values.name,
        description: values.description,
        members: values.members
          .filter(({ address }) => address.trim() !== "")
          .map(({ address, weight }) => ({ address: address.trim(), weight })),
        threshold: values.threshold,
        votingPeriodDays: values.votingPeriodDays,
        groupAdminType: values.groupAdminType,
        customAdmin: values.customAdmin || null,
        multisigAdmin: values.multisigAdmin || null,
      },
      transactions: {
        cw4UploadTxHash: deployResult.cw4UploadTxHash || null,
        cw3UploadTxHash: deployResult.cw3UploadTxHash || null,
        groupInstantiateTxHash: deployResult.groupTxHash,
        multisigInstantiateTxHash: deployResult.multisigTxHash,
        adminTransferTxHash: deployResult.adminTransferTxHash || null,
      },
      creator: walletInfo?.address || null,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flex-cliq-${values.name.replace(/\s+/g, "-").toLowerCase()}-${deployResult.multisigAddress.slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ---------- render ----------

  return (
    <Card variant="institutional" bracket="purple" className="overflow-visible">
      <CardHeader>
        <div className="mb-2 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted">
            <Users className="h-7 w-7 text-foreground" />
          </div>
          <div>
            <CardLabel comment className="flex items-center gap-1">
              <ShieldPlus className="h-3 w-3" />
              Flex Contract Multisig
            </CardLabel>
            <CardTitle className="text-2xl">Create Flex Smart Wallet</CardTitle>
          </div>
        </div>
        <CardDescription className="mt-4 space-y-3">
          <span className="block text-base">
            Create a CW3-Flex + CW4-Group multisig on{" "}
            <span className="font-semibold text-foreground">
              {chain.chainDisplayName || "Cosmos"}
            </span>
          </span>
          <span className="block text-sm text-muted-foreground">
            Flex multisigs allow members to be added or removed without changing the multisig
            address. The app uploads and deploys both contracts for you.
          </span>
          {chainConstraints?.permissionedUpload && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
              <div>
                <p className="font-medium text-foreground">Permissioned chain</p>
                <p className="mt-0.5 text-muted-foreground">
                  {chain.chainDisplayName} requires governance approval for contract uploads. You
                  may need to provide existing Code IDs via advanced settings.
                </p>
              </div>
            </div>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            {WIZARD_STEPS.map((step, idx) => {
              const isActive = step === currentStep;
              const isCompleted = idx < currentStepIndex;
              const isClickable =
                idx <= currentStepIndex ||
                (step === "members" && isSetupComplete) ||
                (step === "settings" && isSetupComplete && isMembersComplete) ||
                (step === "review" && isSetupComplete && isMembersComplete && isSettingsComplete);

              return (
                <button
                  key={step}
                  type="button"
                  onClick={() =>
                    isClickable && step !== "complete" && step !== "deploy" ? goTo(step) : undefined
                  }
                  disabled={!isClickable}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "text-foreground"
                      : isCompleted
                        ? "cursor-pointer text-primary"
                        : "text-muted-foreground"
                  } ${isClickable && !isActive ? "cursor-pointer hover:text-foreground" : ""}`}
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isCompleted
                        ? "bg-primary text-primary-foreground"
                        : isActive
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </div>
                  <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
                </button>
              );
            })}
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(currentStepIndex / (WIZARD_STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        <Form {...form}>
          <form id="create-flex-cliq-form" onSubmit={(e) => e.preventDefault()}>
            {/* ============================================================ */}
            {/* STEP 1: SETUP */}
            {/* ============================================================ */}
            {currentStep === "setup" && (
              <div className="space-y-6">
                <div className="mb-6 space-y-1">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    Name Your Flex CLIQ
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Give your group-backed multisig a name and optionally a description
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CLIQ Name</FormLabel>
                      <FormControl>
                        <Input
                          variant="institutional"
                          placeholder="e.g., Treasury Team"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>A memorable name for your CLIQ</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What is this CLIQ for?"
                          className="h-20 resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Advanced settings */}
                <div className="border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                    />
                    Advanced settings
                  </button>

                  {showAdvanced && (
                    <div className="mt-4 space-y-4 border-l-2 border-border pl-6">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="cw4GroupCodeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                CW4-Group Code ID
                                {cw4Status === "validating" && (
                                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                )}
                                {cw4Status === "valid" && (
                                  <Check className="h-3 w-3 text-green-500" />
                                )}
                                {cw4Status === "invalid" && (
                                  <AlertCircle className="h-3 w-3 text-destructive" />
                                )}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  variant="institutional"
                                  placeholder="0 = auto-upload"
                                  {...field}
                                />
                              </FormControl>
                              {cw4Status === "invalid" && cw4Error && (
                                <p className="text-xs text-destructive">{cw4Error}</p>
                              )}
                              {cw4Suggestions.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {cw4Suggestions.map((s) => (
                                    <button
                                      key={`${s.source}-${s.codeId}`}
                                      type="button"
                                      onClick={() => form.setValue("cw4GroupCodeId", s.codeId)}
                                      className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                                        Number(field.value) === s.codeId
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border bg-muted text-muted-foreground hover:bg-muted/80"
                                      }`}
                                    >
                                      <span className="font-mono font-medium">{s.codeId}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              <FormDescription>
                                Leave at 0 to auto-upload bundled CW4-Group
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="cw3FlexCodeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                CW3-Flex Code ID
                                {cw3Status === "validating" && (
                                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                )}
                                {cw3Status === "valid" && (
                                  <Check className="h-3 w-3 text-green-500" />
                                )}
                                {cw3Status === "invalid" && (
                                  <AlertCircle className="h-3 w-3 text-destructive" />
                                )}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  variant="institutional"
                                  placeholder="0 = auto-upload"
                                  {...field}
                                />
                              </FormControl>
                              {cw3Status === "invalid" && cw3Error && (
                                <p className="text-xs text-destructive">{cw3Error}</p>
                              )}
                              {cw3Suggestions.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {cw3Suggestions.map((s) => (
                                    <button
                                      key={`${s.source}-${s.codeId}`}
                                      type="button"
                                      onClick={() => form.setValue("cw3FlexCodeId", s.codeId)}
                                      className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                                        Number(field.value) === s.codeId
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border bg-muted text-muted-foreground hover:bg-muted/80"
                                      }`}
                                    >
                                      <span className="font-mono font-medium">{s.codeId}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              <FormDescription>
                                Leave at 0 to auto-upload bundled CW3-Flex
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="groupLabel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Group Contract Label</FormLabel>
                            <FormControl>
                              <Input
                                variant="institutional"
                                placeholder="Auto-generated from CLIQ name"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              On-chain label for the CW4-Group contract
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="multisigLabel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Multisig Contract Label</FormLabel>
                            <FormControl>
                              <Input
                                variant="institutional"
                                placeholder="Auto-generated from CLIQ name"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              On-chain label for the CW3-Flex contract
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="multisigAdmin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Multisig Contract Admin (optional)</FormLabel>
                            <FormControl>
                              <Input
                                variant="institutional"
                                placeholder="Leave empty for immutable contract"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Address that can migrate the CW3-Flex contract
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="action"
                    size="action"
                    onClick={goNext}
                    disabled={!isSetupComplete}
                    className="gap-2"
                  >
                    Continue to Members <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 2: MEMBERS */}
            {/* ============================================================ */}
            {currentStep === "members" && (
              <div className="space-y-6">
                <div className="mb-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <UsersRound className="h-5 w-5 text-muted-foreground" /> Add Members
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Add wallet addresses with voting weights
                    </p>
                  </div>
                  <div className="rounded-full border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
                    Total Weight: {totalWeight}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>Flex Membership:</strong> Unlike fixed multisigs, members can be added
                    or removed later via proposals (depending on group admin settings).
                  </p>
                </div>

                <div className="space-y-3">
                  {membersFields.map((arrayField, index) => (
                    <div key={arrayField.id} className="flex items-start gap-3">
                      <div className="flex-1">
                        <FormField
                          control={form.control}
                          name={`members.${index}.address`}
                          render={({ field }) => (
                            <FormItem>
                              {index === 0 && <FormLabel>Address</FormLabel>}
                              <FormControl>
                                <Input
                                  variant="institutional"
                                  placeholder={`${chain.addressPrefix}1...`}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="w-24">
                        <FormField
                          control={form.control}
                          name={`members.${index}.weight`}
                          render={({ field }) => (
                            <FormItem>
                              {index === 0 && <FormLabel>Weight</FormLabel>}
                              <FormControl>
                                <Input type="number" min={1} variant="institutional" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      {membersFields.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => membersRemove(index)}
                          className={index === 0 ? "mt-8" : "mt-1"}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMember}
                  className="w-full gap-2"
                >
                  <UserPlus className="h-4 w-4" /> Add Another Member
                </Button>

                {filledMembersCount < 2 && (
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <AlertCircle className="h-3.5 w-3.5 text-yellow-500" /> A CLIQ requires at
                      least 2 members.
                    </p>
                  </div>
                )}

                <div className="flex justify-between border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="action"
                    onClick={goPrev}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button
                    type="button"
                    variant="action"
                    size="action"
                    onClick={goNext}
                    disabled={!isMembersComplete}
                    className="gap-2"
                  >
                    Continue to Settings <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 3: SETTINGS */}
            {/* ============================================================ */}
            {currentStep === "settings" && (
              <div className="space-y-6">
                <div className="mb-6 space-y-1">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Shield className="h-5 w-5 text-muted-foreground" /> Governance Settings
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Configure voting rules and membership control
                  </p>
                </div>

                {/* Threshold */}
                <FormField
                  control={form.control}
                  name="threshold"
                  render={({ field }) => {
                    const maxThreshold = Math.max(1, totalWeight);
                    const currentThreshold = Math.min(Number(field.value) || 1, maxThreshold);
                    return (
                      <FormItem className="space-y-4">
                        <div>
                          <FormLabel className="text-base">Voting Threshold</FormLabel>
                          <FormDescription className="mt-1">
                            Minimum combined weight needed to pass a proposal
                          </FormDescription>
                        </div>
                        <FormControl>
                          <div className="space-y-4">
                            <div className="flex items-center gap-6">
                              <div className="flex-1">
                                <Slider
                                  size="lg"
                                  min={1}
                                  max={maxThreshold || 1}
                                  step={1}
                                  value={[currentThreshold]}
                                  onValueChange={(v) => field.onChange(v[0])}
                                  disabled={totalWeight < 1}
                                />
                              </div>
                              <div className="flex min-w-[120px] items-center justify-center gap-2 rounded-xl border border-border bg-muted px-4 py-3 shadow-sm">
                                <Shield className="h-5 w-5 text-foreground" />
                                <span className="font-heading text-2xl font-bold text-foreground">
                                  {currentThreshold}
                                </span>
                                <span className="font-medium text-muted-foreground">
                                  / {totalWeight}
                                </span>
                              </div>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                {/* Voting Period */}
                <FormField
                  control={form.control}
                  name="votingPeriodDays"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <div>
                        <FormLabel className="flex items-center gap-2 text-base">
                          <Clock className="h-4 w-4" /> Voting Period
                        </FormLabel>
                        <FormDescription className="mt-1">
                          How long members have to vote on proposals
                        </FormDescription>
                      </div>
                      <FormControl>
                        <div className="flex items-center gap-4">
                          <Input
                            type="number"
                            min={0.01}
                            max={365}
                            step={0.5}
                            variant="institutional"
                            className="w-32"
                            {...field}
                          />
                          <span className="text-muted-foreground">days</span>
                          <span className="text-sm text-muted-foreground">
                            ({Math.floor(Number(field.value) * 24)} hours)
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Group Admin */}
                <div className="border-t border-border pt-4">
                  <FormField
                    control={form.control}
                    name="groupAdminType"
                    render={({ field }) => (
                      <FormItem className="space-y-4">
                        <div>
                          <FormLabel className="flex items-center gap-2 text-base">
                            <Settings className="h-4 w-4" /> Group Admin
                          </FormLabel>
                          <FormDescription className="mt-1">
                            Who can add or remove members
                          </FormDescription>
                        </div>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="multisig" id="admin-multisig" />
                              <Label
                                htmlFor="admin-multisig"
                                className="cursor-pointer font-normal"
                              >
                                Multisig controls membership (recommended)
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="custom" id="admin-custom" />
                              <Label htmlFor="admin-custom" className="cursor-pointer font-normal">
                                Custom admin address
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="none" id="admin-none" />
                              <Label htmlFor="admin-none" className="cursor-pointer font-normal">
                                No admin (immutable membership)
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormDescription>
                          {getGroupAdminDescription(watchedGroupAdminType)}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchedGroupAdminType === "custom" && (
                    <FormField
                      control={form.control}
                      name="customAdmin"
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel>Custom Admin Address</FormLabel>
                          <FormControl>
                            <Input
                              variant="institutional"
                              placeholder={`${chain.addressPrefix}1...`}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="flex justify-between border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="action"
                    onClick={goPrev}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button
                    type="button"
                    variant="action"
                    size="action"
                    onClick={goNext}
                    disabled={!isSettingsComplete}
                    className="gap-2"
                  >
                    Review Configuration <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 4: REVIEW */}
            {/* ============================================================ */}
            {currentStep === "review" && (
              <div className="space-y-6">
                <div className="mb-6 space-y-1">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Eye className="h-5 w-5 text-muted-foreground" /> Review Your Flex CLIQ
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Verify all details. This will deploy 2 contracts on {chain.chainDisplayName}.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Identity */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <FileText className="h-4 w-4" /> Identity
                    </h4>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name</span>
                        <span className="font-medium text-foreground">{watchedName}</span>
                      </div>
                      {watchedDescription && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Description</span>
                          <span className="max-w-[60%] text-right font-medium text-foreground">
                            {watchedDescription}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Chain</span>
                        <span className="font-medium text-foreground">
                          {chain.chainDisplayName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium text-foreground">
                          Flex (CW3-Flex + CW4-Group)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Members */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <UsersRound className="h-4 w-4" /> Members ({filledMembersCount})
                    </h4>
                    <div className="space-y-2">
                      {filledMembers.map(({ address, weight }, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg bg-background/50 px-2 py-1.5 text-sm"
                        >
                          <span className="max-w-[70%] truncate font-mono text-xs text-muted-foreground">
                            {address}
                          </span>
                          <span className="ml-2 shrink-0 font-medium text-foreground">
                            weight {weight}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Governance */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Shield className="h-4 w-4" /> Governance
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="block text-muted-foreground">Threshold</span>
                        <span className="text-lg font-medium text-foreground">
                          {watchedThreshold} / {totalWeight}
                        </span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">Voting Period</span>
                        <span className="text-lg font-medium text-foreground">
                          {watchedVotingPeriod} days
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-border pt-3 text-sm">
                      <span className="text-muted-foreground">Group Admin: </span>
                      <span className="font-medium capitalize text-foreground">
                        {watchedGroupAdminType}
                      </span>
                    </div>
                  </div>

                  {/* Deployment Info */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Rocket className="h-4 w-4" /> Deployment
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CW4-Group Code</span>
                        <span className="font-medium text-foreground">
                          {hasExistingCw4
                            ? `Code ID ${watchedCw4CodeId} (existing)`
                            : wasmSource === "bundled"
                              ? "Bundled (cw-plus v0.16)"
                              : `Custom: ${customCw4File?.name || "—"}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CW3-Flex Code</span>
                        <span className="font-medium text-foreground">
                          {hasExistingCw3
                            ? `Code ID ${watchedCw3CodeId} (existing)`
                            : wasmSource === "bundled"
                              ? "Bundled (cw-plus v0.16)"
                              : `Custom: ${customCw3File?.name || "—"}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transactions</span>
                        <span className="font-medium text-foreground">
                          {(needsUpload ? 2 : 0) +
                            2 +
                            (watchedGroupAdminType === "multisig" ? 1 : 0)}{" "}
                          approvals needed
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Creator</span>
                        <span className="max-w-[60%] truncate font-mono text-xs text-foreground">
                          {walletInfo?.address || "Connect wallet"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* WASM source selector */}
                  {needsUpload && (
                    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <UploadCloud className="h-4 w-4" /> Contract Source
                      </h4>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setWasmSource("bundled")}
                          className={`flex-1 rounded-lg border p-3 text-left text-sm transition-colors ${wasmSource === "bundled" ? "border-primary bg-primary/5 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted/50"}`}
                        >
                          <p className="font-medium">Bundled (recommended)</p>
                          <p className="mt-0.5 text-xs opacity-70">
                            Pre-compiled CW3-Flex + CW4-Group from cw-plus v0.16
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWasmSource("custom")}
                          className={`flex-1 rounded-lg border p-3 text-left text-sm transition-colors ${wasmSource === "custom" ? "border-primary bg-primary/5 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted/50"}`}
                        >
                          <p className="font-medium">Custom WASM</p>
                          <p className="mt-0.5 text-xs opacity-70">
                            Upload your own compiled .wasm files
                          </p>
                        </button>
                      </div>

                      {wasmSource === "custom" && (
                        <div className="space-y-3">
                          {!hasExistingCw4 && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                CW4-Group WASM
                              </Label>
                              <input
                                type="file"
                                accept=".wasm,application/wasm"
                                onChange={(e) => onCustomCw4FileChange(e.target.files?.[0] ?? null)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold"
                              />
                              {customCw4File && (
                                <p className="text-xs text-muted-foreground">
                                  {customCw4File.name} ({formatWasmSize(customCw4File.size)})
                                </p>
                              )}
                            </div>
                          )}
                          {!hasExistingCw3 && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">CW3-Flex WASM</Label>
                              <input
                                type="file"
                                accept=".wasm,application/wasm"
                                onChange={(e) => onCustomCw3FileChange(e.target.files?.[0] ?? null)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold"
                              />
                              {customCw3File && (
                                <p className="text-xs text-muted-foreground">
                                  {customCw3File.name} ({formatWasmSize(customCw3File.size)})
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={showWalletSwitch}
                          onChange={(e) => setShowWalletSwitch(e.target.checked)}
                          className="rounded border-border"
                        />
                        Switch to hardware wallet after upload (before instantiation)
                      </label>

                      {chainConstraints?.supportsBulkMemory === false &&
                        wasmSource === "bundled" && (
                          <div className="mt-3 flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                            <div>
                              <p className="font-medium text-foreground">
                                Check chain compatibility
                              </p>
                              <p className="mt-0.5 text-muted-foreground">
                                {chain.chainDisplayName} does not support bulk-memory WASM opcodes.
                                The bundled binaries will be validated before upload.
                              </p>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>

                <div className="flex justify-between border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="action"
                    onClick={goPrev}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" /> Edit
                  </Button>
                  <Button
                    type="button"
                    variant="action"
                    size="action"
                    onClick={goNext}
                    disabled={
                      !walletInfo ||
                      (wasmSource === "custom" &&
                        needsUpload &&
                        !hasExistingCw4 &&
                        !customCw4Bytes) ||
                      (wasmSource === "custom" && needsUpload && !hasExistingCw3 && !customCw3Bytes)
                    }
                    className="gap-2"
                  >
                    {!walletInfo ? (
                      <>
                        <AlertCircle className="h-4 w-4" /> Connect Wallet First
                      </>
                    ) : (
                      <>
                        Proceed to Deploy <Rocket className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 5: DEPLOY */}
            {/* ============================================================ */}
            {currentStep === "deploy" && (
              <div className="space-y-6">
                <div className="mb-6 space-y-1">
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Rocket className="h-5 w-5 text-muted-foreground" /> Deploy to{" "}
                    {chain.chainDisplayName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {needsUpload
                      ? "The app will upload contract code, then create your group and multisig."
                      : "Using existing Code IDs — creating your group and multisig."}
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Upload CW4-Group */}
                  {!hasExistingCw4 && (
                    <DeployStepItem
                      label="Upload CW4-Group code"
                      active={deployPhase === "uploading-cw4"}
                      done={!!uploadedCw4CodeId}
                      detail={uploadedCw4CodeId ? `Code ID: ${uploadedCw4CodeId}` : undefined}
                    />
                  )}

                  {/* Upload CW3-Flex */}
                  {!hasExistingCw3 && (
                    <DeployStepItem
                      label="Upload CW3-Flex code"
                      active={deployPhase === "uploading-cw3"}
                      done={!!uploadedCw3CodeId}
                      detail={uploadedCw3CodeId ? `Code ID: ${uploadedCw3CodeId}` : undefined}
                    />
                  )}

                  {/* Wallet switch */}
                  {showWalletSwitch && deployPhase === "uploaded" && (
                    <div className="space-y-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
                      <div className="flex items-center gap-3">
                        <Wallet className="h-5 w-5 text-yellow-500" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Switch Wallet (optional)
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Connected:{" "}
                            <span className="font-mono">
                              {walletInfo?.address?.slice(0, 20)}...
                            </span>
                            {walletInfo?.type && <span className="ml-1">({walletInfo.type})</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={disconnect}
                          className="gap-2"
                        >
                          <Wallet className="h-3.5 w-3.5" /> Disconnect & Reconnect
                        </Button>
                        <Button
                          type="button"
                          variant="action"
                          size="sm"
                          onClick={handleContinueAfterWalletSwitch}
                          className="gap-2"
                        >
                          Continue with current wallet <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Instantiate CW4-Group */}
                  <DeployStepItem
                    label="Create CW4-Group contract"
                    active={deployPhase === "instantiating-group"}
                    done={["instantiating-flex", "transferring-admin", "done"].includes(
                      deployPhase,
                    )}
                  />

                  {/* Instantiate CW3-Flex */}
                  <DeployStepItem
                    label="Create CW3-Flex multisig"
                    active={deployPhase === "instantiating-flex"}
                    done={["transferring-admin", "done"].includes(deployPhase)}
                    detail={
                      deployResult ? deployResult.multisigAddress.slice(0, 30) + "..." : undefined
                    }
                  />

                  {/* Transfer admin */}
                  {watchedGroupAdminType === "multisig" && (
                    <DeployStepItem
                      label="Transfer group admin to multisig"
                      active={deployPhase === "transferring-admin"}
                      done={deployPhase === "done"}
                    />
                  )}

                  {/* Error */}
                  {deployPhase === "error" && deployError && (
                    <div className="space-y-3 rounded-xl border border-destructive bg-destructive/5 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Deployment failed</p>
                          <p className="mt-1 text-xs text-muted-foreground">{deployError}</p>
                        </div>
                      </div>
                      {wasmValidation &&
                        !wasmValidation.valid &&
                        wasmValidation.details.hasBulkMemory && (
                          <div className="ml-8 text-xs text-muted-foreground">
                            <p>
                              Bulk-memory opcodes found:{" "}
                              {wasmValidation.details.bulkMemoryOpcodes
                                .map((op) => `${op.name} x${op.count}`)
                                .join(", ")}
                            </p>
                            <p className="mt-1">
                              Use <strong>Custom WASM</strong> compiled with{" "}
                              <code className="rounded bg-muted px-1 py-0.5">
                                {chainConstraints?.optimizerImage || "cosmwasm/optimizer:0.16.1"}
                              </code>
                            </p>
                          </div>
                        )}
                    </div>
                  )}
                </div>

                <div className="flex justify-between border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="action"
                    onClick={goPrev}
                    disabled={isSubmitting}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back to Review
                  </Button>

                  {deployPhase === "idle" || deployPhase === "error" ? (
                    <Button
                      type="button"
                      variant="action"
                      size="action"
                      onClick={handleDeploy}
                      disabled={isSubmitting || !walletInfo || isLedger}
                      className="gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Deploying...
                        </>
                      ) : isLedger ? (
                        <>
                          <AlertCircle className="h-4 w-4" /> Switch to Keplr
                        </>
                      ) : !walletInfo ? (
                        <>
                          <AlertCircle className="h-4 w-4" /> Connect Wallet
                        </>
                      ) : (
                        <>
                          <Rocket className="h-4 w-4" />{" "}
                          {needsUpload ? "Upload & Create Flex CLIQ" : "Create Flex CLIQ"}
                        </>
                      )}
                    </Button>
                  ) : deployPhase === "uploaded" && showWalletSwitch ? (
                    <Button
                      type="button"
                      variant="action"
                      size="action"
                      onClick={handleContinueAfterWalletSwitch}
                      disabled={!walletInfo}
                      className="gap-2"
                    >
                      <Rocket className="h-4 w-4" /> Continue Deployment
                    </Button>
                  ) : null}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 6: COMPLETE */}
            {/* ============================================================ */}
            {currentStep === "complete" && deployResult && (
              <div className="space-y-6">
                <div className="py-4 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-500/30 bg-green-500/10">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">Flex CLIQ Created</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your group-backed multisig is live on {chain.chainDisplayName}
                  </p>
                </div>

                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Multisig Address</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-foreground">
                        {deployResult.multisigAddress.slice(0, 18)}...
                        {deployResult.multisigAddress.slice(-8)}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(deployResult.multisigAddress)}
                        className="rounded p-1 hover:bg-muted"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Group Address</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {deployResult.groupAddress.slice(0, 18)}...
                      {deployResult.groupAddress.slice(-8)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Link2 className="h-3 w-3" /> Linked
                    </span>
                    <span className="text-xs font-medium text-green-600">
                      CW3-Flex references CW4-Group
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Code IDs</span>
                    <span className="font-mono text-xs text-foreground">
                      CW3: {deployResult.cw3CodeId} / CW4: {deployResult.cw4CodeId}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground">Download a backup copy</p>
                      <p className="mt-0.5 text-muted-foreground">
                        Server data is retained for{" "}
                        <span className="font-medium text-foreground">
                          {getRetentionDays()} days
                        </span>{" "}
                        and then automatically deleted. Download a backup to keep your CLIQ details
                        permanently.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="action"
                    size="action"
                    onClick={handleDownloadBackup}
                    className="flex-1 gap-2"
                  >
                    <Download className="h-4 w-4" /> Download Backup
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="action"
                    onClick={() =>
                      router.push(`/${chain.registryName}/${deployResult.multisigAddress}`)
                    }
                    className="flex-1 gap-2"
                  >
                    <ExternalLink className="h-4 w-4" /> Go to CLIQ Dashboard
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function DeployStepItem({
  label,
  active,
  done,
  detail,
}: {
  label: string;
  active: boolean;
  done: boolean;
  detail?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        active
          ? "border-primary bg-primary/5"
          : done
            ? "border-green-500 bg-green-500/5"
            : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-3">
        {active ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : done ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <UploadCloud className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">
            {active ? `${label}...` : done ? label : label}
          </p>
          {detail && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{detail}</p>}
        </div>
      </div>
    </div>
  );
}
