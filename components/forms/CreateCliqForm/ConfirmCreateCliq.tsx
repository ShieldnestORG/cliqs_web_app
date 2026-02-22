/**
 * Confirm Create Cliq Dialog
 * 
 * File: components/forms/CreateCliqForm/ConfirmCreateCliq.tsx
 * 
 * Confirmation dialog before creating a new Cliq.
 * Shows the cliq name, members, and threshold for review.
 */

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
import { Shield, Users, Check, ShieldPlus } from "lucide-react";
import { UseFormReturn, useFormState } from "react-hook-form";
import { CreateCliqFormValues } from "./formSchema";

interface ConfirmCreateCliqProps {
  readonly createCliqForm: UseFormReturn<CreateCliqFormValues>;
}

export default function ConfirmCreateCliq({ createCliqForm }: ConfirmCreateCliqProps) {
  const { chain } = useChains();
  const { isValid, isSubmitting, isSubmitted } = useFormState(createCliqForm);
  const { name, description, members, threshold } = createCliqForm.getValues();

  const loading = isSubmitting || isSubmitted;
  const filteredMembers = members.filter(({ member }) => member !== "");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="action"
          size="action"
          className="gap-2"
          onClick={(e) => {
            createCliqForm.trigger();

            if (!isValid) {
              e.preventDefault();
            }
          }}
        >
          <ShieldPlus className="h-4 w-4" />
          Form Your CLIQ
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-y-auto max-w-lg">
        <DialogTitle className="font-heading text-xl flex items-center gap-2">
          <Shield className="h-5 w-5 text-foreground" />
          Ready to form your CLIQ?
        </DialogTitle>
        
        {/* CLIQ Name */}
        <div className="mt-4 p-4 bg-muted border border-border rounded-xl shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">CLIQ Name</p>
          <h3 className="text-xl font-heading font-bold text-foreground">{name || "Unnamed CLIQ"}</h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            on {chain.chainDisplayName}
          </p>
        </div>
        
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
                className="flex items-center gap-3 rounded-lg border-2 border-border p-3 transition-colors bg-muted/30 hover:bg-muted/50"
              >
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-mono font-bold text-foreground border border-border">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono leading-none truncate">
                    {member}
                  </p>
                  {index === 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">Creator (Admin)</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Threshold Info */}
        <div className="flex items-center gap-3 p-4 bg-muted border border-border rounded-lg mt-4">
          <Shield className="h-5 w-5 text-foreground flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {threshold} of {filteredMembers.length} signatures required
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {threshold === filteredMembers.length 
                ? "All members must sign every transaction" 
                : `Any ${threshold} members can approve transactions`}
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
          <DialogClose asChild>
            <Button 
              variant="action-outline" 
              size="action"
              className="w-full sm:flex-1" 
              disabled={loading}
            >
              Go Back
            </Button>
          </DialogClose>
          <Button 
            variant="action"
            size="action"
            type="submit" 
            form="create-cliq-form" 
            className="w-full sm:flex-1 gap-2" 
            disabled={loading}
          >
            {loading ? (
              <ReloadIcon className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {loading ? "Creating..." : "Create CLIQ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
