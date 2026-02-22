import * as React from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import copy from "copy-to-clipboard";
import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

interface CopyButtonProps extends ButtonProps {
  value: string;
  copyLabel?: string;
  showToast?: boolean;
}

export function CopyButton({
  value,
  copyLabel = "address",
  showToast = true,
  className,
  variant = "ghost",
  size = "icon",
  children,
  ...props
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => setHasCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [hasCopied]);

  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    copy(value);
    setHasCopied(true);
    if (showToast) {
      toast.success(`Copied ${copyLabel} to clipboard`, {
        description: value,
      });
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={hasCopied ? true : undefined}>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={children ? "default" : size}
            className={cn(children ? "" : "h-8 w-8 shrink-0", className)}
            onClick={onCopy}
            {...props}
          >
            {hasCopied ? (
              <Check className="h-4 w-4 text-green-accent" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {children || <span className="sr-only">Copy {copyLabel}</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-green-accent text-white border-green-accent">
          <p className="text-xs font-bold">Copied!</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
