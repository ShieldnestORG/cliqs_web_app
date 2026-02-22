import { ChainInfo } from "@/context/ChainsContext/types";
import { pubkeyToAddress } from "@cosmjs/amino";
import { StargateClient } from "@cosmjs/stargate";
import { z } from "zod";
import { checkAddressOrPubkey } from "../../../lib/displayHelpers";

export const getCreateMultisigSchema = (chain: ChainInfo) =>
  z
    .object({
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
      threshold: z.coerce
        .number({ invalid_type_error: "Threshold must be a number" })
        .int("Threshold can't have decimals")
        .min(1, "Threshold must be at least 1"),
    })
    .superRefine(({ members }, ctx) => {
      // Count filled members
      const filledMembers = members.filter(({ member }) => member.trim() !== "");
      
      if (filledMembers.length < 2) {
        // Find the first empty slot to show the error, or use the last member
        const emptyIndex = members.findIndex(({ member }) => member.trim() === "");
        const errorIndex = emptyIndex !== -1 ? emptyIndex : members.length - 1;
        
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least 2 members needed",
          path: [`members.${errorIndex}.member`],
        });
      }
    })
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
            const issue = {
              code: z.ZodIssueCode.custom,
              message: `Members cannot be duplicate (${dupedIndexes
                .map((index) => `#${index + 1}`)
                .join(", ")})`,
              path: [`members.${duplicateIndex}.member`],
            };

            ctx.addIssue(issue);
          }
        }
      } else {
        return z.NEVER;
      }
    })
    .refine(
      ({ members, threshold }) => threshold <= members.filter(({ member }) => member !== "").length,
      ({ members }) => ({
        message: `Threshold can't be higher than the number of members (${
          members.filter(({ member }) => member !== "").length
        })`,
        path: ["threshold"],
      }),
    );
