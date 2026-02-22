export type DevNetwork = "mainnet" | "testnet";

export type DeploymentStage =
  | "upload"
  | "instantiate"
  | "execute"
  | "migrate"
  | "update-admin"
  | "query"
  | "authz-grant"
  | "authz-revoke";

export interface DeploymentLogDraft {
  readonly stage: DeploymentStage;
  readonly network: DevNetwork;
  readonly chainId: string;
  readonly wallet?: string;
  readonly contractType?: string;
  readonly label?: string;
  readonly codeId?: number;
  readonly contractAddress?: string;
  readonly txHash?: string;
  readonly detail?: string;
}

export interface DeploymentLogEntry extends DeploymentLogDraft {
  readonly id: string;
  readonly createdAt: string;
}

const STORAGE_KEY = "cosmos-multisig-devtools-log";
const MAX_LOG_ENTRIES = 300;

const makeId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `devlog-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const loadDeploymentLog = (): DeploymentLogEntry[] => {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DeploymentLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to parse deployment log:", error);
    return [];
  }
};

export const saveDeploymentLog = (entries: readonly DeploymentLogEntry[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_LOG_ENTRIES)));
};

export const clearDeploymentLog = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
};

export const appendDeploymentLog = (draft: DeploymentLogDraft): DeploymentLogEntry[] => {
  const nextEntry: DeploymentLogEntry = {
    ...draft,
    id: makeId(),
    createdAt: new Date().toISOString(),
  };
  const next = [nextEntry, ...loadDeploymentLog()].slice(0, MAX_LOG_ENTRIES);
  saveDeploymentLog(next);
  return next;
};
