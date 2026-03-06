import { MsgTypeUrl } from "@/types/txMsg";

export type AccountType = "wallet" | "multisig";

export interface SelectedAccount {
  type: AccountType;
  address: string;
  name?: string;
}

export type DevCommandType =
  | MsgTypeUrl
  | "upload-wasm"
  | "query-contract"
  | "authz-manager"
  | "execute-message"
  | "import-transaction";

export type DevNetwork = "mainnet" | "testnet";
