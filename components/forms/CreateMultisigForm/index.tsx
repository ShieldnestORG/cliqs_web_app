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
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getKeplrKey } from "@/lib/keplr";
import { toastError } from "@/lib/utils";
import { StargateClient } from "@cosmjs/stargate";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/router";
import { useEffect, useCallback } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Plus, Users } from "lucide-react";
import { useChains } from "../../../context/ChainsContext";
import { createMultisigFromCompressedSecp256k1Pubkeys } from "../../../lib/multisigHelpers";
import ConfirmCreateMultisig from "./ConfirmCreateMultisig";
import MemberFormField from "./MemberFormField";
import { getCreateMultisigSchema } from "./formSchema";

export default function CreateMultisigForm() {
  const router = useRouter();
  const { chain } = useChains();

  const createMultisigSchema = getCreateMultisigSchema(chain);

  const createMultisigForm = useForm<z.infer<typeof createMultisigSchema>>({
    resolver: zodResolver(createMultisigSchema),
    defaultValues: { members: [{ member: "" }], threshold: 1 },
  });

  const {
    fields: membersFields,
    append: membersAppend,
    remove: membersRemove,
    replace: membersReplace,
  } = useFieldArray({ name: "members", control: createMultisigForm.control });

  const watchedMembers = useWatch({ control: createMultisigForm.control, name: "members" });

  // Count of filled members (non-empty)
  const filledMembersCount = watchedMembers.filter(({ member }) => member.trim() !== "").length;

  // Add new member handler
  const handleAddMember = useCallback(() => {
    membersAppend({ member: "" }, { shouldFocus: true });
  }, [membersAppend]);

  // Update threshold when members change - only adjust if current threshold exceeds member count
  useEffect(() => {
    const currentThreshold = createMultisigForm.getValues("threshold");
    if (currentThreshold > filledMembersCount && filledMembersCount >= 2) {
      createMultisigForm.setValue("threshold", filledMembersCount);
    }
  }, [createMultisigForm, filledMembersCount]);

  const submitCreateMultisig = async () => {
    try {
      // Caution: threshold is string instead of number
      const { members, threshold } = createMultisigForm.getValues();

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

      const multisigAddress = await createMultisigFromCompressedSecp256k1Pubkeys(
        pubkeys,
        Number(threshold),
        chain.addressPrefix,
        chain.chainId,
        address,
      );

      router.push(`/${chain.registryName}/${multisigAddress}`);
    } catch (e) {
      console.error("Failed to create multisig:", e);
      toastError({
        description: "Failed to create multisig",
        fullError: e instanceof Error ? e : undefined,
      });
    }
  };

  return (
    <>
      <Card variant="institutional" bracket="green" className="overflow-visible">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="icon-container rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardLabel comment>New Account</CardLabel>
              <CardTitle className="text-xl">Create a Multisig Wallet</CardTitle>
            </div>
          </div>
          <CardDescription className="space-y-2 mt-4">
            <span className="block">
              Fill the form to create a new multisig account on{" "}
              <span className="font-semibold text-foreground">{chain.chainDisplayName || "Cosmos Hub"}</span>.
            </span>
            <span className="block text-xs">
              💡 You can paste several addresses on the first input if they are separated by whitespace or commas.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...createMultisigForm}>
            <form
              id="create-multisig-form"
              onSubmit={createMultisigForm.handleSubmit(submitCreateMultisig)}
              className="space-y-6"
            >
              {/* Members Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">
                    Members ({filledMembersCount} added)
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Minimum 2 required
                  </div>
                </div>
                
                {/* Member Fields */}
                <div className="space-y-4">
                  {membersFields.map((arrayField, index) => (
                    <MemberFormField
                      key={arrayField.id}
                      createMultisigForm={createMultisigForm}
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
                  className="w-full gap-2 mt-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Member
                </Button>
              </div>

              {/* Separator */}
              <div className="h-px bg-border" />

              {/* Threshold Section */}
              <FormField
                control={createMultisigForm.control}
                name="threshold"
                render={({ field }) => {
                  const memberCount = filledMembersCount;
                  const maxThreshold = Math.max(1, memberCount);
                  const currentThreshold = Math.min(Number(field.value) || 2, maxThreshold);
                  
                  return (
                    <FormItem className="space-y-4">
                      <div>
                        <FormLabel className="text-base font-semibold">Signing Threshold</FormLabel>
                        <FormDescription className="mt-1">
                          Number of signatures needed to broadcast a transaction
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
                            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg min-w-[100px] justify-center">
                              <span className="text-2xl font-heading font-bold text-foreground">
                                {currentThreshold}
                              </span>
                              <span className="text-muted-foreground font-medium">
                                / {memberCount}
                              </span>
                            </div>
                          </div>
                          
                          {/* Status Text */}
                          <p className="text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">{currentThreshold}</span> of{" "}
                            <span className="font-semibold text-foreground">{memberCount}</span> members 
                            must sign to approve a transaction
                          </p>
                          
                          {/* Warning for max threshold */}
                          {currentThreshold === memberCount && memberCount > 0 && (
                            <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg">
                              <div className="flex items-start gap-3">
                                <span className="text-yellow-500 text-lg">⚠️</span>
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-yellow-200">
                                    Maximum threshold selected
                                  </p>
                                  <p className="text-xs text-yellow-200/80">
                                    Losing access to any wallet will result in permanent loss of access to your multisig&apos;s assets.
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
              
              {/* Submit Section */}
              <div className="pt-2">
                <ConfirmCreateMultisig createMultisigForm={createMultisigForm} />
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
