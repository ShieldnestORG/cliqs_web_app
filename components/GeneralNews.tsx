import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface Props {
  active: boolean;
}

export default function GeneralNews({ active }: Props) {
  return active ? (
    <Alert className="mx-auto my-4 max-w-4xl border-amber-500/50 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-500 font-bold uppercase tracking-wider">Important Notice</AlertTitle>
      <AlertDescription className="mt-3 text-muted-foreground">
        Due to the database shutdown of our database provider, all data of multisig.confio.run will be deleted
        on September&nbsp;15<sup>th</sup>,&nbsp;2025.
      </AlertDescription>
      <AlertDescription className="mt-3 text-muted-foreground">
        Please finish your signing processes before that date. Make sure you
        have all your public keys ready to re-create the multisig address from public keys + threshold values later on.
      </AlertDescription>
      <AlertDescription className="mt-3 text-muted-foreground">
        At this point we don&apos;t know if and when Confio will bring back a hosted version of this tool. 
      </AlertDescription>
    </Alert>
  ) : null;
}
