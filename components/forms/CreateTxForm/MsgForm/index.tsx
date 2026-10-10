import { useCallback } from "react";
import { MsgGetter } from "..";
import { MsgTypeUrl, MsgTypeUrls } from "../../../../types/txMsg";
import { gasOfMsg } from "../../../../lib/txMsgHelpers";
import MsgBeginRedelegateForm from "./MsgBeginRedelegateForm";
import MsgCreateValidatorForm from "./MsgCreateValidatorForm";
import MsgEditValidatorForm from "./MsgEditValidatorForm";
import MsgCreateVestingAccountForm from "./MsgCreateVestingAccountForm";
import MsgDelegateForm from "./MsgDelegateForm";
import MsgExecuteContractForm from "./MsgExecuteContractForm";
import MsgFundCommunityPoolForm from "./MsgFundCommunityPoolForm";
import MsgInstantiateContract2Form from "./MsgInstantiateContract2Form";
import MsgInstantiateContractForm from "./MsgInstantiateContractForm";
import MsgMigrateContractForm from "./MsgMigrateContractForm";
import MsgSendForm from "./MsgSendForm";
import MsgSetWithdrawAddressForm from "./MsgSetWithdrawAddressForm";
import MsgTransferForm from "./MsgTransferForm";
import MsgUndelegateForm from "./MsgUndelegateForm";
import MsgUpdateAdminForm from "./MsgUpdateAdminForm";
import MsgVoteForm from "./MsgVoteForm";
import MsgWithdrawDelegatorRewardForm from "./MsgWithdrawDelegatorRewardForm";
import MsgWithdrawValidatorCommissionForm from "./MsgWithdrawValidatorCommissionForm";

interface MsgFormProps {
  readonly msgType: MsgTypeUrl;
  readonly senderAddress: string;
  readonly msgIndex: number;
  readonly setMsgGetter: (index: number, msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
  readonly gasLimit?: number; // Optional gas limit for balance calculations
}

const MsgForm = ({ msgType, gasLimit, msgIndex, setMsgGetter, ...restProps }: MsgFormProps) => {
  // If gasLimit not provided, estimate it from message type
  const estimatedGasLimit = gasLimit || gasOfMsg(msgType);

  // Create a stable wrapper that binds the index to the setMsgGetter call
  // This prevents infinite render loops in child components
  const stableSetMsgGetter = useCallback(
    (msgGetter: MsgGetter) => setMsgGetter(msgIndex, msgGetter),
    [msgIndex, setMsgGetter],
  );

  const propsWithGas = {
    ...restProps,
    setMsgGetter: stableSetMsgGetter,
    gasLimit: estimatedGasLimit,
  };

  switch (msgType) {
    // Bank
    case MsgTypeUrls.Send:
      return <MsgSendForm {...propsWithGas} />;
    // Staking
    case MsgTypeUrls.Delegate:
      return <MsgDelegateForm {...propsWithGas} />;
    case MsgTypeUrls.Undelegate:
      return <MsgUndelegateForm {...propsWithGas} />;
    case MsgTypeUrls.BeginRedelegate:
      return <MsgBeginRedelegateForm {...propsWithGas} />;
    case MsgTypeUrls.CreateValidator:
      return <MsgCreateValidatorForm {...propsWithGas} />;
    case MsgTypeUrls.EditValidator:
      return <MsgEditValidatorForm {...propsWithGas} />;
    // Distribution
    case MsgTypeUrls.FundCommunityPool:
      return <MsgFundCommunityPoolForm {...propsWithGas} />;
    case MsgTypeUrls.SetWithdrawAddress:
      return <MsgSetWithdrawAddressForm {...propsWithGas} />;
    case MsgTypeUrls.WithdrawDelegatorReward:
      return <MsgWithdrawDelegatorRewardForm {...propsWithGas} />;
    case MsgTypeUrls.WithdrawValidatorCommission:
      return <MsgWithdrawValidatorCommissionForm {...propsWithGas} />;
    // Vesting
    case MsgTypeUrls.CreateVestingAccount:
      return <MsgCreateVestingAccountForm {...propsWithGas} />;
    // Governance
    case MsgTypeUrls.Vote:
      return <MsgVoteForm {...propsWithGas} />;
    // IBC
    case MsgTypeUrls.Transfer:
      return <MsgTransferForm {...propsWithGas} />;
    // CosmWasm
    case MsgTypeUrls.InstantiateContract:
      return <MsgInstantiateContractForm {...propsWithGas} />;
    case MsgTypeUrls.InstantiateContract2:
      return <MsgInstantiateContract2Form {...propsWithGas} />;
    case MsgTypeUrls.UpdateAdmin:
      return <MsgUpdateAdminForm {...propsWithGas} />;
    case MsgTypeUrls.ExecuteContract:
      return <MsgExecuteContractForm {...propsWithGas} />;
    case MsgTypeUrls.MigrateContract:
      return <MsgMigrateContractForm {...propsWithGas} />;
    default:
      return null;
  }
};

export default MsgForm;
