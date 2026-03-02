/**
 * Contract Cliq Creation Form Schema
 *
 * File: components/forms/CreateContractCliqForm/formSchema.ts
 *
 * Schema for creating a CW3-based contract multisig.
 * Unlike PubKey multisigs, contract multisigs:
 * - Don't require public keys (only addresses)
 * - Support weighted voting
 * - Have a voting period
 * - Have a stable address (key rotation doesn't change it)
 */

import { ChainInfo } from "@/context/ChainsContext/types";
import { z } from "zod";
import { checkAddress } from "@/lib/displayHelpers";

// ============================================================================
// Types
// ============================================================================

export interface ContractMember {
  address: string;
  weight: number;
}

// ============================================================================
// Form Schema
// ============================================================================

export const getCreateContractCliqSchema = (chain: ChainInfo) =>
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

      // Contract label (used on-chain) — optional because it is auto-generated
      // from the CLIQ name if not provided by the user
      label: z
        .string()
        .trim()
        .max(128, "Contract label must be less than 128 characters")
        .optional()
        .or(z.literal("")),

      // Code ID for the CW3 contract (0 = auto-upload bundled WASM)
      codeId: z.coerce
        .number({ invalid_type_error: "Code ID must be a number" })
        .int("Code ID must be an integer")
        .min(0, "Code ID must be 0 (auto-upload) or a positive integer"),

      // Members with weights
      members: z.array(
        z.object({
          address: z
            .string()
            .trim()
            .superRefine((address, ctx) => {
              if (!address) {
                return z.NEVER;
              }

              const addressError = checkAddress(address, chain.addressPrefix);
              if (addressError) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: addressError });
              }
            }),
          weight: z.coerce
            .number({ invalid_type_error: "Weight must be a number" })
            .int("Weight must be an integer")
            .min(1, "Weight must be at least 1")
            .max(1000, "Weight must be less than 1000"),
        }),
      ),

      // Threshold (weight required to pass)
      threshold: z.coerce
        .number({ invalid_type_error: "Threshold must be a number" })
        .int("Threshold must be an integer")
        .min(1, "Threshold must be at least 1"),

      // Voting period in days
      votingPeriodDays: z.coerce
        .number({ invalid_type_error: "Voting period must be a number" })
        .min(0.01, "Voting period must be at least 15 minutes (0.01 days)")
        .max(365, "Voting period must be less than 1 year"),

      // Admin address (optional - for future contract upgrades)
      admin: z
        .string()
        .trim()
        .optional()
        .or(z.literal(""))
        .superRefine((admin, ctx) => {
          if (!admin) {
            return z.NEVER;
          }

          const addressError = checkAddress(admin, chain.addressPrefix);
          if (addressError) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: addressError });
          }
        }),
    })
    // Validate minimum members (at least 2)
    .superRefine(({ members }, ctx) => {
      const filledMembers = members.filter(({ address }) => address.trim() !== "");

      if (filledMembers.length < 2) {
        const emptyIndex = members.findIndex(({ address }) => address.trim() === "");
        const errorIndex = emptyIndex !== -1 ? emptyIndex : members.length - 1;

        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A CLIQ needs at least 2 members",
          path: [`members.${errorIndex}.address`],
        });
      }
    })
    // Validate no duplicate members
    .superRefine(({ members }, ctx) => {
      const addresses = members.map(({ address }) => address.toLowerCase());
      const dupedAddresses = addresses.filter(
        (addr, i) => addr !== "" && addresses.indexOf(addr) !== i,
      );

      if (dupedAddresses.length > 0) {
        for (let i = 0; i < addresses.length; i++) {
          if (dupedAddresses.includes(addresses[i])) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Duplicate member address",
              path: [`members.${i}.address`],
            });
          }
        }
      }
    })
    // Validate threshold doesn't exceed total weight
    .refine(
      ({ members, threshold }) => {
        const totalWeight = members
          .filter(({ address }) => address !== "")
          .reduce((sum, { weight }) => sum + weight, 0);
        return threshold <= totalWeight;
      },
      ({ members }) => {
        const totalWeight = members
          .filter(({ address }) => address !== "")
          .reduce((sum, { weight }) => sum + weight, 0);
        return {
          message: `Threshold can't be higher than total weight (${totalWeight})`,
          path: ["threshold"],
        };
      },
    );

// ============================================================================
// Type Exports
// ============================================================================

export type CreateContractCliqFormValues = z.infer<ReturnType<typeof getCreateContractCliqSchema>>;

// ============================================================================
// Default Values
// ============================================================================

export const defaultContractCliqFormValues: Omit<CreateContractCliqFormValues, "codeId"> & {
  codeId: string;
} = {
  name: "",
  description: "",
  label: "",
  codeId: "", // Will be set based on chain
  members: [
    { address: "", weight: 1 },
    { address: "", weight: 1 },
  ],
  threshold: 2,
  votingPeriodDays: 7,
  admin: "",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert voting period in days to seconds
 */
export function votingPeriodToSeconds(days: number): number {
  return Math.floor(days * 24 * 60 * 60);
}

/**
 * Convert seconds to voting period in days
 */
export function secondsToVotingPeriod(seconds: number): number {
  return seconds / (24 * 60 * 60);
}

/**
 * Calculate total weight from members
 */
export function calculateTotalWeight(members: { weight: number }[]): number {
  return members.reduce((sum, { weight }) => sum + weight, 0);
}
