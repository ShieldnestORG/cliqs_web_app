import { DbTransactionParsedDataJson } from "@/graphql";
import { MsgTypeUrls } from "@/types/txMsg";
import { EncodeObject } from "@cosmjs/proto-signing";
import { useChains } from "../../../context/ChainsContext";
import { printableCoins } from "../../../lib/displayHelpers";
import StackableContainer from "../../layout/StackableContainer";
import HashView from "../HashView";
import React from "react";
import TxMsgBeginRedelegateDetails from "./TxMsgBeginRedelegateDetails";
import TxMsgCreateValidatorDetails from "./TxMsgCreateValidatorDetails";
import TxMsgCreateVestingAccountDetails from "./TxMsgCreateVestingAccountDetails";
import TxMsgDelegateDetails from "./TxMsgDelegateDetails";
import TxMsgExecuteContractDetails from "./TxMsgExecuteContractDetails";
import TxMsgFundCommunityPoolDetails from "./TxMsgFundCommunityPoolDetails";
import TxMsgInstantiateContract2Details from "./TxMsgInstantiateContract2Details";
import TxMsgInstantiateContractDetails from "./TxMsgInstantiateContractDetails";
import TxMsgMigrateContractDetails from "./TxMsgMigrateContractDetails";
import TxMsgSendDetails from "./TxMsgSendDetails";
import TxMsgSetWithdrawAddressDetails from "./TxMsgSetWithdrawAddressDetails";
import TxMsgTransferDetails from "./TxMsgTransferDetails";
import TxMsgUndelegateDetails from "./TxMsgUndelegateDetails";
import TxMsgUpdateAdminDetails from "./TxMsgUpdateAdminDetails";
import TxMsgVoteDetails from "./TxMsgVoteDetails";
import TxMsgWithdrawDelegatorRewardDetails from "./TxMsgWithdrawDelegatorRewardDetails";
import TxMsgWithdrawValidatorCommissionDetails from "./TxMsgWithdrawValidatorCommissionDetails";

const TxMsgDetails = ({ typeUrl, value: msgValue }: EncodeObject) => {
  switch (typeUrl) {
    // Bank
    case MsgTypeUrls.Send:
      return <TxMsgSendDetails msgValue={msgValue} />;
    // Staking
    case MsgTypeUrls.Delegate:
      return <TxMsgDelegateDetails msgValue={msgValue} />;
    case MsgTypeUrls.Undelegate:
      return <TxMsgUndelegateDetails msgValue={msgValue} />;
    case MsgTypeUrls.BeginRedelegate:
      return <TxMsgBeginRedelegateDetails msgValue={msgValue} />;
    case MsgTypeUrls.CreateValidator:
      return <TxMsgCreateValidatorDetails msgValue={msgValue} />;
    // Distribution
    case MsgTypeUrls.FundCommunityPool:
      return <TxMsgFundCommunityPoolDetails msgValue={msgValue} />;
    case MsgTypeUrls.SetWithdrawAddress:
      return <TxMsgSetWithdrawAddressDetails msgValue={msgValue} />;
    case MsgTypeUrls.WithdrawDelegatorReward:
      return <TxMsgWithdrawDelegatorRewardDetails msgValue={msgValue} />;
    case MsgTypeUrls.WithdrawValidatorCommission:
      return <TxMsgWithdrawValidatorCommissionDetails msgValue={msgValue} />;
    // Vesting
    case MsgTypeUrls.CreateVestingAccount:
      return <TxMsgCreateVestingAccountDetails msgValue={msgValue} />;
    // Governance
    case MsgTypeUrls.Vote:
      return <TxMsgVoteDetails msgValue={msgValue} />;
    // IBC
    case MsgTypeUrls.Transfer:
      return <TxMsgTransferDetails msgValue={msgValue} />;
    // CosmWasm
    case MsgTypeUrls.InstantiateContract:
      return <TxMsgInstantiateContractDetails msgValue={msgValue} />;
    case MsgTypeUrls.InstantiateContract2:
      return <TxMsgInstantiateContract2Details msgValue={msgValue} />;
    case MsgTypeUrls.UpdateAdmin:
      return <TxMsgUpdateAdminDetails msgValue={msgValue} />;
    case MsgTypeUrls.ExecuteContract:
      return <TxMsgExecuteContractDetails msgValue={msgValue} />;
    case MsgTypeUrls.MigrateContract:
      return <TxMsgMigrateContractDetails msgValue={msgValue} />;
    default:
      return null;
  }
};

interface TransactionInfoProps {
  readonly tx: DbTransactionParsedDataJson;
  readonly currentOnChainSequence?: number;
  readonly compact?: boolean;
}

const TransactionInfo = ({ tx, currentOnChainSequence, compact }: TransactionInfoProps) => {
  const { chain } = useChains();
  const hasSequenceMismatch =
    currentOnChainSequence !== undefined && currentOnChainSequence !== tx.sequence;

  // Compact mode for message card - clean formatted display
  if (compact) {
    return (
      <div className="space-y-4">
        {tx.msgs.map((msg, index) => {
          const msgType = msg.typeUrl.split(".").pop()?.replace("Msg", "") || msg.typeUrl;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msgValue = msg.value as Record<string, any>;

          // Extract key fields based on message type
          const getMessageFields = () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fields: Array<{ label: string; value: any; isAddress?: boolean }> = [];

            // Common address fields
            if (msgValue.validatorAddress) {
              fields.push({
                label: "Validator Address",
                value: msgValue.validatorAddress,
                isAddress: true,
              });
            }
            if (msgValue.delegatorAddress) {
              fields.push({
                label: "Delegator Address",
                value: msgValue.delegatorAddress,
                isAddress: true,
              });
            }
            if (msgValue.fromAddress) {
              fields.push({ label: "From Address", value: msgValue.fromAddress, isAddress: true });
            }
            if (msgValue.toAddress) {
              fields.push({ label: "To Address", value: msgValue.toAddress, isAddress: true });
            }
            if (msgValue.sender) {
              fields.push({ label: "Sender", value: msgValue.sender, isAddress: true });
            }
            if (msgValue.receiver) {
              fields.push({ label: "Receiver", value: msgValue.receiver, isAddress: true });
            }

            // Amount fields
            if (msgValue.amount) {
              if (Array.isArray(msgValue.amount)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const amounts = msgValue.amount
                  .map((a: any) => `${a.amount} ${a.denom}`)
                  .join(", ");
                fields.push({ label: "Amount", value: amounts });
              } else if (msgValue.amount.amount) {
                fields.push({
                  label: "Amount",
                  value: `${msgValue.amount.amount} ${msgValue.amount.denom}`,
                });
              }
            }

            // Other common fields
            if (msgValue.contract) {
              fields.push({ label: "Contract", value: msgValue.contract, isAddress: true });
            }
            if (msgValue.codeId) {
              fields.push({ label: "Code ID", value: String(msgValue.codeId) });
            }
            if (msgValue.proposalId) {
              fields.push({ label: "Proposal ID", value: String(msgValue.proposalId) });
            }
            if (msgValue.option) {
              fields.push({ label: "Option", value: String(msgValue.option) });
            }

            return fields;
          };

          const fields = getMessageFields();

          return (
            <div key={index} className="space-y-3">
              <div className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                {msgType}
              </div>
              {fields.length > 0 ? (
                <div className="space-y-3">
                  {fields.map((field, fieldIndex) => (
                    <div key={fieldIndex} className="space-y-1">
                      <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                        {field.label}:
                      </div>
                      <div
                        className={`rounded-lg border border-border/50 bg-muted/20 p-2 font-mono text-sm ${field.isAddress ? "break-all" : ""}`}
                      >
                        {field.isAddress ? (
                          <HashView hash={field.value} />
                        ) : (
                          <span className="break-words">{field.value}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm italic text-muted-foreground">No additional details</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Full mode (original layout)
  return (
    <>
      <ul className="meta-data">
        <>
          <StackableContainer lessPadding lessMargin>
            <li className="signing-info-header">
              <label>Signing Info</label>
            </li>
            <li>
              <label>Chain ID:</label>
              <div>{tx.chainId}</div>
            </li>
            <li>
              <label>Account #:</label>
              <div>{tx.accountNumber}</div>
            </li>
            <li className={hasSequenceMismatch ? "sequence-mismatch" : ""}>
              <label>Tx Sequence:</label>
              <div>{tx.sequence}</div>
              {hasSequenceMismatch && (
                <span className="mismatch-indicator">⚠️ Chain is at {currentOnChainSequence}</span>
              )}
            </li>
            {currentOnChainSequence !== undefined && (
              <li>
                <label>Chain Sequence:</label>
                <div
                  style={{
                    color: hasSequenceMismatch ? "#ff9999" : "#99ff99",
                    fontWeight: "bold",
                  }}
                >
                  {currentOnChainSequence}
                  {hasSequenceMismatch ? " ❌ MISMATCH" : " ✅ OK"}
                </div>
              </li>
            )}
            {tx.fee ? (
              <>
                <li>
                  <label>Gas:</label>
                  <div>{tx.fee.gas}</div>
                </li>
                <li>
                  <label>Fee:</label>
                  <div>{printableCoins(tx.fee.amount, chain) || "None"}</div>
                </li>
              </>
            ) : null}
            {tx.memo ? (
              <li>
                <label>Memo:</label>
                <div>{tx.memo}</div>
              </li>
            ) : null}
          </StackableContainer>
          <StackableContainer lessPadding lessMargin>
            {tx.msgs.map((msg, index) => (
              <StackableContainer key={index} lessPadding lessMargin>
                <TxMsgDetails {...msg} />
              </StackableContainer>
            ))}
          </StackableContainer>
        </>
      </ul>
      <style jsx>{`
        .meta-data {
          list-style: none;
          padding: 0;
          margin: 0;
          margin-top: 25px;
        }
        .meta-data li {
          margin-top: 10px;
          background: rgba(255, 255, 255, 0.03);
          padding: 6px 10px;
          border-radius: 8px;
          display: flex;
          align-items: center;
        }
        .meta-data li.signing-info-header {
          background: transparent;
          padding: 0;
          margin-bottom: -5px;
        }
        .meta-data li.signing-info-header label {
          background: transparent;
          font-size: 14px;
          font-weight: bold;
          color: rgba(255, 255, 255, 0.7);
        }
        .meta-data li div {
          padding: 3px 6px;
        }
        .meta-data label {
          font-size: 12px;
          background: rgba(255, 255, 255, 0.1);
          padding: 3px 6px;
          border-radius: 5px;
          display: block;
        }
        .meta-data li.sequence-mismatch {
          background: rgba(255, 100, 100, 0.15);
          border: 1px solid rgba(255, 100, 100, 0.3);
        }
        .mismatch-indicator {
          margin-left: auto;
          font-size: 12px;
          color: #ff9999;
          background: rgba(255, 100, 100, 0.2);
          padding: 3px 8px;
          border-radius: 5px;
        }
      `}</style>
    </>
  );
};

export default TransactionInfo;
