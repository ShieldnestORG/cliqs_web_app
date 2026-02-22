import { MsgTypeUrl, MsgTypeUrls } from "@/types/txMsg";

export type MessageCategory = 
  | "Bank" 
  | "Staking" 
  | "Distribution" 
  | "Vesting" 
  | "Governance" 
  | "IBC" 
  | "CosmWasm";

export interface MessageCategoryInfo {
  category: MessageCategory;
  label: string;
  bracket: "green" | "purple" | "none";
  accent: "left" | "top" | "none";
}

/**
 * Gets category information for a message type URL
 */
export const getMessageCategory = (typeUrl: MsgTypeUrl): MessageCategoryInfo => {
  // Bank
  if (typeUrl === MsgTypeUrls.Send) {
    return {
      category: "Bank",
      label: "Bank",
      bracket: "green",
      accent: "left",
    };
  }

  // Staking
  if (
    typeUrl === MsgTypeUrls.Delegate ||
    typeUrl === MsgTypeUrls.Undelegate ||
    typeUrl === MsgTypeUrls.BeginRedelegate ||
    typeUrl === MsgTypeUrls.CreateValidator
  ) {
    return {
      category: "Staking",
      label: "Staking",
      bracket: "green",
      accent: "left",
    };
  }

  // Distribution
  if (
    typeUrl === MsgTypeUrls.FundCommunityPool ||
    typeUrl === MsgTypeUrls.SetWithdrawAddress ||
    typeUrl === MsgTypeUrls.WithdrawDelegatorReward ||
    typeUrl === MsgTypeUrls.WithdrawValidatorCommission
  ) {
    return {
      category: "Distribution",
      label: "Distribution",
      bracket: "green",
      accent: "top",
    };
  }

  // Vesting
  if (typeUrl === MsgTypeUrls.CreateVestingAccount) {
    return {
      category: "Vesting",
      label: "Vesting",
      bracket: "purple",
      accent: "left",
    };
  }

  // Governance
  if (typeUrl === MsgTypeUrls.Vote) {
    return {
      category: "Governance",
      label: "Governance",
      bracket: "purple",
      accent: "top",
    };
  }

  // IBC
  if (typeUrl === MsgTypeUrls.Transfer) {
    return {
      category: "IBC",
      label: "IBC",
      bracket: "purple",
      accent: "left",
    };
  }

  // CosmWasm
  if (
    typeUrl === MsgTypeUrls.InstantiateContract ||
    typeUrl === MsgTypeUrls.InstantiateContract2 ||
    typeUrl === MsgTypeUrls.ExecuteContract ||
    typeUrl === MsgTypeUrls.MigrateContract ||
    typeUrl === MsgTypeUrls.UpdateAdmin
  ) {
    return {
      category: "CosmWasm",
      label: "CosmWasm",
      bracket: "purple",
      accent: "left",
    };
  }

  // Default
  return {
    category: "Bank",
    label: "Transaction",
    bracket: "none",
    accent: "none",
  };
};

/**
 * Gets a human-readable name for a message type
 */
export const getMessageName = (typeUrl: MsgTypeUrl): string => {
  const entries = Object.entries(MsgTypeUrls) as [keyof typeof MsgTypeUrls, MsgTypeUrl][];
  const entry = entries.find(([, url]) => url === typeUrl);
  return entry ? entry[0] : "Unknown";
};

