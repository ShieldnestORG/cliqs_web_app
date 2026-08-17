import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { DevNetwork } from "./types";

interface DevToolsPowersBannerProps {
  readonly chainDisplayName: string;
  readonly chainId: string;
  readonly network: DevNetwork;
}

export default function DevToolsPowersBanner({
  chainDisplayName,
  chainId,
  network,
}: DevToolsPowersBannerProps) {
  return (
    <Alert className="border-warning/40 bg-warning/5">
      <ShieldAlert className="h-4 w-4 text-warning" />
      <AlertTitle className="text-sm">
        These tools deploy contracts, change contract admins, and can hand another account authority
        over your funds
      </AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground">
        Migrate, Update Admin and Authz grants cannot be undone from this page. Nobody legitimate
        will ever send you a link to this page — if someone did, stop. Acting on{" "}
        <span className="font-semibold text-foreground">
          {chainDisplayName || chainId} · {chainId}
        </span>{" "}
        ({network}).
      </AlertDescription>
    </Alert>
  );
}
