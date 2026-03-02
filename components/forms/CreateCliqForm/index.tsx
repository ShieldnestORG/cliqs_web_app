/**
 * Create Cliq Form
 *
 * File: components/forms/CreateCliqForm/index.tsx
 *
 * Main form component for creating a new Cliq (multisig group).
 * A Cliq lets multiple people manage shared funds and coordinate transactions.
 * Uses a tabbed interface for each step of the creation process.
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { getKeplrKey } from "@/lib/keplr";
import { toastError, toastSuccess } from "@/lib/utils";
import { StargateClient } from "@cosmjs/stargate";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/router";
import { useEffect, useCallback, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import {
  Users,
  Shield,
  ShieldPlus,
  UserPlus,
  FileText,
  UsersRound,
  Check,
  ChevronRight,
  ChevronLeft,
  Key,
  AlertCircle,
} from "lucide-react";
import { useChains } from "../../../context/ChainsContext";
import { createMultisigFromCompressedSecp256k1Pubkeys } from "../../../lib/multisigHelpers";
import ConfirmCreateCliq from "./ConfirmCreateCliq";
import MemberFormField from "./MemberFormField";
import { getCreateCliqSchema, CreateCliqFormValues } from "./formSchema";

type TabValue = "name" | "members" | "approval";

export default function CreateCliqForm() {
  const router = useRouter();
  const { chain } = useChains();
  const [activeTab, setActiveTab] = useState<TabValue>("name");

  const createCliqSchema = getCreateCliqSchema(chain);

  const createCliqForm = useForm<CreateCliqFormValues>({
    resolver: zodResolver(createCliqSchema),
    defaultValues: {
      name: "",
      description: "",
      members: [{ member: "" }],
      threshold: 1,
      // Phase 3: Credential gating defaults
      enableCredentialGating: false,
      credentialConfig: {
        classSymbol: "",
        className: "",
        autoIssueCredentials: true,
      },
    },
  });

  // Phase 3: Watch credential gating toggle
  const enableCredentialGating = useWatch({
    control: createCliqForm.control,
    name: "enableCredentialGating",
  });

  const {
    fields: membersFields,
    append: membersAppend,
    remove: membersRemove,
    replace: membersReplace,
  } = useFieldArray({ name: "members", control: createCliqForm.control });

  const watchedMembers = useWatch({ control: createCliqForm.control, name: "members" });
  const watchedName = useWatch({ control: createCliqForm.control, name: "name" });

  // Count of filled members (non-empty)
  const filledMembersCount = watchedMembers.filter(({ member }) => member.trim() !== "").length;

  // Tab navigation helpers
  const tabs: TabValue[] = ["name", "members", "approval"];
  const currentTabIndex = tabs.indexOf(activeTab);

  const goToNextTab = () => {
    if (currentTabIndex < tabs.length - 1) {
      setActiveTab(tabs[currentTabIndex + 1]);
    }
  };

  const goToPrevTab = () => {
    if (currentTabIndex > 0) {
      setActiveTab(tabs[currentTabIndex - 1]);
    }
  };

  // Check if step is complete
  const isNameStepComplete = watchedName.trim().length > 0;
  const isMembersStepComplete = filledMembersCount >= 2;

  // Add new member handler
  const handleAddMember = useCallback(() => {
    membersAppend({ member: "" }, { shouldFocus: true });
  }, [membersAppend]);

  // Update threshold when members change - only adjust if current threshold exceeds member count
  useEffect(() => {
    const currentThreshold = createCliqForm.getValues("threshold");
    if (currentThreshold > filledMembersCount && filledMembersCount >= 2) {
      createCliqForm.setValue("threshold", filledMembersCount);
    }
  }, [createCliqForm, filledMembersCount]);

  const submitCreateCliq = async () => {
    const { toast } = await import("sonner");
    const loadingId = toast.loading("Creating your CLIQ...");
    try {
      const { name, description, members, threshold } = createCliqForm.getValues();

      const pubkeys = await Promise.all(
        members
          .filter(({ member }) => member !== "")
          .map(async ({ member }) => {
            if (!member.startsWith(chain.addressPrefix)) {
              return member;
            }

            const client = await StargateClient.connect(chain.nodeAddress);
            const accountOnChain = await client.getAccount(member);

            if (!accountOnChain || !accountOnChain.pubkey) {
              throw new Error(
                `Member "${member}" is not a pubkey and is not on chain. It needs to send a transaction to appear on chain or you can provide its pubkey`,
              );
            }

            return String(accountOnChain.pubkey.value);
          }),
      );

      const { bech32Address: address } = await getKeplrKey(chain.chainId);

      // Create the multisig (cliq) on chain
      const cliqAddress = await createMultisigFromCompressedSecp256k1Pubkeys(
        pubkeys,
        Number(threshold),
        chain.addressPrefix,
        chain.chainId,
        address,
        name, // Pass cliq name
        description, // Pass cliq description
      );

      toast.dismiss(loadingId);
      toastSuccess("CLIQ created!", `Redirecting to ${name || "your CLIQ"}...`);
      router.push(`/${chain.registryName}/${cliqAddress}`);
    } catch (e) {
      console.error("Failed to create cliq:", e);
      toast.dismiss(loadingId);
      toastError({
        title: "Failed to create CLIQ",
        description: e instanceof Error ? e.message : undefined,
        fullError: e instanceof Error ? e : undefined,
      });
    }
  };

  return (
    <>
      <Card variant="institutional" bracket="green" className="overflow-visible">
        <CardHeader>
          <div className="mb-2 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted">
              <Users className="h-7 w-7 text-foreground" />
            </div>
            <div>
              <CardLabel comment className="flex items-center gap-1">
                <ShieldPlus className="h-3 w-3" />
                New CLIQ
              </CardLabel>
              <CardTitle className="text-2xl">Build Your Shared Wallet</CardTitle>
            </div>
          </div>
          <CardDescription className="mt-4 space-y-3">
            <span className="block text-base">
              Build a shared wallet with your team on{" "}
              <span className="font-semibold text-foreground">
                {chain.chainDisplayName || "Cosmos"}
              </span>
            </span>
            <span className="block text-sm text-muted-foreground">
              A CLIQ requires multiple signatures to approve transactions—perfect for teams, DAOs,
              or shared treasuries.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...createCliqForm}>
            <form id="create-cliq-form" onSubmit={createCliqForm.handleSubmit(submitCreateCliq)}>
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as TabValue)}
                className="w-full"
              >
                {/* Tab Navigation */}
                <TabsList className="mb-6 grid h-auto w-full grid-cols-3 rounded-xl bg-muted/50 p-1">
                  <TabsTrigger
                    value="name"
                    className="flex items-center gap-2 rounded-lg px-4 py-3 shadow-sm transition-all data-[state=active]:border data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground"
                  >
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        isNameStepComplete
                          ? "bg-primary text-primary-foreground"
                          : activeTab === "name"
                            ? "border border-border bg-muted text-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isNameStepComplete ? <Check className="h-3.5 w-3.5" /> : "1"}
                    </div>
                    <span className="hidden font-medium sm:inline">Name</span>
                    <FileText className="h-4 w-4 sm:hidden" />
                  </TabsTrigger>

                  <TabsTrigger
                    value="members"
                    className="flex items-center gap-2 rounded-lg px-4 py-3 shadow-sm transition-all data-[state=active]:border data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground"
                  >
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        isMembersStepComplete
                          ? "bg-primary text-primary-foreground"
                          : activeTab === "members"
                            ? "border border-border bg-muted text-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isMembersStepComplete ? <Check className="h-3.5 w-3.5" /> : "2"}
                    </div>
                    <span className="hidden font-medium sm:inline">Members</span>
                    <UsersRound className="h-4 w-4 sm:hidden" />
                    {filledMembersCount > 0 && (
                      <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-xs text-foreground">
                        {filledMembersCount}
                      </span>
                    )}
                  </TabsTrigger>

                  <TabsTrigger
                    value="approval"
                    className="flex items-center gap-2 rounded-lg px-4 py-3 shadow-sm transition-all data-[state=active]:border data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground"
                  >
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        activeTab === "approval"
                          ? "border border-border bg-muted text-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      3
                    </div>
                    <span className="hidden font-medium sm:inline">Approval</span>
                    <Shield className="h-4 w-4 sm:hidden" />
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Name Your Cliq */}
                <TabsContent value="name" className="mt-0 space-y-6">
                  <div className="mb-6 space-y-1">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      Name Your CLIQ
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Give your CLIQ a memorable name and optional description
                    </p>
                  </div>

                  <FormField
                    control={createCliqForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CLIQ Name</FormLabel>
                        <FormControl>
                          <Input
                            variant="institutional"
                            placeholder="e.g., Treasury CLIQ, DAO Council, Family Fund"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Choose a memorable name for your CLIQ</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createCliqForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What is this CLIQ for? (e.g., Managing project treasury)"
                            className="h-24 resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Navigation */}
                  <div className="flex justify-end border-t border-border pt-4">
                    <Button
                      type="button"
                      variant="action"
                      size="action"
                      onClick={goToNextTab}
                      disabled={!isNameStepComplete}
                      className="gap-2"
                    >
                      Continue to Members
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>

                {/* Tab 2: Add Members */}
                <TabsContent value="members" className="mt-0 space-y-6">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                        <UsersRound className="h-5 w-5 text-muted-foreground" />
                        Add Members
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Add the wallet addresses or public keys of CLIQ members
                      </p>
                    </div>
                    <div className="rounded-full border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
                      {filledMembersCount} member{filledMembersCount !== 1 ? "s" : ""} added
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      💡 <strong>Tip:</strong> You can paste multiple addresses at once in the first
                      field, separated by commas or spaces.
                    </p>
                  </div>

                  {/* Member Fields */}
                  <div className="space-y-4">
                    {membersFields.map((arrayField, index) => (
                      <MemberFormField
                        key={arrayField.id}
                        createCliqForm={createCliqForm}
                        index={index}
                        membersReplace={membersReplace}
                        membersRemove={membersRemove}
                        totalMembers={membersFields.length}
                      />
                    ))}
                  </div>

                  {/* Add Member Button */}
                  <Button
                    type="button"
                    variant="action-outline"
                    size="action-sm"
                    onClick={handleAddMember}
                    className="w-full gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add Another Member
                  </Button>

                  {/* Minimum members warning */}
                  {filledMembersCount < 2 && (
                    <div className="rounded-lg border border-border bg-muted p-3">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />A CLIQ requires at
                        least 2 members. Add {2 - filledMembersCount} more member
                        {2 - filledMembersCount !== 1 ? "s" : ""} to continue.
                      </p>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex justify-between border-t border-border pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="action"
                      onClick={goToPrevTab}
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="action"
                      size="action"
                      onClick={goToNextTab}
                      disabled={!isMembersStepComplete}
                      className="gap-2"
                    >
                      Continue to Approval
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>

                {/* Tab 3: Set Approval Rules */}
                <TabsContent value="approval" className="mt-0 space-y-6">
                  <div className="mb-6 space-y-1">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      Set Approval Rules
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Configure how many signatures are required to approve transactions
                    </p>
                  </div>

                  <FormField
                    control={createCliqForm.control}
                    name="threshold"
                    render={({ field }) => {
                      const memberCount = filledMembersCount;
                      const maxThreshold = Math.max(1, memberCount);
                      const currentThreshold = Math.min(Number(field.value) || 1, maxThreshold);

                      return (
                        <FormItem className="space-y-6">
                          <div>
                            <FormLabel className="text-base">Signing Threshold</FormLabel>
                            <FormDescription className="mt-1">
                              How many signatures are needed to approve transactions?
                            </FormDescription>
                          </div>
                          <FormControl>
                            <div className="space-y-6">
                              {/* Slider with Value Display */}
                              <div className="flex items-center gap-6">
                                <div className="flex-1">
                                  <Slider
                                    size="lg"
                                    min={1}
                                    max={maxThreshold || 1}
                                    step={1}
                                    value={[currentThreshold]}
                                    onValueChange={(values) => field.onChange(values[0])}
                                    disabled={memberCount < 1}
                                  />
                                </div>
                                <div className="flex min-w-[120px] items-center justify-center gap-2 rounded-xl border border-border bg-muted px-4 py-3 shadow-sm">
                                  <Shield className="h-5 w-5 text-foreground" />
                                  <span className="font-heading text-2xl font-bold text-foreground">
                                    {currentThreshold}
                                  </span>
                                  <span className="font-medium text-muted-foreground">
                                    / {memberCount}
                                  </span>
                                </div>
                              </div>

                              {/* Status Text */}
                              <p className="text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">
                                  {currentThreshold}
                                </span>{" "}
                                of{" "}
                                <span className="font-semibold text-foreground">{memberCount}</span>{" "}
                                members must sign to approve a transaction
                              </p>

                              {/* Warning for max threshold */}
                              {currentThreshold === memberCount && memberCount > 0 && (
                                <div className="rounded-lg border border-border bg-muted p-4">
                                  <div className="flex items-start gap-3">
                                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-foreground">
                                        Maximum threshold selected
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        If any member loses access to their wallet, your CLIQ&apos;s
                                        assets will be permanently locked.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  {/* Phase 3: Credential Gating Section */}
                  <div className="space-y-4 border-t border-border pt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
                          <Key className="h-4 w-4 text-green-accent" />
                          Credential Gating
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Require members to hold an identity NFT to vote and execute
                        </p>
                      </div>
                      <FormField
                        control={createCliqForm.control}
                        name="enableCredentialGating"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {enableCredentialGating && (
                      <div className="space-y-4 rounded-lg border border-green-accent/20 bg-muted/30 p-4">
                        <p className="text-sm text-muted-foreground">
                          A credential NFT class will be created for this CLIQ. Members must hold a
                          credential to participate.
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={createCliqForm.control}
                            name="credentialConfig.classSymbol"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Symbol</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="CLIQ1"
                                    {...field}
                                    className="uppercase"
                                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Short identifier (e.g., CLIQ1)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={createCliqForm.control}
                            name="credentialConfig.className"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Class Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Team Credential" {...field} />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Display name for credentials
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={createCliqForm.control}
                          name="credentialConfig.autoIssueCredentials"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between py-2">
                              <div>
                                <FormLabel className="text-sm">Auto-issue credentials</FormLabel>
                                <FormDescription className="text-xs">
                                  Automatically issue credentials to initial members
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  {/* Summary Card */}
                  <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                    <h4 className="text-sm font-semibold text-foreground">CLIQ Summary</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Name:</span>
                        <p className="truncate font-medium text-foreground">{watchedName || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Members:</span>
                        <p className="font-medium text-foreground">{filledMembersCount}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Threshold:</span>
                        <p className="font-medium text-foreground">
                          {createCliqForm.watch("threshold")} of {filledMembersCount}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Network:</span>
                        <p className="font-medium text-foreground">
                          {chain.chainDisplayName || chain.registryName}
                        </p>
                      </div>
                      {enableCredentialGating && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Credentials:</span>
                          <p className="flex items-center gap-1 font-medium text-green-accent">
                            <Key className="h-3 w-3" /> Enabled
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Navigation & Submit */}
                  <div className="flex justify-between border-t border-border pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="action"
                      onClick={goToPrevTab}
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <ConfirmCreateCliq createCliqForm={createCliqForm} />
                  </div>
                </TabsContent>
              </Tabs>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
