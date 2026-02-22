import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useChains } from "@/context/ChainsContext";
import { ReloadIcon } from "@radix-ui/react-icons";
import { Info, Users, Check } from "lucide-react";
import { UseFormReturn, useFormState } from "react-hook-form";

interface ConfirmCreateMultisigProps {
  readonly createMultisigForm: UseFormReturn<{ members: { member: string }[]; threshold: number }>;
}

export default function ConfirmCreateMultisig({ createMultisigForm }: ConfirmCreateMultisigProps) {
  const { chain } = useChains();
  const { isValid, isSubmitting, isSubmitted } = useFormState(createMultisigForm);
  const { members, threshold } = createMultisigForm.getValues();

  const loading = isSubmitting || isSubmitted;
  const filteredMembers = members.filter(({ member }) => member !== "");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="action"
          size="action"
          className="w-full"
          onClick={(e) => {
            createMultisigForm.trigger();

            if (!isValid) {
              e.preventDefault();
            }
          }}
        >
          <Check className="h-4 w-4 mr-2" />
          Create Multisig
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-y-auto max-w-lg">
        <DialogTitle className="font-heading text-xl">
          Create multisig on {chain.chainDisplayName}?
        </DialogTitle>
        
        {/* Members List */}
        <div className="space-y-3 mt-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{filteredMembers.length} Members</span>
          </div>
          <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
            {filteredMembers.map(({ member }, index) => (
              <div
                key={member}
                className="flex items-center gap-3 rounded-lg border-2 border-border p-3 transition-colors bg-muted/30"
              >
                <div className="w-6 h-6 rounded-full bg-green-accent/20 flex items-center justify-center text-xs font-mono font-bold text-green-accent">
                  {index + 1}
                </div>
                <p className="text-sm font-mono leading-none truncate flex-1">
                  {member}
                </p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Threshold Info */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mt-4">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{threshold}</span>{" "}
            {threshold === 1 ? "signature" : "signatures"} needed to send a transaction.
          </p>
        </div>
        
        {/* Action Buttons - Vertical on mobile, horizontal on desktop */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
          <DialogClose asChild>
            <Button 
              variant="action-outline" 
              size="action"
              className="w-full sm:flex-1" 
              disabled={loading}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button 
            variant="action"
            size="action"
            type="submit" 
            form="create-multisig-form" 
            className="w-full sm:flex-1" 
            disabled={loading}
          >
            {loading ? <ReloadIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Multisig
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
