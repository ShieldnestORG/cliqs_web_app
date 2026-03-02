/**
 * Cliq Member Form Field
 *
 * File: components/forms/CreateCliqForm/MemberFormField.tsx
 *
 * Individual member input field for the Cliq creation form.
 * Supports paste of multiple addresses at once.
 */

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ClipboardEventHandler } from "react";
import { UseFieldArrayReplace, UseFieldArrayRemove, UseFormReturn } from "react-hook-form";
import { useChains } from "../../../context/ChainsContext";
import { exampleAddress, examplePubkey } from "../../../lib/displayHelpers";
import { CreateCliqFormValues } from "./formSchema";

interface MemberFormFieldProps {
  readonly createCliqForm: UseFormReturn<CreateCliqFormValues>;
  readonly index: number;
  readonly membersReplace: UseFieldArrayReplace<CreateCliqFormValues, "members">;
  readonly membersRemove?: UseFieldArrayRemove;
  readonly totalMembers: number;
}

export default function MemberFormField({
  createCliqForm,
  index,
  membersReplace,
  membersRemove,
  totalMembers,
}: MemberFormFieldProps) {
  const { chain } = useChains();

  const onPaste: ClipboardEventHandler<HTMLInputElement> = (ev) => {
    const rawData = ev.clipboardData.getData("text");
    const csv = rawData.split(",");
    const finalValues =
      csv.length > 1
        ? csv.map((el) => el.trim()).filter((el) => el !== "")
        : rawData
            .replace(/\n/g, " ")
            .split(" ")
            .map((el) => el.trim())
            .filter((el) => el !== "");

    membersReplace(finalValues.map((el) => ({ member: el })));
    ev.preventDefault();
  };

  // Can only remove if there are more than 2 members (minimum required for a cliq)
  const canRemove = totalMembers > 2 && membersRemove;

  return (
    <FormField
      control={createCliqForm.control}
      name={`members.${index}.member`}
      render={() => (
        <FormItem className="group relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-accent/20 text-xs font-bold text-green-accent">
                {index + 1}
              </div>
              <FormLabel className="text-sm font-medium">
                {index === 0 ? "You (Creator)" : `Member ${index + 1}`}
              </FormLabel>
            </div>
            {canRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => membersRemove(index)}
                className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove member {index + 1}</span>
              </Button>
            )}
          </div>
          <FormDescription className="text-xs text-muted-foreground">
            {index === 0 ? "Your wallet address or public key" : "Wallet address or public key"}
          </FormDescription>
          <FormControl>
            <Input
              variant="institutional"
              placeholder={`E.g. "${
                index % 2 === 0 ? exampleAddress(index, chain.addressPrefix) : examplePubkey(index)
              }"`}
              onPaste={index === 0 ? onPaste : undefined}
              {...createCliqForm.register(`members.${index}.member`)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
