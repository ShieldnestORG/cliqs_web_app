import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { CONFIRM_TAIL_LENGTH, IntentSummary, matchesConfirmTail } from "./intentSummary";

interface ConfirmIrreversibleDialogProps {
  /** Non-null opens the dialog. The summary is derived from the message to be signed. */
  readonly summary: IntentSummary | null;
  readonly confirmLabel: string;
  readonly working?: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export default function ConfirmIrreversibleDialog({
  summary,
  confirmLabel,
  working = false,
  onCancel,
  onConfirm,
}: ConfirmIrreversibleDialogProps) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    setTyped("");
  }, [summary]);

  const confirmed = summary ? matchesConfirmTail(typed, summary.confirmTarget) : false;

  return (
    <Dialog
      open={Boolean(summary)}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent
        className="max-h-[90vh] max-w-xl overflow-y-auto"
        // Escape cancels this dialog only. Without preventDefault the same keypress
        // also reaches the page-level Escape handler, which throws away the message
        // the user just filled in.
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          onCancel();
        }}
      >
        {summary && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                {summary.title}
              </DialogTitle>
              <DialogDescription className="text-base text-foreground">
                {summary.sentence}
              </DialogDescription>
            </DialogHeader>

            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {summary.consequences.map((consequence) => (
                <li key={consequence}>{consequence}</li>
              ))}
            </ul>

            <dl className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              {summary.facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                    {fact.label}
                  </dt>
                  <dd className="break-all font-mono text-xs">{fact.value}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-2">
              <Label htmlFor="confirm-tail">
                Type the last {CONFIRM_TAIL_LENGTH} characters of {summary.confirmTargetLabel} to
                continue
              </Label>
              <Input
                id="confirm-tail"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={"•".repeat(CONFIRM_TAIL_LENGTH)}
                variant="institutional"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                Read it off the value above. If it is not the address you expected, cancel.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onCancel} disabled={working}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={onConfirm}
                disabled={!confirmed || working}
                className="gap-2"
              >
                {working && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
