"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useChains } from "@/context/ChainsContext";
import { Validator } from "cosmjs-types/cosmos/staking/v1beta1/staking";
import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, memo, useState } from "react";
import { cn } from "@/lib/utils";

interface SelectValidatorProps {
  readonly selectedValidatorAddress: string;
  readonly setValidatorAddress: (validatorAddress: string) => void;
}

function SelectValidator({
  selectedValidatorAddress,
  setValidatorAddress,
}: SelectValidatorProps) {
  const [open, setOpen] = useState(false);
  const {
    validatorState: {
      validators: { bonded, unbonding, unbonded },
    },
  } = useChains();

  // The list of validators includes unbonding and unbonded validators in order to
  // be able to do undelegates and redelegates from jailed validators as well as delegate
  // to validators who are not yet active.
  //
  // If this list becomes too long due to spam registrations, we can try to do some
  // reasonable filtering here.
  const validators = useMemo(() => [...bonded, ...unbonding, ...unbonded], [bonded, unbonding, unbonded]);

  const selectedValidator = useMemo(() =>
    validators.find(
      (validatorItem) => selectedValidatorAddress === validatorItem.operatorAddress,
    ), [validators, selectedValidatorAddress]);

  function displayValidator(val: Validator): string {
    return val.description.moniker + (val.jailed ? " (jailed)" : "");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="mb-4 w-full max-w-[300px] justify-between"
        >
          {selectedValidator
            ? displayValidator(selectedValidator)
            : "Select validator…"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search validator by name..." 
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>No validator found.</CommandEmpty>
            {validators.map((validatorItem) => (
              <CommandItem
                key={validatorItem.operatorAddress}
                value={displayValidator(validatorItem)}
                onSelect={() => {
                  setValidatorAddress(validatorItem.operatorAddress);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedValidatorAddress === validatorItem.operatorAddress
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
                {displayValidator(validatorItem)}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default memo(SelectValidator);
