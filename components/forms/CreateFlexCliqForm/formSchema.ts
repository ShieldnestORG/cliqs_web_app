/**
 * Flex Cliq Creation Form Schema
 *
 * File: components/forms/CreateFlexCliqForm/formSchema.ts
 *
 * Schema for creating a CW3-Flex + CW4-group contract pair.
 *
 * Flex multisigs differ from fixed multisigs:
 * - Membership is managed by a separate CW4-group contract
 * - Members can be added/removed without changing the multisig address
 * - Group admin controls membership changes
 *
 * Phase 2: Group-Backed Multisig
 */

import { ChainInfo } from "@/context/ChainsContext/types";
import { z } from "zod";
import { checkAddress } from "@/lib/displayHelpers";

// ============================================================================
// Types
// ============================================================================

export interface FlexMember {
  address: string;
  weight: number;
}

export type GroupAdminType = "multisig" | "custom" | "none";

// ============================================================================
// Form Schema
// ============================================================================

export const getCreateFlexCliqSchema = (chain: ChainInfo) =>
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

      // Contract labels (used on-chain)
      // Labels are auto-generated from the CLIQ name if not provided
      multisigLabel: z
        .string()
        .trim()
        .max(128, "Multisig label must be less than 128 characters")
        .optional()
        .or(z.literal("")),

      groupLabel: z
        .string()
        .trim()
        .max(128, "Group label must be less than 128 characters")
        .optional()
        .or(z.literal("")),

      // Code IDs for the contracts (0 = auto-upload bundled WASM)
      cw3FlexCodeId: z.coerce
        .number({ invalid_type_error: "CW3-Flex Code ID must be a number" })
        .int("CW3-Flex Code ID must be an integer")
        .min(0, "CW3-Flex Code ID must be 0 (auto-upload) or a positive integer"),

      cw4GroupCodeId: z.coerce
        .number({ invalid_type_error: "CW4-Group Code ID must be a number" })
        .int("CW4-Group Code ID must be an integer")
        .min(0, "CW4-Group Code ID must be 0 (auto-upload) or a positive integer"),

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

      // Group admin configuration
      groupAdminType: z.enum(["multisig", "custom", "none"]),

      // Custom admin address (only used if groupAdminType is "custom")
      customAdmin: z
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

      // Multisig contract admin (optional - for future contract upgrades)
      multisigAdmin: z
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
    )
    // Validate custom admin is provided when groupAdminType is "custom"
    .refine(
      ({ groupAdminType, customAdmin }) => {
        if (groupAdminType === "custom") {
          return customAdmin && customAdmin.trim() !== "";
        }
        return true;
      },
      {
        message: "Custom admin address is required when using custom admin",
        path: ["customAdmin"],
      },
    );

// ============================================================================
// Type Exports
// ============================================================================

export type CreateFlexCliqFormValues = z.infer<ReturnType<typeof getCreateFlexCliqSchema>>;

// ============================================================================
// Default Values
// ============================================================================

export const defaultFlexCliqFormValues: Omit<
  CreateFlexCliqFormValues,
  "cw3FlexCodeId" | "cw4GroupCodeId"
> & {
  cw3FlexCodeId: string;
  cw4GroupCodeId: string;
} = {
  name: "",
  description: "",
  multisigLabel: "",
  groupLabel: "",
  cw3FlexCodeId: "", // Will be set based on chain
  cw4GroupCodeId: "", // Will be set based on chain
  members: [
    { address: "", weight: 1 },
    { address: "", weight: 1 },
  ],
  threshold: 2,
  votingPeriodDays: 7,
  groupAdminType: "multisig", // Default: multisig controls its own membership
  customAdmin: "",
  multisigAdmin: "",
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

/**
 * Get group admin description
 */
export function getGroupAdminDescription(adminType: GroupAdminType): string {
  switch (adminType) {
    case "multisig":
      return "The multisig contract itself will be the group admin. Members can only be changed via multisig proposals.";
    case "custom":
      return "A custom address will be the group admin. This address can update members without going through the multisig.";
    case "none":
      return "No admin will be set. Members cannot be changed after creation (immutable group).";
    default:
      return "";
  }
}
