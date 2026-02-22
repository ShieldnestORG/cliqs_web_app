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

interface MemberFormFieldProps {
  readonly createMultisigForm: UseFormReturn<{ members: { member: string }[]; threshold: number }>;
  readonly index: number;
  readonly membersReplace: UseFieldArrayReplace<
    { members: { member: string }[]; threshold: number },
    "members"
  >;
  readonly membersRemove?: UseFieldArrayRemove;
  readonly totalMembers: number;
}

export default function MemberFormField({
  createMultisigForm,
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

  // Can only remove if there are more than 2 members (minimum required for multisig)
  const canRemove = totalMembers > 2 && membersRemove;

  return (
    <FormField
      control={createMultisigForm.control}
      name={`members.${index}.member`}
      render={() => (
        <FormItem className="relative">
          <div className="flex items-center justify-between">
            <FormLabel className="text-sm font-medium">Member #{index + 1}</FormLabel>
            {canRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => membersRemove(index)}
                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove member {index + 1}</span>
              </Button>
            )}
          </div>
          <FormDescription className="text-xs">Address or public key</FormDescription>
          <FormControl>
            <Input
              variant="institutional"
              placeholder={`E.g. "${
                index % 2 === 0 ? exampleAddress(index, chain.addressPrefix) : examplePubkey(index)
              }"`}
              onPaste={index === 0 ? onPaste : undefined}
              {...createMultisigForm.register(`members.${index}.member`)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
