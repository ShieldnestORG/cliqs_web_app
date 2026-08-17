import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { DevNetwork } from "./types";

/**
 * True when the browser landed on this route directly from outside the app.
 *
 * A move inside the app is a client-side route change: the document keeps the URL
 * it was loaded with, so a document that was loaded straight onto this pathname
 * means the browser arrived here directly. Reloads and back/forward moves are not
 * arrivals — the person was already here. A same-origin referrer means the link
 * came from another page of the real app, which an off-origin page cannot fake.
 */
export const isExternalArrival = (): boolean => {
  if (typeof window === "undefined") return false;

  // Environments without the Performance Timeline fall back to the referrer alone,
  // rather than throwing out of the effect and taking the whole page down.
  const [entry] =
    typeof performance !== "undefined" && typeof performance.getEntriesByType === "function"
      ? (performance.getEntriesByType("navigation") as PerformanceNavigationTiming[])
      : [];
  if (entry) {
    if (entry.type !== "navigate") return false;
    try {
      if (new URL(entry.name).pathname !== window.location.pathname) return false;
    } catch {
      // Unparseable navigation URL: fall through to the referrer check.
    }
  }

  const referrer = document.referrer;
  if (!referrer) return true;
  try {
    return new URL(referrer).origin !== window.location.origin;
  } catch {
    return true;
  }
};

interface DevToolsArrivalGateProps {
  readonly chainDisplayName: string;
  readonly chainId: string;
  readonly network: DevNetwork;
  readonly leaveHref: string;
}

export default function DevToolsArrivalGate({
  chainDisplayName,
  chainId,
  network,
  leaveHref,
}: DevToolsArrivalGateProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isExternalArrival()) setOpen(true);
  }, []);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        className="max-h-[90vh] max-w-xl overflow-y-auto"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
            Stop — check why you are here
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-foreground">
            You came to the Developer Tools page from outside the app. This page is genuinely part
            of Cliqs, and that is exactly why someone trying to trick you would send you a link to
            it.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">What the tools on this page can do:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Put new contract code on the chain, and start new contracts from it.</li>
            <li>Replace the code of a contract that is already running and holding funds.</li>
            <li>
              Change who administers a contract. Whoever you make admin can rewrite that
              contract&apos;s code later.
            </li>
            <li>
              Give another account permission to move, stake and spend your funds on your behalf.
            </li>
            <li>Build a transaction for your multisig group to sign.</li>
          </ul>
          <p className="font-semibold text-foreground">
            Nobody legitimate will ever send you a link to this page.
          </p>
          <p>
            Not support, not an admin, not a team mate. If somebody asked you to come here, stop and
            check with them somewhere you trust before you do anything.
          </p>
          <p>
            Your wallet still asks you to approve every transaction, so nothing has happened yet.
            Read every wallet prompt in full before you approve it.
          </p>
          <p className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
            The link you used chose this network:{" "}
            <span className="font-semibold text-foreground">
              {chainDisplayName || chainId} · {chainId}
            </span>{" "}
            ({network}). Real funds are at stake on mainnet.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Link href={leaveHref}>Get me out of here</Link>
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => setOpen(false)}>
            I came here on my own — show the tools
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
