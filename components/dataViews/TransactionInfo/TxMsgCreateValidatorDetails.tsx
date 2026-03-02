import { MsgCreateValidator } from "cosmjs-types/cosmos/staking/v1beta1/tx";

interface TxMsgCreateValidatorDetailsProps {
  readonly msgValue: MsgCreateValidator;
}

const TxMsgCreateValidatorDetails = ({ msgValue }: TxMsgCreateValidatorDetailsProps) => {
  return (
    <div>
      <li>
        <label>Type:</label>
        <div>MsgCreateValidator</div>
      </li>
      <li>
        <label>Moniker:</label>
        <div>{msgValue.description?.moniker}</div>
      </li>
      <li>
        <label>Identity:</label>
        <div>{msgValue.description?.identity}</div>
      </li>
      <li>
        <label>Website:</label>
        <div>{msgValue.description?.website}</div>
      </li>
      <li>
        <label>Security Contact:</label>
        <div>{msgValue.description?.securityContact}</div>
      </li>
      <li>
        <label>Details:</label>
        <div>{msgValue.description?.details}</div>
      </li>
      <li>
        <label>Validator Address:</label>
        <div>{msgValue.validatorAddress}</div>
      </li>
      <li>
        <label>Delegator Address:</label>
        <div>{msgValue.delegatorAddress}</div>
      </li>
      <li>
        <label>Commission Rate:</label>
        <div>{msgValue.commission?.rate}</div>
      </li>
      <li>
        <label>Max Commission Rate:</label>
        <div>{msgValue.commission?.maxRate}</div>
      </li>
      <li>
        <label>Max Commission Change Rate:</label>
        <div>{msgValue.commission?.maxChangeRate}</div>
      </li>
      <li>
        <label>Min Self Delegation:</label>
        <div>{msgValue.minSelfDelegation}</div>
      </li>
      <li>
        <label>Self Delegation Amount:</label>
        <div>
          {msgValue.value?.amount} {msgValue.value?.denom}
        </div>
      </li>
      <li>
        <label>Public Key:</label>
        <div>
          {msgValue.pubkey?.value ? Buffer.from(msgValue.pubkey.value).toString("base64") : "N/A"}
        </div>
      </li>
    </div>
  );
};

export default TxMsgCreateValidatorDetails;
