/**
 * Create Contract Cliq Form — Full Wizard
 *
 * File: components/forms/CreateContractCliqForm/index.tsx
 *
 * Six-step wizard for creating a CW3-based contract multisig:
 *   1. Setup    – name, description
 *   2. Members  – addresses + weights
 *   3. Settings – threshold, voting period
 *   4. Review   – verify everything before chain interaction
 *   5. Upload & Deploy – upload WASM, optional wallet switch, instantiate
 *   6. Complete – result, download backup, retention notice
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardLabel } from "@/components/ui/card";
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
import { toastError, ensureProtocol } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
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
  FileCode2,
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
} from "lucide-react";
import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { CW3Client } from "@/lib/contract/cw3-client";
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
  getCreateContractCliqSchema,
  CreateContractCliqFormValues,
  defaultContractCliqFormValues,
  votingPeriodToSeconds,
  calculateTotalWeight,
} from "./formSchema";
import { toast } from "sonner";
import { loadBundledWasm, checkBundledWasmAvailable, formatWasmSize } from "@/lib/contract/bundledWasm";
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

interface DeployResult {
  contractAddress: string;
  codeId: number;
  txHash: string;
  uploadTxHash?: string;
}

// ============================================================================
// Component
// ============================================================================

export default function CreateContractCliqForm() {
  const router = useRouter();
  const { chain } = useChains();
  const { walletInfo, getDirectSigner, getAminoSigner, disconnect } = useWallet();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>("setup");
  const currentStepIndex = WIZARD_STEPS.indexOf(currentStep);

  // Upload / deploy state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [wasmSource, setWasmSource] = useState<"bundled" | "custom">("bundled");
  const [customWasmFile, setCustomWasmFile] = useState<File | null>(null);
  const [customWasmBytes, setCustomWasmBytes] = useState<Uint8Array | null>(null);
  const [bundledAvailable, setBundledAvailable] = useState<boolean>(true);
  const [showWalletSwitch, setShowWalletSwitch] = useState(false);
  const [uploadedCodeId, setUploadedCodeId] = useState<number | null>(null);
  const [uploadTxHash, setUploadTxHash] = useState<string | null>(null);
  const [deployPhase, setDeployPhase] = useState<"idle" | "uploading" | "uploaded" | "instantiating" | "done" | "error">("idle");
  const [deployError, setDeployError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wasmValidation, setWasmValidation] = useState<WasmValidationResult | null>(null);

  // Advanced settings (code ID, label, admin)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [codeIdSuggestions, setCodeIdSuggestions] = useState<CodeIdSuggestion[]>([]);
  const [codeIdStatus, setCodeIdStatus] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [codeIdError, setCodeIdError] = useState<string | null>(null);

  // Chain config
  const registryCodeIds = getCodeIdsForChain(chain.chainId);
  const defaultCodeId = registryCodeIds?.cw3Fixed || 0;
  const [chainConstraints, setChainConstraints] = useState<ChainDeploymentConstraints | undefined>(
    () => getChainConstraints(chain.chainId),
  );
  const isLedger = walletInfo?.type === "Ledger";
  const hasRegistryCodeId = Boolean(registryCodeIds?.cw3Fixed);

  const createContractCliqSchema = getCreateContractCliqSchema(chain);

  const form = useForm<CreateContractCliqFormValues>({
    resolver: zodResolver(createContractCliqSchema),
    defaultValues: {
      ...defaultContractCliqFormValues,
      codeId: defaultCodeId,
    } as CreateContractCliqFormValues,
  });

  // ---------- effects ----------

  useEffect(() => {
    const suggestions = getCodeIdSuggestions(chain.chainId, "cw3-fixed");
    setCodeIdSuggestions(suggestions);
    const currentCodeId = form.getValues("codeId");
    if ((!currentCodeId || currentCodeId < 1) && registryCodeIds?.cw3Fixed) {
      form.setValue("codeId", registryCodeIds.cw3Fixed);
    }
    setCodeIdStatus("idle");
    setCodeIdError(null);
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

  useEffect(() => {
    checkBundledWasmAvailable("cw3-fixed").then(setBundledAvailable);
  }, []);

  // Validate code ID on-chain (debounced) — only when in advanced mode
  const watchedCodeId = useWatch({ control: form.control, name: "codeId" });

  useEffect(() => {
    if (!showAdvanced || !watchedCodeId || watchedCodeId < 1 || !chain.nodeAddress) {
      setCodeIdStatus("idle");
      setCodeIdError(null);
      return;
    }
    setCodeIdStatus("validating");
    setCodeIdError(null);
    const timer = setTimeout(async () => {
      try {
        const result = await validateCodeId(ensureProtocol(chain.nodeAddress), watchedCodeId);
        if (result.exists) {
          setCodeIdStatus("valid");
          setCodeIdError(null);
        } else {
          setCodeIdStatus("invalid");
          setCodeIdError(result.error || `Code ID ${watchedCodeId} not found on chain`);
        }
      } catch {
        setCodeIdStatus("invalid");
        setCodeIdError(`Failed to validate code ID ${watchedCodeId}`);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [watchedCodeId, chain.nodeAddress, showAdvanced]);

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

  const filledMembers = watchedMembers.filter(({ address }) => address.trim() !== "");
  const filledMembersCount = filledMembers.length;
  const totalWeight = calculateTotalWeight(filledMembers);

  const isSetupComplete = watchedName.trim().length >= 2;
  const isMembersComplete = filledMembersCount >= 2;
  const isSettingsComplete = watchedThreshold >= 1 && watchedThreshold <= totalWeight && watchedVotingPeriod >= 0.01;

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

  // ---------- custom WASM file handler ----------

  const onCustomFileChange = async (file: File | null) => {
    if (!file) {
      setCustomWasmFile(null);
      setCustomWasmBytes(null);
      return;
    }
    if (!file.name.endsWith(".wasm")) {
      toast.error("Please select a .wasm file");
      return;
    }
    const arrayBuffer = await file.arrayBuffer();
    setCustomWasmFile(file);
    setCustomWasmBytes(new Uint8Array(arrayBuffer));
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

      // Auto-generate label
      if (!values.label || values.label.trim().length < 3) {
        values.label = `${values.name.trim().toLowerCase().replace(/\s+/g, "-")}-multisig`;
      }

      const signer = await getDirectSigner() || await getAminoSigner();
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

      // ---- Step A: Upload WASM (unless user provided an existing code ID) ----
      let codeId = uploadedCodeId;

      if (!codeId) {
        setDeployPhase("uploading");

        let wasmBytes: Uint8Array;
        if (wasmSource === "custom" && customWasmBytes) {
          wasmBytes = customWasmBytes;
        } else {
          wasmBytes = await loadBundledWasm("cw3-fixed");
        }

        // Validate WASM against chain constraints before uploading
        const validation = validateWasm(wasmBytes, chainConstraints);
        setWasmValidation(validation);

        if (!validation.valid) {
          const errorMsg = validation.errors.join("; ");
          setDeployError(errorMsg);
          setDeployPhase("error");
          toast.error("WASM validation failed", { description: errorMsg, duration: 12000 });
          return;
        }

        if (validation.warnings.length > 0) {
          for (const w of validation.warnings) {
            toast.warning(w, { duration: 8000 });
          }
        }

        toast.info("Uploading CW3-Fixed contract to chain...", {
          description: "Please approve the upload transaction in your wallet",
        });

        const uploadResult = await signingClient.upload(
          walletInfo.address,
          wasmBytes,
          gasAdj,
          `CLIQ cw3-fixed upload`,
        );

        codeId = uploadResult.codeId;
        setUploadedCodeId(codeId);
        setUploadTxHash(uploadResult.transactionHash);

        saveUserCodeIds(chain.chainId, {
          cw3Fixed: codeId,
          source: `CLIQ upload (${new Date().toISOString().slice(0, 10)})`,
        });

        setDeployPhase("uploaded");
        toast.success(`Contract code uploaded! Code ID: ${codeId}`);

        // If user wants to switch wallets, pause here
        if (showWalletSwitch) {
          return;
        }
      }

      // ---- Step B: Instantiate ----
      setDeployPhase("instantiating");
      toast.info("Instantiating CW3-Fixed contract...", {
        description: "Please approve the instantiate transaction in your wallet",
      });

      const members = values.members
        .filter(({ address }) => address.trim() !== "")
        .map(({ address, weight }) => ({ addr: address.trim(), weight }));

      const maxVotingPeriodSeconds = votingPeriodToSeconds(values.votingPeriodDays);

      // Re-acquire signer in case wallet was switched
      const instantiateSigner = await getDirectSigner() || await getAminoSigner();
      if (!instantiateSigner) {
        toast.error("Failed to get wallet signer for instantiation");
        setDeployPhase("error");
        return;
      }

      const instantiateClient = await SigningCosmWasmClient.connectWithSigner(
        ensureProtocol(chain.nodeAddress),
        instantiateSigner,
        { gasPrice: GasPrice.fromString(chain.gasPrice) },
      );

      const result = await CW3Client.instantiate(
        instantiateClient,
        walletInfo.address,
        codeId,
        members,
        values.threshold,
        maxVotingPeriodSeconds,
        values.label,
        values.admin || undefined,
        gasAdj,
      );

      if (!result.success || !result.contractAddress) {
        setDeployError(result.error || "Unknown instantiation error");
        setDeployPhase("error");
        toast.error("Contract instantiation failed", {
          description: result.error || "Unknown error",
        });
        return;
      }

      // ---- Step C: Save to DB ----
      try {
        const apiRes = await fetch(`/api/chain/${chain.chainId}/contract-multisig`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codeId,
            members,
            threshold: values.threshold,
            maxVotingPeriodSeconds,
            label: values.label,
            creator: walletInfo.address,
            nodeAddress: chain.nodeAddress,
            admin: values.admin || undefined,
            name: values.name,
            description: values.description,
            contractAddress: result.contractAddress,
          }),
        });
        if (!apiRes.ok) {
          console.warn("Failed to save contract multisig to DB:", await apiRes.text());
        }
      } catch (dbError) {
        console.warn("Failed to save contract multisig to DB:", dbError);
      }

      saveUserCodeIds(chain.chainId, { cw3Fixed: codeId });

      const deployData: DeployResult = {
        contractAddress: result.contractAddress,
        codeId,
        txHash: result.txHash || "",
        uploadTxHash: uploadTxHash || undefined,
      };

      setDeployResult(deployData);
      setDeployPhase("done");
      toast.success("Contract CLIQ created!");
      setCurrentStep("complete");

    } catch (e) {
      console.error("Deploy failed:", e);
      setDeployError(e instanceof Error ? e.message : "Unknown error");
      setDeployPhase("error");
      toastError({
        description: "Failed to create Contract CLIQ",
        fullError: e instanceof Error ? e : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Continue after wallet switch (instantiate with new wallet)
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
      exportedAt: new Date().toISOString(),
      chain: {
        chainId: chain.chainId,
        chainName: chain.chainDisplayName,
      },
      multisig: {
        contractAddress: deployResult.contractAddress,
        codeId: deployResult.codeId,
        name: values.name,
        description: values.description,
        label: values.label,
        members: values.members
          .filter(({ address }) => address.trim() !== "")
          .map(({ address, weight }) => ({ address: address.trim(), weight })),
        threshold: values.threshold,
        votingPeriodDays: values.votingPeriodDays,
        admin: values.admin || null,
      },
      transactions: {
        uploadTxHash: deployResult.uploadTxHash || null,
        instantiateTxHash: deployResult.txHash,
      },
      creator: walletInfo?.address || null,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cliq-${values.name.replace(/\s+/g, "-").toLowerCase()}-${deployResult.contractAddress.slice(0, 12)}.json`;
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
        <div className="flex items-center gap-4 mb-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border">
            <FileCode2 className="w-7 h-7 text-foreground" />
          </div>
          <div>
            <CardLabel comment className="flex items-center gap-1">
              <ShieldPlus className="h-3 w-3" />
              Contract Multisig
            </CardLabel>
            <CardTitle className="text-2xl">Create Smart Wallet</CardTitle>
          </div>
        </div>
        <CardDescription className="space-y-3 mt-4">
          <span className="block text-base">
            Create a CW3 contract multisig on{" "}
            <span className="font-semibold text-foreground">{chain.chainDisplayName || "Cosmos"}</span>
          </span>
          <span className="block text-sm text-muted-foreground">
            The app uploads and deploys the contract for you. No technical knowledge required.
          </span>
          {chainConstraints?.permissionedUpload && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Permissioned chain</p>
                <p className="text-muted-foreground mt-0.5">
                  {chain.chainDisplayName} requires governance approval for contract uploads. You may need to use an existing Code ID instead.
                </p>
              </div>
            </div>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {WIZARD_STEPS.map((step, idx) => {
              const isActive = step === currentStep;
              const isCompleted = idx < currentStepIndex;
              const isClickable = idx <= currentStepIndex || (
                step === "members" && isSetupComplete
              ) || (
                step === "settings" && isSetupComplete && isMembersComplete
              ) || (
                step === "review" && isSetupComplete && isMembersComplete && isSettingsComplete
              );

              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => isClickable && step !== "complete" && step !== "deploy" ? goTo(step) : undefined}
                  disabled={!isClickable}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "text-foreground"
                      : isCompleted
                        ? "text-primary cursor-pointer"
                        : "text-muted-foreground"
                  } ${isClickable && !isActive ? "hover:text-foreground cursor-pointer" : ""}`}
                >
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isActive
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </div>
                  <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
                </button>
              );
            })}
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${((currentStepIndex) / (WIZARD_STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        <Form {...form}>
          <form id="create-contract-cliq-form" onSubmit={(e) => e.preventDefault()}>

            {/* ============================================================ */}
            {/* STEP 1: SETUP */}
            {/* ============================================================ */}
            {currentStep === "setup" && (
              <div className="space-y-6">
                <div className="space-y-1 mb-6">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    Name Your CLIQ
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Give your multisig a name and optionally a description
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CLIQ Name</FormLabel>
                      <FormControl>
                        <Input variant="institutional" placeholder="e.g., Treasury CLIQ" {...field} />
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
                        <Textarea placeholder="What is this CLIQ for?" className="resize-none h-20" {...field} />
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
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
                    Advanced settings
                  </button>

                  {showAdvanced && (
                    <div className="mt-4 space-y-4 pl-6 border-l-2 border-border">
                      <FormField
                        control={form.control}
                        name="label"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contract Label</FormLabel>
                            <FormControl>
                              <Input variant="institutional" placeholder="Auto-generated from CLIQ name if left empty" {...field} />
                            </FormControl>
                            <FormDescription>On-chain label visible in block explorers. Leave empty to auto-generate.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="codeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              CW3 Code ID (skip upload)
                              {codeIdStatus === "validating" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                              {codeIdStatus === "valid" && <Check className="h-3 w-3 text-green-500" />}
                              {codeIdStatus === "invalid" && <AlertCircle className="h-3 w-3 text-destructive" />}
                            </FormLabel>
                            <FormControl>
                              <Input type="number" variant="institutional" placeholder="Leave at 0 to auto-upload" {...field} />
                            </FormControl>
                            {codeIdStatus === "invalid" && codeIdError && (
                              <p className="text-xs text-destructive">{codeIdError}</p>
                            )}
                            {codeIdStatus === "valid" && (
                              <p className="text-xs text-green-600">Code ID verified on-chain — upload step will be skipped</p>
                            )}
                            {codeIdSuggestions.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {codeIdSuggestions.map((s) => (
                                  <button
                                    key={`${s.source}-${s.codeId}`}
                                    type="button"
                                    onClick={() => form.setValue("codeId", s.codeId)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border transition-colors cursor-pointer ${
                                      Number(field.value) === s.codeId
                                        ? "bg-primary/10 border-primary text-primary"
                                        : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                                    }`}
                                  >
                                    <span className="font-mono font-medium">{s.codeId}</span>
                                    <span className="opacity-70">({s.label})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            <FormDescription>
                              If you already have a CW3-Fixed Code ID on this chain, enter it here to skip the upload step.
                              Leave at 0 to auto-upload the bundled contract.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="admin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Admin Address (optional)</FormLabel>
                            <FormControl>
                              <Input variant="institutional" placeholder="Leave empty to make contract immutable" {...field} />
                            </FormControl>
                            <FormDescription>
                              The admin can upgrade the contract. Leave empty for immutable contracts.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex justify-end pt-4 border-t border-border">
                  <Button type="button" variant="action" size="action" onClick={goNext} disabled={!isSetupComplete} className="gap-2">
                    Continue to Members
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 2: MEMBERS */}
            {/* ============================================================ */}
            {currentStep === "members" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <UsersRound className="h-5 w-5 text-muted-foreground" />
                      Add Members
                    </h3>
                    <p className="text-sm text-muted-foreground">Add wallet addresses with voting weights</p>
                  </div>
                  <div className="text-sm font-medium px-3 py-1.5 bg-muted text-foreground rounded-full border border-border">
                    Total Weight: {totalWeight}
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">
                    <strong>Weighted Voting:</strong> Members with higher weights have more voting power.
                    The threshold is the minimum total weight needed to pass proposals.
                  </p>
                </div>

                <div className="space-y-3">
                  {membersFields.map((arrayField, index) => (
                    <div key={arrayField.id} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <FormField
                          control={form.control}
                          name={`members.${index}.address`}
                          render={({ field }) => (
                            <FormItem>
                              {index === 0 && <FormLabel>Address</FormLabel>}
                              <FormControl>
                                <Input variant="institutional" placeholder={`${chain.addressPrefix}1...`} {...field} />
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
                        <Button type="button" variant="ghost" size="icon" onClick={() => membersRemove(index)} className={index === 0 ? "mt-8" : "mt-1"}>
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button type="button" variant="outline" size="sm" onClick={handleAddMember} className="w-full gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add Another Member
                </Button>

                {filledMembersCount < 2 && (
                  <div className="p-3 bg-muted border border-border rounded-lg">
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                      A CLIQ requires at least 2 members.
                    </p>
                  </div>
                )}

                <div className="flex justify-between pt-4 border-t border-border">
                  <Button type="button" variant="ghost" size="action" onClick={goPrev} className="gap-2">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button type="button" variant="action" size="action" onClick={goNext} disabled={!isMembersComplete} className="gap-2">
                    Continue to Settings
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 3: SETTINGS */}
            {/* ============================================================ */}
            {currentStep === "settings" && (
              <div className="space-y-6">
                <div className="space-y-1 mb-6">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    Governance Settings
                  </h3>
                  <p className="text-sm text-muted-foreground">Configure voting threshold and proposal duration</p>
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
                          <FormDescription className="mt-1">Minimum combined weight needed to pass a proposal</FormDescription>
                        </div>
                        <FormControl>
                          <div className="space-y-4">
                            <div className="flex items-center gap-6">
                              <div className="flex-1">
                                <Slider size="lg" min={1} max={maxThreshold || 1} step={1} value={[currentThreshold]} onValueChange={(values) => field.onChange(values[0])} disabled={totalWeight < 1} />
                              </div>
                              <div className="flex items-center gap-2 px-4 py-3 bg-muted border border-border rounded-xl min-w-[120px] justify-center shadow-sm">
                                <Shield className="h-5 w-5 text-foreground" />
                                <span className="text-2xl font-heading font-bold text-foreground">{currentThreshold}</span>
                                <span className="text-muted-foreground font-medium">/ {totalWeight}</span>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Members with combined weight of <span className="font-semibold text-foreground">{currentThreshold}</span> or more must vote yes to pass
                            </p>
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
                        <FormLabel className="text-base flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Voting Period
                        </FormLabel>
                        <FormDescription className="mt-1">How long members have to vote on proposals</FormDescription>
                      </div>
                      <FormControl>
                        <div className="flex items-center gap-4">
                          <Input type="number" min={0.01} max={365} step={0.5} variant="institutional" className="w-32" {...field} />
                          <span className="text-muted-foreground">days</span>
                          <span className="text-sm text-muted-foreground">({Math.floor(Number(field.value) * 24)} hours)</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-between pt-4 border-t border-border">
                  <Button type="button" variant="ghost" size="action" onClick={goPrev} className="gap-2">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button type="button" variant="action" size="action" onClick={goNext} disabled={!isSettingsComplete} className="gap-2">
                    Review Configuration
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 4: REVIEW */}
            {/* ============================================================ */}
            {currentStep === "review" && (
              <div className="space-y-6">
                <div className="space-y-1 mb-6">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Eye className="h-5 w-5 text-muted-foreground" />
                    Review Your CLIQ
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Verify all details before deploying to {chain.chainDisplayName}. Contract parameters are immutable after deployment.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Identity */}
                  <div className="p-4 bg-muted/30 rounded-xl border border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
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
                          <span className="font-medium text-foreground text-right max-w-[60%]">{watchedDescription}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Chain</span>
                        <span className="font-medium text-foreground">{chain.chainDisplayName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Members */}
                  <div className="p-4 bg-muted/30 rounded-xl border border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <UsersRound className="h-4 w-4" /> Members ({filledMembersCount})
                    </h4>
                    <div className="space-y-2">
                      {filledMembers.map(({ address, weight }, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 bg-background/50 rounded-lg">
                          <span className="font-mono text-xs text-muted-foreground truncate max-w-[70%]">{address}</span>
                          <span className="font-medium text-foreground ml-2 shrink-0">weight {weight}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Governance */}
                  <div className="p-4 bg-muted/30 rounded-xl border border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4" /> Governance
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground block">Threshold</span>
                        <span className="font-medium text-foreground text-lg">{watchedThreshold} / {totalWeight}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Voting Period</span>
                        <span className="font-medium text-foreground text-lg">{watchedVotingPeriod} days</span>
                      </div>
                    </div>
                  </div>

                  {/* Deployment Info */}
                  <div className="p-4 bg-muted/30 rounded-xl border border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Rocket className="h-4 w-4" /> Deployment
                    </h4>
                    <div className="space-y-2 text-sm">
                      {watchedCodeId > 0 && codeIdStatus === "valid" ? (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Code ID</span>
                          <span className="font-mono font-medium text-foreground">{watchedCodeId} (existing)</span>
                        </div>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Contract Code</span>
                          <span className="font-medium text-foreground">
                            {wasmSource === "bundled" ? "Bundled CW3-Fixed (cw-plus v0.16)" : `Custom: ${customWasmFile?.name || "—"}`}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Creator</span>
                        <span className="font-mono text-xs text-foreground truncate max-w-[60%]">{walletInfo?.address || "Connect wallet"}</span>
                      </div>
                    </div>
                  </div>

                  {/* WASM source selector (only if no existing code ID) */}
                  {!(watchedCodeId > 0 && codeIdStatus === "valid") && (
                    <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <UploadCloud className="h-4 w-4" /> Contract Source
                      </h4>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setWasmSource("bundled")}
                          className={`flex-1 p-3 rounded-lg border text-left text-sm transition-colors ${
                            wasmSource === "bundled"
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                          }`}
                        >
                          <p className="font-medium">Bundled (recommended)</p>
                          <p className="text-xs mt-0.5 opacity-70">Pre-compiled CW3-Fixed from cw-plus v0.16</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWasmSource("custom")}
                          className={`flex-1 p-3 rounded-lg border text-left text-sm transition-colors ${
                            wasmSource === "custom"
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                          }`}
                        >
                          <p className="font-medium">Custom WASM</p>
                          <p className="text-xs mt-0.5 opacity-70">Upload your own compiled .wasm file</p>
                        </button>
                      </div>

                      {wasmSource === "custom" && (
                        <div className="space-y-2">
                          <input
                            type="file"
                            accept=".wasm,application/wasm"
                            onChange={(e) => onCustomFileChange(e.target.files?.[0] ?? null)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold"
                          />
                          {customWasmFile && (
                            <p className="text-xs text-muted-foreground">
                              {customWasmFile.name} ({formatWasmSize(customWasmFile.size)})
                            </p>
                          )}
                        </div>
                      )}

                      {/* Wallet switch toggle */}
                      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer mt-2">
                        <input
                          type="checkbox"
                          checked={showWalletSwitch}
                          onChange={(e) => setShowWalletSwitch(e.target.checked)}
                          className="rounded border-border"
                        />
                        Switch to hardware wallet after upload (before instantiation)
                      </label>

                      {/* Chain compatibility warning for bulk-memory */}
                      {chainConstraints?.supportsBulkMemory === false && wasmSource === "bundled" && (
                        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm mt-3">
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-foreground">Bundled WASM may not be compatible</p>
                            <p className="text-muted-foreground mt-0.5">
                              {chain.chainDisplayName} does not support bulk-memory WASM opcodes
                              {chainConstraints.wasmdVersion && <> (wasmd {chainConstraints.wasmdVersion})</>}.
                              The bundled binary from cw-plus releases may contain these opcodes.
                            </p>
                            <p className="text-muted-foreground mt-1">
                              <strong>Options:</strong> (1) Upload a custom WASM compiled with{" "}
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">{chainConstraints.optimizerImage || "cosmwasm/optimizer:0.16.1"}</code>
                              , or (2) proceed and the app will validate the binary before uploading.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-between pt-4 border-t border-border">
                  <Button type="button" variant="ghost" size="action" onClick={goPrev} className="gap-2">
                    <ChevronLeft className="h-4 w-4" /> Edit
                  </Button>
                  <Button
                    type="button"
                    variant="action"
                    size="action"
                    onClick={goNext}
                    disabled={!walletInfo || (wasmSource === "custom" && !customWasmBytes && !(watchedCodeId > 0 && codeIdStatus === "valid"))}
                    className="gap-2"
                  >
                    {!walletInfo ? (
                      <>
                        <AlertCircle className="h-4 w-4" />
                        Connect Wallet First
                      </>
                    ) : (
                      <>
                        Proceed to Deploy
                        <Rocket className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* STEP 5: DEPLOY (Upload + optional wallet switch + Instantiate) */}
            {/* ============================================================ */}
            {currentStep === "deploy" && (
              <div className="space-y-6">
                <div className="space-y-1 mb-6">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Rocket className="h-5 w-5 text-muted-foreground" />
                    Deploy to {chain.chainDisplayName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {watchedCodeId > 0 && codeIdStatus === "valid"
                      ? "Using existing Code ID — skipping upload."
                      : "The app will upload the contract code and then create your multisig."}
                  </p>
                </div>

                {/* Deployment progress */}
                <div className="space-y-3">
                  {/* Upload step */}
                  {!(watchedCodeId > 0 && codeIdStatus === "valid") && (
                    <div className={`p-4 rounded-xl border ${
                      deployPhase === "uploading" ? "border-primary bg-primary/5"
                        : deployPhase === "uploaded" || deployPhase === "instantiating" || deployPhase === "done" ? "border-green-500 bg-green-500/5"
                        : "border-border bg-muted/30"
                    }`}>
                      <div className="flex items-center gap-3">
                        {deployPhase === "uploading" ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : uploadedCodeId ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <UploadCloud className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {deployPhase === "uploading" ? "Uploading contract code..." : uploadedCodeId ? `Uploaded — Code ID: ${uploadedCodeId}` : "Upload contract code"}
                          </p>
                          {uploadTxHash && (
                            <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate max-w-[400px]">
                              TX: {uploadTxHash}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Wallet switch panel */}
                  {showWalletSwitch && deployPhase === "uploaded" && (
                    <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 space-y-3">
                      <div className="flex items-center gap-3">
                        <Wallet className="h-5 w-5 text-yellow-500" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Switch Wallet (optional)</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Connected: <span className="font-mono">{walletInfo?.address?.slice(0, 20)}...</span>
                            {walletInfo?.type && <span className="ml-1">({walletInfo.type})</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={disconnect} className="gap-2">
                          <Wallet className="h-3.5 w-3.5" />
                          Disconnect & Reconnect
                        </Button>
                        <Button type="button" variant="action" size="sm" onClick={handleContinueAfterWalletSwitch} className="gap-2">
                          Continue with current wallet
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Instantiate step */}
                  <div className={`p-4 rounded-xl border ${
                    deployPhase === "instantiating" ? "border-primary bg-primary/5"
                      : deployPhase === "done" ? "border-green-500 bg-green-500/5"
                      : "border-border bg-muted/30"
                  }`}>
                    <div className="flex items-center gap-3">
                      {deployPhase === "instantiating" ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : deployPhase === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <FileCode2 className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {deployPhase === "instantiating" ? "Creating multisig contract..."
                            : deployPhase === "done" ? "Multisig created!"
                            : "Create multisig contract"}
                        </p>
                        {deployResult && (
                          <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate max-w-[400px]">
                            {deployResult.contractAddress}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Error */}
                  {deployPhase === "error" && deployError && (
                    <div className="p-4 rounded-xl border border-destructive bg-destructive/5 space-y-3">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Deployment failed</p>
                          <p className="text-xs text-muted-foreground mt-1">{deployError}</p>
                        </div>
                      </div>
                      {wasmValidation && !wasmValidation.valid && (
                        <div className="ml-8 space-y-2 text-xs">
                          <p className="text-muted-foreground">
                            WASM size: {wasmValidation.details.sizeKB}KB
                            {chainConstraints?.wasmSizeLimitKB && <> (limit: {chainConstraints.wasmSizeLimitKB}KB)</>}
                          </p>
                          {wasmValidation.details.hasBulkMemory && (
                            <div>
                              <p className="text-muted-foreground font-medium">Bulk-memory opcodes found:</p>
                              <ul className="list-disc list-inside text-muted-foreground mt-1">
                                {wasmValidation.details.bulkMemoryOpcodes.map((op) => (
                                  <li key={op.name}>{op.name} ({op.opcode}) x{op.count}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <p className="text-muted-foreground mt-2">
                            Switch to <strong>Custom WASM</strong> and upload a binary compiled with{" "}
                            <code className="bg-muted px-1 py-0.5 rounded">
                              {chainConstraints?.optimizerImage || "cosmwasm/optimizer:0.16.1"}
                            </code>{" "}
                            or Rust &lt;= {chainConstraints?.maxRustVersion || "1.81"}.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex justify-between pt-4 border-t border-border">
                  <Button type="button" variant="ghost" size="action" onClick={goPrev} disabled={isSubmitting} className="gap-2">
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
                        <><Loader2 className="h-4 w-4 animate-spin" /> Deploying...</>
                      ) : isLedger ? (
                        <><AlertCircle className="h-4 w-4" /> Switch to Keplr</>
                      ) : !walletInfo ? (
                        <><AlertCircle className="h-4 w-4" /> Connect Wallet</>
                      ) : (
                        <><Rocket className="h-4 w-4" /> {watchedCodeId > 0 && codeIdStatus === "valid" ? "Create Contract CLIQ" : "Upload & Create CLIQ"}</>
                      )}
                    </Button>
                  ) : deployPhase === "uploaded" && showWalletSwitch ? (
                    <Button type="button" variant="action" size="action" onClick={handleContinueAfterWalletSwitch} disabled={!walletInfo} className="gap-2">
                      <Rocket className="h-4 w-4" /> Instantiate Contract
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
                <div className="text-center py-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border-2 border-green-500/30 mx-auto mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">CLIQ Created Successfully</h3>
                  <p className="text-sm text-muted-foreground mt-1">Your contract multisig is live on {chain.chainDisplayName}</p>
                </div>

                {/* Contract details */}
                <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Contract Address</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-foreground">{deployResult.contractAddress.slice(0, 20)}...{deployResult.contractAddress.slice(-8)}</span>
                      <button type="button" onClick={() => copyToClipboard(deployResult.contractAddress)} className="p-1 hover:bg-muted rounded">
                        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Code ID</span>
                    <span className="font-mono text-sm text-foreground">{deployResult.codeId}</span>
                  </div>
                  {deployResult.txHash && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">TX Hash</span>
                      <span className="font-mono text-xs text-muted-foreground truncate max-w-[250px]">{deployResult.txHash}</span>
                    </div>
                  )}
                </div>

                {/* Data retention notice */}
                <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/20 space-y-2">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground">Download a backup copy</p>
                      <p className="text-muted-foreground mt-0.5">
                        Server data is retained for <span className="font-medium text-foreground">{getRetentionDays()} days</span> and then automatically deleted.
                        Download a backup to keep your CLIQ details permanently.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="button" variant="action" size="action" onClick={handleDownloadBackup} className="flex-1 gap-2">
                    <Download className="h-4 w-4" />
                    Download Backup
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="action"
                    onClick={() => router.push(`/${chain.registryName}/${deployResult.contractAddress}`)}
                    className="flex-1 gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Go to CLIQ Dashboard
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
