import { printVoteOption, voteOptions } from "@/lib/gov";
import { MsgVoteEncodeObject } from "@cosmjs/stargate";
import { longify } from "@cosmjs/stargate/build/queryclient";
import { VoteOption, voteOptionFromJSON } from "cosmjs-types/cosmos/gov/v1beta1/gov";
import { useEffect, useState } from "react";
import { MsgGetter } from "..";
import { trimStringsObj } from "../../../../lib/displayHelpers";
import { MsgCodecs, MsgTypeUrls } from "../../../../types/txMsg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StackableContainer from "../../../layout/StackableContainer";
import { X } from "lucide-react";

const selectVoteOptions = voteOptions.map((opt) => {
  const voteOptionObj = voteOptionFromJSON(opt);

  return {
    label: printVoteOption(voteOptionObj),
    value: voteOptionObj,
    key: String(voteOptionObj),
  };
});

interface MsgVoteFormProps {
  readonly senderAddress: string;
  readonly setMsgGetter: (msgGetter: MsgGetter) => void;
  readonly deleteMsg: () => void;
}

const MsgVoteForm = ({ senderAddress, setMsgGetter, deleteMsg }: MsgVoteFormProps) => {
  const [proposalId, setProposalId] = useState("0");
  const [selectedVoteKey, setSelectedVoteKey] = useState(selectVoteOptions[0]?.key ?? "0");

  const [proposalIdError, setProposalIdError] = useState("");

  const trimmedInputs = trimStringsObj({ proposalId });

  useEffect(() => {
    // eslint-disable-next-line no-shadow
    const { proposalId } = trimmedInputs;

    const isMsgValid = (): boolean => {
      setProposalIdError("");

      if (!proposalId || Number(proposalId) <= 0 || !Number.isSafeInteger(Number(proposalId))) {
        setProposalIdError("Proposal ID must be an integer greater than 0");
        return false;
      }

      try {
        longify(proposalId);
      } catch (e: unknown) {
        setProposalIdError(e instanceof Error ? e.message : "Proposal ID is not a valid Big Int");
        return false;
      }

      return true;
    };

    const proposalIdBigInt = (() => {
      try {
        return longify(proposalId);
      } catch {
        return 0n;
      }
    })();

    const selectedVoteOption: VoteOption =
      selectVoteOptions.find((o) => o.key === selectedVoteKey)?.value ?? 0;

    const msgValue = MsgCodecs[MsgTypeUrls.Vote].fromPartial({
      voter: senderAddress,
      proposalId: proposalIdBigInt,
      option: selectedVoteOption,
    });

    const msg: MsgVoteEncodeObject = { typeUrl: MsgTypeUrls.Vote, value: msgValue };

    setMsgGetter({ isMsgValid, msg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVoteKey, senderAddress, trimmedInputs]);
  // Note: setMsgGetter intentionally excluded - it's a stable setter that shouldn't trigger re-runs

  return (
    <StackableContainer variant="institutional" lessPadding lessMargin>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => deleteMsg()}
        className="absolute right-4 top-4 h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </Button>
      <h2 className="text-xl font-heading font-semibold mb-4">MsgVote</h2>
      <div className="space-y-4">
        <Input
          variant="institutional"
          type="number"
          label="Proposal ID"
          name="proposal-id"
          value={proposalId}
          onChange={({ target }) => {
            setProposalId(target.value);
            setProposalIdError("");
          }}
          error={proposalIdError}
        />
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Choose a vote:</label>
          <Select value={selectedVoteKey} onValueChange={setSelectedVoteKey}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select vote option" />
            </SelectTrigger>
            <SelectContent>
              {selectVoteOptions.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </StackableContainer>
  );
};

export default MsgVoteForm;
