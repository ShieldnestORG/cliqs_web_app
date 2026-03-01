/**
 * Validator Dashboard Helper Functions
 *
 * File: lib/validatorHelpers.ts
 *
 * Query functions for validator-specific data including commission,
 * rewards, performance metrics, and account conversions.
 */

import {
  QueryClient,
  StakingExtension,
  DistributionExtension,
  GovExtension,
  setupStakingExtension,
  setupDistributionExtension,
  setupGovExtension,
  Coin,
} from "@cosmjs/stargate";
import { connectComet } from "@cosmjs/tendermint-rpc";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { Validator, DelegationResponse, UnbondingDelegation } from "cosmjs-types/cosmos/staking/v1beta1/staking";
import { DecCoin } from "cosmjs-types/cosmos/base/v1beta1/coin";
import { Proposal, Vote, ProposalStatus } from "cosmjs-types/cosmos/gov/v1beta1/gov";

/**
 * Extended query client with all extensions we need
 */
export type ValidatorQueryClient = QueryClient &
  StakingExtension &
  DistributionExtension &
  GovExtension;

/**
 * Create a query client with staking, distribution and gov extensions
 */
export async function createValidatorQueryClient(
  rpcUrl: string
): Promise<ValidatorQueryClient> {
  const cometClient = await connectComet(rpcUrl);
  return QueryClient.withExtensions(
    cometClient,
    setupStakingExtension,
    setupDistributionExtension,
    setupGovExtension
  );
}

/**
 * Convert a delegator/account address to validator operator address
 * e.g., core1abc... -> corevaloper1abc...
 */
export function delegatorToValidatorAddress(
  delegatorAddress: string,
  addressPrefix: string
): string {
  try {
    const decoded = fromBech32(delegatorAddress);
    const validatorPrefix = addressPrefix.startsWith("cosmos")
      ? "cosmosvaloper"
      : `${addressPrefix}valoper`;
    return toBech32(validatorPrefix, decoded.data);
  } catch (e) {
    throw new Error(
      `Failed to convert to validator address: ${e instanceof Error ? e.message : "Unknown error"}`
    );
  }
}

/**
 * Convert a validator operator address to delegator/account address
 * e.g., corevaloper1abc... -> core1abc...
 */
export function validatorToDelegatorAddress(
  validatorAddress: string,
  addressPrefix: string
): string {
  try {
    const decoded = fromBech32(validatorAddress);
    return toBech32(addressPrefix, decoded.data);
  } catch (e) {
    throw new Error(
      `Failed to convert to delegator address: ${e instanceof Error ? e.message : "Unknown error"}`
    );
  }
}

/**
 * Convert validator operator address to consensus address
 * For slashing info queries (signing info uses consensus pubkey)
 */
export function validatorToConsensusAddress(
  validatorAddress: string,
  addressPrefix: string
): string {
  try {
    const decoded = fromBech32(validatorAddress);
    const consensusPrefix = `${addressPrefix}valcons`;
    return toBech32(consensusPrefix, decoded.data);
  } catch (e) {
    throw new Error(
      `Failed to convert to consensus address: ${e instanceof Error ? e.message : "Unknown error"}`
    );
  }
}

/**
 * Check if an address is a validator operator address
 */
export function isValidatorAddress(address: string): boolean {
  try {
    const decoded = fromBech32(address);
    return decoded.prefix.endsWith("valoper");
  } catch {
    return false;
  }
}

/**
 * Validator info including parsed data
 */
export interface ValidatorInfo {
  operatorAddress: string;
  delegatorAddress: string;
  moniker: string;
  identity: string;
  website: string;
  securityContact: string;
  details: string;
  commissionRate: string;
  maxCommissionRate: string;
  maxCommissionChangeRate: string;
  minSelfDelegation: string;
  jailed: boolean;
  status: "BONDED" | "UNBONDING" | "UNBONDED";
  tokens: string;
  delegatorShares: string;
}

/**
 * Parse validator status from numeric enum
 */
function parseValidatorStatus(
  status: number
): "BONDED" | "UNBONDING" | "UNBONDED" {
  switch (status) {
    case 3:
      return "BONDED";
    case 2:
      return "UNBONDING";
    default:
      return "UNBONDED";
  }
}

/**
 * Parse validator from protobuf to our interface
 */
export function parseValidator(
  validator: Validator,
  addressPrefix: string
): ValidatorInfo {
  const operatorAddress = validator.operatorAddress;
  const delegatorAddress = validatorToDelegatorAddress(
    operatorAddress,
    addressPrefix
  );

  return {
    operatorAddress,
    delegatorAddress,
    moniker: validator.description?.moniker || "Unknown",
    identity: validator.description?.identity || "",
    website: validator.description?.website || "",
    securityContact: validator.description?.securityContact || "",
    details: validator.description?.details || "",
    commissionRate: validator.commission?.commissionRates?.rate || "0",
    maxCommissionRate: validator.commission?.commissionRates?.maxRate || "0",
    maxCommissionChangeRate:
      validator.commission?.commissionRates?.maxChangeRate || "0",
    minSelfDelegation: validator.minSelfDelegation,
    jailed: validator.jailed,
    status: parseValidatorStatus(validator.status),
    tokens: validator.tokens,
    delegatorShares: validator.delegatorShares,
  };
}

/**
 * Get validator info by operator address
 */
export async function getValidatorInfo(
  queryClient: ValidatorQueryClient,
  validatorAddress: string,
  addressPrefix: string
): Promise<ValidatorInfo | null> {
  try {
    const response = await queryClient.staking.validator(validatorAddress);
    if (!response.validator) {
      return null;
    }
    return parseValidator(response.validator, addressPrefix);
  } catch (e) {
    // Validator not found is expected for non-validator addresses
    const errorStr = e instanceof Error ? e.message : String(e);
    if (errorStr.includes("not found") || errorStr.includes("NotFound")) {
      return null;
    }
    console.error("Failed to get validator info:", e);
    return null;
  }
}

/**
 * Check if a delegator address has an associated validator
 */
export async function getValidatorForDelegator(
  queryClient: ValidatorQueryClient,
  delegatorAddress: string,
  addressPrefix: string
): Promise<ValidatorInfo | null> {
  const validatorAddress = delegatorToValidatorAddress(
    delegatorAddress,
    addressPrefix
  );
  return getValidatorInfo(queryClient, validatorAddress, addressPrefix);
}

/**
 * Pending commission for a validator
 */
export interface ValidatorCommission {
  commission: readonly DecCoin[];
}

/**
 * Get validator pending commission
 */
export async function getValidatorCommission(
  queryClient: ValidatorQueryClient,
  validatorAddress: string
): Promise<ValidatorCommission> {
  try {
    const response =
      await queryClient.distribution.validatorCommission(validatorAddress);
    return {
      commission: response.commission?.commission || [],
    };
  } catch (e) {
    console.error("Failed to get validator commission:", e);
    return { commission: [] };
  }
}

/**
 * Get delegator rewards for their self-delegation
 */
export async function getSelfDelegationRewards(
  queryClient: ValidatorQueryClient,
  delegatorAddress: string,
  validatorAddress: string
): Promise<readonly DecCoin[]> {
  try {
    const response = await queryClient.distribution.delegationRewards(
      delegatorAddress,
      validatorAddress
    );
    return response.rewards || [];
  } catch (e) {
    console.error("Failed to get delegation rewards:", e);
    return [];
  }
}

/**
 * Get the withdraw address for a delegator
 */
export async function getWithdrawAddress(
  queryClient: ValidatorQueryClient,
  delegatorAddress: string
): Promise<string> {
  try {
    const response =
      await queryClient.distribution.delegatorWithdrawAddress(delegatorAddress);
    return response.withdrawAddress || delegatorAddress;
  } catch (e) {
    console.error("Failed to get withdraw address:", e);
    return delegatorAddress;
  }
}

/**
 * Validator signing info (for uptime calculation)
 */
export interface ValidatorSigningInfo {
  missedBlocksCounter: bigint;
  jailedUntil: Date | null;
  tombstoned: boolean;
  startHeight: bigint;
}

/**
 * Get validator signing info (requires consensus address)
 * Note: This requires the consensus pubkey to derive the consensus address
 * For now, we'll skip this as it requires additional info
 */
export async function getValidatorSigningInfo(
  _queryClient: ValidatorQueryClient,
  _consensusAddress: string
): Promise<ValidatorSigningInfo | null> {
  // This query requires the validator's consensus pubkey-derived address
  // which isn't directly available from the operator address
  // For now, return null - we can enhance this later
  return null;
}

/**
 * Get total delegators count for a validator (paginated)
 */
export async function getValidatorDelegatorsCount(
  queryClient: ValidatorQueryClient,
  validatorAddress: string
): Promise<number> {
  try {
    let count = 0;
    let paginationKey: Uint8Array | undefined;

    do {
      const response = await queryClient.staking.validatorDelegations(
        validatorAddress,
        paginationKey
      );
      count += response.delegationResponses.length;
      paginationKey = response.pagination?.nextKey;
    } while (paginationKey?.length);

    return count;
  } catch (e) {
    console.error("Failed to get delegators count:", e);
    return 0;
  }
}

/**
 * Get self-delegation amount
 */
export async function getSelfDelegation(
  queryClient: ValidatorQueryClient,
  delegatorAddress: string,
  validatorAddress: string
): Promise<Coin | null> {
  try {
    const response = await queryClient.staking.delegation(
      delegatorAddress,
      validatorAddress
    );
    return response.delegationResponse?.balance || null;
  } catch {
    // No delegation found is not an error
    return null;
  }
}

/**
 * Convert DecCoin to Coin (truncating decimals)
 */
export function decCoinToCoin(decCoin: DecCoin): Coin {
  // DecCoin amounts are stored as strings with 18 decimal places
  // e.g., "1000000000000000000" for 1 token
  const amountStr = decCoin.amount;

  // Remove trailing zeros and decimal part by dividing by 10^18
  // For display purposes, we'll keep more precision
  let amount = "0";
  if (amountStr.length > 18) {
    amount = amountStr.slice(0, amountStr.length - 18);
  } else {
    // Amount is less than 1 whole unit
    amount = "0";
  }

  return {
    denom: decCoin.denom,
    amount,
  };
}

/**
 * Format DecCoin amount for display (with decimals)
 */
export function formatDecCoinAmount(
  amount: string,
  decimals: number = 6
): string {
  // DecCoin amounts are in base units * 10^18
  if (!amount || amount === "0") return "0";

  // First convert from 18-decimal precision to base units
  let baseAmount: string;
  if (amount.length > 18) {
    baseAmount = amount.slice(0, amount.length - 18);
  } else {
    baseAmount = "0";
  }

  // Then format with chain decimals (usually 6)
  if (!baseAmount || baseAmount === "0") return "0";

  const amountNum = parseInt(baseAmount, 10);
  const divisor = Math.pow(10, decimals);
  const formatted = (amountNum / divisor).toFixed(decimals);

  // Remove trailing zeros
  return parseFloat(formatted).toString();
}

/**
 * Sum multiple DecCoins of the same denom
 */
export function sumDecCoins(coins: readonly DecCoin[]): Map<string, string> {
  const sums = new Map<string, bigint>();

  for (const coin of coins) {
    const current = sums.get(coin.denom) || BigInt(0);
    sums.set(coin.denom, current + BigInt(coin.amount));
  }

  const result = new Map<string, string>();
  for (const [denom, amount] of sums) {
    result.set(denom, amount.toString());
  }

  return result;
}

/**
 * Get validator ranking in active set
 */
export async function getValidatorRanking(
  rpcUrl: string,
  validatorAddress: string
): Promise<number | null> {
  try {
    const cometClient = await connectComet(rpcUrl);
    const queryClient = QueryClient.withExtensions(
      cometClient,
      setupStakingExtension
    );

    // Get all bonded validators
    const validators: Validator[] = [];
    let paginationKey: Uint8Array | undefined;

    do {
      const response = await queryClient.staking.validators(
        "BOND_STATUS_BONDED",
        paginationKey
      );
      validators.push(...response.validators);
      paginationKey = response.pagination?.nextKey;
    } while (paginationKey?.length);

    // Sort by tokens (voting power)
    validators.sort((a, b) => {
      const tokensA = BigInt(a.tokens);
      const tokensB = BigInt(b.tokens);
      if (tokensB > tokensA) return 1;
      if (tokensB < tokensA) return -1;
      return 0;
    });

    // Find the validator's position
    const index = validators.findIndex(
      (v) => v.operatorAddress === validatorAddress
    );
    return index >= 0 ? index + 1 : null;
  } catch (e) {
    console.error("Failed to get validator ranking:", e);
    return null;
  }
}

/**
 * Calculate voting power percentage
 */
export async function getVotingPowerPercentage(
  rpcUrl: string,
  validatorTokens: string
): Promise<string> {
  try {
    const cometClient = await connectComet(rpcUrl);
    const queryClient = QueryClient.withExtensions(
      cometClient,
      setupStakingExtension
    );

    // Get total bonded tokens from staking pool
    const pool = await queryClient.staking.pool();
    const bondedTokens = BigInt(pool.pool?.bondedTokens || "0");
    const validatorTokensBigInt = BigInt(validatorTokens);

    if (bondedTokens === BigInt(0)) return "0";

    const percentage =
      (validatorTokensBigInt * BigInt(10000)) / bondedTokens;
    const percentageNum = Number(percentage) / 100;

    return percentageNum.toFixed(2);
  } catch (e) {
    console.error("Failed to calculate voting power:", e);
    return "0";
  }
}

/**
 * Get all delegations for a validator
 */
export async function getValidatorDelegations(
  queryClient: ValidatorQueryClient,
  validatorAddress: string
): Promise<DelegationResponse[]> {
  try {
    const delegations: DelegationResponse[] = [];
    let paginationKey: Uint8Array | undefined;

    do {
      const response = await queryClient.staking.validatorDelegations(
        validatorAddress,
        paginationKey
      );
      delegations.push(...response.delegationResponses);
      paginationKey = response.pagination?.nextKey;
    } while (paginationKey?.length);

    // Sort by amount descending
    return delegations.sort((a, b) => {
      const amountA = BigInt(a.balance?.amount || "0");
      const amountB = BigInt(b.balance?.amount || "0");
      if (amountB > amountA) return 1;
      if (amountB < amountA) return -1;
      return 0;
    });
  } catch (e) {
    console.error("Failed to get validator delegations:", e);
    return [];
  }
}

/**
 * Get all unbonding delegations for a validator
 */
export async function getValidatorUnbondingDelegations(
  queryClient: ValidatorQueryClient,
  validatorAddress: string
): Promise<UnbondingDelegation[]> {
  try {
    const unbondings: UnbondingDelegation[] = [];
    let paginationKey: Uint8Array | undefined;

    do {
      const response = await queryClient.staking.validatorUnbondingDelegations(
        validatorAddress,
        paginationKey
      );
      unbondings.push(...response.unbondingResponses);
      paginationKey = response.pagination?.nextKey;
    } while (paginationKey?.length);

    return unbondings;
  } catch (e) {
    console.error("Failed to get validator unbonding delegations:", e);
    return [];
  }
}

/**
 * Derive REST/LCD endpoints from an RPC endpoint.
 * Many nodes serve REST on port 1317 when RPC is on 26657.
 */
function deriveRestEndpoints(rpcEndpoint: string): string[] {
  const endpoints = [rpcEndpoint];
  try {
    const url = new URL(rpcEndpoint);
    if (url.port === "26657") {
      url.port = "1317";
      endpoints.push(url.toString().replace(/\/$/, ""));
    }
    if (url.port) {
      const noPort = new URL(rpcEndpoint);
      noPort.port = "";
      endpoints.push(noPort.toString().replace(/\/$/, ""));
    }
  } catch {
    // Invalid URL, just use as-is
  }
  return endpoints;
}

/**
 * Gov v1 proposal response shape from REST API
 */
interface GovV1Proposal {
  id: string;
  status: string;
  final_tally_result?: {
    yes_count?: string;
    abstain_count?: string;
    no_count?: string;
    no_with_veto_count?: string;
  };
  submit_time?: string;
  deposit_end_time?: string;
  total_deposit?: Array<{ denom: string; amount: string }>;
  voting_start_time?: string;
  voting_end_time?: string;
  title?: string;
  summary?: string;
  proposer?: string;
  messages?: unknown[];
}

interface GovV1ProposalsResponse {
  proposals: GovV1Proposal[];
}

/**
 * Convert gov v1 proposal to v1beta1 Proposal type for compatibility
 */
function convertV1ToV1Beta1Proposal(v1: GovV1Proposal): Proposal {
  const statusMap: Record<string, number> = {
    PROPOSAL_STATUS_VOTING_PERIOD: 2,
    PROPOSAL_STATUS_PASSED: 3,
    PROPOSAL_STATUS_REJECTED: 4,
    PROPOSAL_STATUS_FAILED: 5,
  };

  return {
    proposalId: BigInt(v1.id),
    status: statusMap[v1.status] ?? 2,
    finalTallyResult: v1.final_tally_result ? {
      yes: v1.final_tally_result.yes_count || "0",
      abstain: v1.final_tally_result.abstain_count || "0",
      no: v1.final_tally_result.no_count || "0",
      noWithVeto: v1.final_tally_result.no_with_veto_count || "0",
    } : {
      yes: "0",
      abstain: "0",
      no: "0",
      noWithVeto: "0",
    },
    submitTime: v1.submit_time ? { seconds: BigInt(Math.floor(new Date(v1.submit_time).getTime() / 1000)), nanos: 0 } : { seconds: 0n, nanos: 0 },
    depositEndTime: v1.deposit_end_time ? { seconds: BigInt(Math.floor(new Date(v1.deposit_end_time).getTime() / 1000)), nanos: 0 } : { seconds: 0n, nanos: 0 },
    totalDeposit: v1.total_deposit?.map(d => ({ denom: d.denom, amount: d.amount })) || [],
    votingStartTime: v1.voting_start_time ? { seconds: BigInt(Math.floor(new Date(v1.voting_start_time).getTime() / 1000)), nanos: 0 } : { seconds: 0n, nanos: 0 },
    votingEndTime: v1.voting_end_time ? { seconds: BigInt(Math.floor(new Date(v1.voting_end_time).getTime() / 1000)), nanos: 0 } : { seconds: 0n, nanos: 0 },
    content: {
      typeUrl: "/cosmos.gov.v1.MsgExecLegacyContent",
      value: new Uint8Array(),
      title: v1.title || "",
      description: v1.summary || "",
    } as unknown as Proposal["content"],
  };
}

/**
 * Fetch proposals via gov v1 REST API (fallback for chains that migrated from v1beta1)
 */
async function fetchProposalsViaRest(rpcUrl: string): Promise<Proposal[]> {
  const endpoints = deriveRestEndpoints(rpcUrl);
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(
        `${endpoint}/cosmos/gov/v1/proposals?proposal_status=2`,
        { headers: { Accept: "application/json" } }
      );
      
      if (!response.ok) continue;
      
      const data: GovV1ProposalsResponse = await response.json();
      if (data.proposals && data.proposals.length > 0) {
        return data.proposals.map(convertV1ToV1Beta1Proposal);
      }
    } catch {
      // Try next endpoint
    }
  }
  
  return [];
}

/**
 * Get active proposals that need voting.
 * Tries v1beta1 first, falls back to v1 REST API for newer chains.
 */
export async function getActiveProposals(
  queryClient: ValidatorQueryClient,
  rpcUrl: string
): Promise<Proposal[]> {
  try {
    // Try v1beta1 first (older chains)
    const response = await queryClient.gov.proposals(
      ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD,
      "",
      ""
    );
    if (response.proposals.length > 0) {
      return response.proposals;
    }
  } catch (e) {
    // v1beta1 failed, will try v1 REST fallback
  }

  // Fallback to gov v1 REST API for chains that migrated
  try {
    return await fetchProposalsViaRest(rpcUrl);
  } catch (e) {
    console.error("Failed to get active proposals:", e);
    return [];
  }
}

/**
 * Get validator's vote for a specific proposal
 */
export async function getValidatorVote(
  queryClient: ValidatorQueryClient,
  proposalId: number,
  voterAddress: string
): Promise<Vote | null> {
  try {
    const response = await queryClient.gov.vote(proposalId, voterAddress);
    return response.vote || null;
  } catch {
    // No vote found is common
    return null;
  }
}

/**
 * Combined validator dashboard data
 */
export interface ValidatorDashboardData {
  validator: ValidatorInfo;
  commission: readonly DecCoin[];
  selfDelegationRewards: readonly DecCoin[];
  withdrawAddress: string;
  delegatorsCount: number;
  delegations: DelegationResponse[];
  unbondingDelegations: UnbondingDelegation[];
  activeProposals: Proposal[];
  validatorVotes: Record<number, Vote | null>;
  selfDelegation: Coin | null;
  ranking: number | null;
  votingPowerPercentage: string;
}

/**
 * Fetch all validator dashboard data in one call
 */
export async function getValidatorDashboardData(
  rpcUrl: string,
  delegatorAddress: string,
  addressPrefix: string
): Promise<ValidatorDashboardData | null> {
  try {
    const queryClient = await createValidatorQueryClient(rpcUrl);
    const validatorAddress = delegatorToValidatorAddress(
      delegatorAddress,
      addressPrefix
    );

    // Get validator info first to check if they're a validator
    const validator = await getValidatorInfo(
      queryClient,
      validatorAddress,
      addressPrefix
    );
    if (!validator) {
      return null;
    }

    // Fetch remaining data in parallel
    const [
      commissionResult,
      rewardsResult,
      withdrawAddressResult,
      selfDelegationResult,
      delegationsResult,
      unbondingsResult,
      activeProposalsResult,
    ] = await Promise.all([
      getValidatorCommission(queryClient, validatorAddress),
      getSelfDelegationRewards(queryClient, delegatorAddress, validatorAddress),
      getWithdrawAddress(queryClient, delegatorAddress),
      getSelfDelegation(queryClient, delegatorAddress, validatorAddress),
      getValidatorDelegations(queryClient, validatorAddress),
      getValidatorUnbondingDelegations(queryClient, validatorAddress),
      getActiveProposals(queryClient, rpcUrl),
    ]);

    // Check votes for active proposals
    const validatorVotes: Record<number, Vote | null> = {};
    if (activeProposalsResult.length > 0) {
      const votePromises = activeProposalsResult.map(async (p) => {
        const proposalId = Number(p.proposalId);
        const vote = await getValidatorVote(queryClient, proposalId, delegatorAddress);
        validatorVotes[proposalId] = vote;
      });
      await Promise.all(votePromises);
    }

    // These can be slow, fetch separately
    const [delegatorsCount, ranking, votingPowerPercentage] = await Promise.all(
      [
        getValidatorDelegatorsCount(queryClient, validatorAddress),
        getValidatorRanking(rpcUrl, validatorAddress),
        getVotingPowerPercentage(rpcUrl, validator.tokens),
      ]
    );

    return {
      validator,
      commission: commissionResult.commission,
      selfDelegationRewards: rewardsResult,
      withdrawAddress: withdrawAddressResult,
      delegatorsCount,
      delegations: delegationsResult,
      unbondingDelegations: unbondingsResult,
      activeProposals: activeProposalsResult,
      validatorVotes,
      selfDelegation: selfDelegationResult,
      ranking,
      votingPowerPercentage,
    };
  } catch (e) {
    console.error("Failed to fetch validator dashboard data:", e);
    return null;
  }
}

/**
 * Find all validators associated with an address and its multisigs
 */
export async function getAssociatedValidators(
  rpcUrl: string,
  address: string,
  multisigAddresses: string[],
  addressPrefix: string
): Promise<{ address: string; validator: ValidatorInfo }[]> {
  try {
    const queryClient = await createValidatorQueryClient(rpcUrl);
    const allAddresses = Array.from(new Set([address, ...multisigAddresses]));
    
    const results = await Promise.all(
      allAddresses.map(async (addr) => {
        try {
          const valAddr = delegatorToValidatorAddress(addr, addressPrefix);
          const validator = await getValidatorInfo(queryClient, valAddr, addressPrefix);
          return validator ? { address: addr, validator } : null;
        } catch (e) {
          // Silently ignore errors for individual address checks
          return null;
        }
      })
    );

    return results.filter((r): r is { address: string; validator: ValidatorInfo } => r !== null);
  } catch (e) {
    // Don't log error if it's just a connection issue during initial load
    return [];
  }
}

