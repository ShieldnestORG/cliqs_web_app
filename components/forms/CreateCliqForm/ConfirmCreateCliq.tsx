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
} from "@/components/ui/dialog";
import { useChains } from "@/context/ChainsContext";
import { ReloadIcon } from "@radix-ui/react-icons";
import { Shield, Users, Check, ShieldPlus } from "lucide-react";
import { useState } from "react";
import { UseFormReturn, useFormState } from "react-hook-form";
import { CreateCliqFormValues } from "./formSchema";

interface ConfirmCreateCliqProps {
  readonly createCliqForm: UseFormReturn<CreateCliqFormValues>;
}

export default function ConfirmCreateCliq({ createCliqForm }: ConfirmCreateCliqProps) {
  const { chain } = useChains();
  const { isSubmitting, isSubmitted } = useFormState(createCliqForm);
  const [open, setOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const { name, description, members, threshold } = createCliqForm.getValues();
  const loading = isSubmitting || isSubmitted;
  const filteredMembers = members.filter(({ member }) => member !== "");

  const handleOpenDialog = async () => {
    setIsValidating(true);
    try {
      const valid = await createCliqForm.trigger();
      if (valid) {
        setOpen(true);
      }
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="action"
        size="action"
        className="gap-2"
        onClick={handleOpenDialog}
        disabled={isValidating || loading}
      >
        {isValidating ? (
          <ReloadIcon className="h-4 w-4 animate-spin" />
        ) : (
          <ShieldPlus className="h-4 w-4" />
        )}
        {isValidating ? "Validating..." : "Form Your CLIQ"}
      </Button>

      <DialogContent className="max-w-lg overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 font-heading text-xl">
          <Shield className="h-5 w-5 text-foreground" />
          Ready to form your CLIQ?
        </DialogTitle>

        {/* CLIQ Name */}
        <div className="mt-4 rounded-xl border border-border bg-muted p-4 shadow-sm">
          <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">CLIQ Name</p>
          <h3 className="font-heading text-xl font-bold text-foreground">
            {name || "Unnamed CLIQ"}
          </h3>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          <p className="mt-2 text-xs text-muted-foreground">on {chain.chainDisplayName}</p>
        </div>

        {/* Members List */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{filteredMembers.length} Members</span>
          </div>
          <div className="flex max-h-[200px] flex-col gap-2 overflow-y-auto">
            {filteredMembers.map(({ member }, index) => (
              <div
                key={member}
                className="flex items-center gap-3 rounded-lg border-2 border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs font-bold text-foreground">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm leading-none">{member}</p>
                  {index === 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">Creator (Admin)</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Threshold Info */}
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-muted p-4">
          <Shield className="h-5 w-5 flex-shrink-0 text-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {threshold} of {filteredMembers.length} signatures required
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {threshold === filteredMembers.length
                ? "All members must sign every transaction"
                : `Any ${threshold} members can approve transactions`}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
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
            className="w-full gap-2 sm:flex-1"
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
