/**
 * Cliq Creation Form Schema
 *
 * File: components/forms/CreateCliqForm/formSchema.ts
 *
 * A Cliq is a multisig group that lets multiple people manage shared funds.
 * This schema validates the cliq creation form with:
 * - Cliq name and description
 * - Members (2-20 addresses or public keys)
 * - Threshold (signatures required)
 */

import { ChainInfo } from "@/context/ChainsContext/types";
import { pubkeyToAddress } from "@cosmjs/amino";
import { StargateClient } from "@cosmjs/stargate";
import { z } from "zod";
import { checkAddressOrPubkey } from "../../../lib/displayHelpers";

// Member role types for future governance features
export type MemberRole = "admin" | "member";

export interface CliqMember {
  address: string;
  role: MemberRole;
}

/**
 * Phase 3: Credential configuration for credential-gated multisigs
 */
export interface CredentialConfig {
  enabled: boolean;
  classSymbol: string;
  className: string;
  features: string[];
}

export const getCreateCliqSchema = (chain: ChainInfo) =>
  z
    .object({
      // Cliq identity
      name: z
        .string()
        .trim()
        .min(2, "CLIQ name must be at least 2 characters")
        .max(50, "CLIQ name must be less than 50 characters")
        .regex(
          /^[a-zA-Z0-9\s\-_]+$/,
          "CLIQ name can only contain letters, numbers, spaces, hyphens, and underscores",
        ),

      description: z
        .string()
        .trim()
        .max(200, "Description must be less than 200 characters")
        .optional()
        .or(z.literal("")),

      // Members array
      members: z.array(
        z.object({
          member: z
            .string()
            .trim()
            .superRefine(async (member, ctx) => {
              if (!member) {
                return z.NEVER;
              }

              const addressOrPubkeyError = checkAddressOrPubkey(member, chain.addressPrefix);

              if (addressOrPubkeyError) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: addressOrPubkeyError });
              } else {
                // Only check on-chain existence for addresses, not for public keys
                if (member.startsWith(chain.addressPrefix)) {
                  try {
                    const client = await StargateClient.connect(chain.nodeAddress);
                    const accountOnChain = await client.getAccount(member);

                    if (!accountOnChain || !accountOnChain.pubkey) {
                      ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "This account needs to send a transaction to appear on chain",
                      });
                    }
                  } catch {
                    return z.NEVER;
                  }
                }
                // Public keys don't need on-chain validation - they're used directly
              }
            }),
        }),
      ),

      // Threshold (number of signatures required)
      threshold: z.coerce
        .number({ invalid_type_error: "Threshold must be a number" })
        .int("Threshold can't have decimals")
        .min(1, "Threshold must be at least 1"),

      // Phase 3: Credential gating configuration
      enableCredentialGating: z.boolean().optional().default(false),

      credentialConfig: z
        .object({
          classSymbol: z
            .string()
            .trim()
            .max(16, "Symbol must be 16 characters or less")
            .regex(/^[A-Z0-9]+$/, "Symbol must be uppercase letters and numbers only")
            .optional()
            .or(z.literal("")),
          className: z
            .string()
            .trim()
            .max(50, "Name must be 50 characters or less")
            .optional()
            .or(z.literal("")),
          autoIssueCredentials: z.boolean().optional().default(true),
        })
        .optional(),
    })
    // Validate minimum members (at least 2)
    .superRefine(({ members }, ctx) => {
      const filledMembers = members.filter(({ member }) => member.trim() !== "");

      if (filledMembers.length < 2) {
        const emptyIndex = members.findIndex(({ member }) => member.trim() === "");
        const errorIndex = emptyIndex !== -1 ? emptyIndex : members.length - 1;

        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A CLIQ needs at least 2 members",
          path: [`members.${errorIndex}.member`],
        });
      }
    })
    // Validate no duplicate members
    .superRefine(({ members }, ctx) => {
      const addresses = members.map(({ member }) => {
        if (!member.startsWith(chain.addressPrefix)) {
          try {
            const address = pubkeyToAddress(
              { type: "tendermint/PubKeySecp256k1", value: member },
              chain.addressPrefix,
            );
            return address;
          } catch {}
        }
        return member;
      });

      const dupedAddresses = addresses.filter((member, i) => addresses.indexOf(member) !== i);
      const dupedAddressesIndexes: number[][] = [];

      for (const dupedAddress of dupedAddresses) {
        const dupedIndexes = [];
        for (let i = 0; i < addresses.length; ++i) {
          const index = addresses.indexOf(dupedAddress, i);
          if (index !== -1) {
            dupedIndexes.push(index);
          }
        }
        dupedAddressesIndexes.push(dupedIndexes.sort());
      }

      if (dupedAddressesIndexes.length) {
        for (const dupedIndexes of dupedAddressesIndexes) {
          for (const duplicateIndex of dupedIndexes) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Members cannot be duplicate (${dupedIndexes
                .map((index) => `#${index + 1}`)
                .join(", ")})`,
              path: [`members.${duplicateIndex}.member`],
            });
          }
        }
      } else {
        return z.NEVER;
      }
    })
    // Validate threshold doesn't exceed member count
    .refine(
      ({ members, threshold }) => threshold <= members.filter(({ member }) => member !== "").length,
      ({ members }) => ({
        message: `Threshold can't be higher than the number of members (${
          members.filter(({ member }) => member !== "").length
        })`,
        path: ["threshold"],
      }),
    );

// Export type for form values
export type CreateCliqFormValues = z.infer<ReturnType<typeof getCreateCliqSchema>>;

// Also export the old schema name for backward compatibility during migration
export const getCreateMultisigSchema = getCreateCliqSchema;
