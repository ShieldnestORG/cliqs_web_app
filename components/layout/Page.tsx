import { useRouter } from "next/router";
import { useState } from "react";
import Head from "../head";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Github, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageProps {
  readonly title?: string;
  readonly goBack?: {
    readonly pathname: string;
    readonly title: string;
    readonly needsConfirm?: boolean;
  };
  readonly children: React.ReactNode;
  readonly variant?: "default" | "centered" | "full";
  readonly showPattern?: boolean;
}

const Page = ({ title, goBack, children, variant = "default", showPattern = true }: PageProps) => {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleBack = (e: React.MouseEvent) => {
    if (!goBack) return;

    if (goBack.needsConfirm && !showConfirm) {
      e.preventDefault();
      setShowConfirm(true);
      return;
    }

    router.push(goBack.pathname);
  };

  const containerClasses = {
    default: "max-w-[1600px]",
    centered: "max-w-6xl",
    full: "max-w-[1800px]",
  };

  return (
    <div className={`w-full flex-1 ${showPattern ? "bg-pattern-dots" : "gradient-bg"}`}>
      <Head title={title || "Cosmos Multisig Manager"} />

      <main
        className={cn(
          "mx-auto px-[0.75in] py-8 transition-all duration-300",
          containerClasses[variant],
        )}
      >
        {/* Back Button */}
        {goBack && (
          <div className="slide-up mb-6 animate-in fade-in">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="group gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span className="font-mono text-xs uppercase tracking-wide">
                Back to {goBack.title}
              </span>
            </Button>

            {showConfirm && (
              <div className="slide-up mt-3 rounded-lg border-2 border-destructive/30 bg-destructive/10 p-4 text-sm animate-in">
                <p className="flex items-center gap-2 font-semibold text-destructive">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                  Changes to any form will be lost if you go back
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Click the back button again to confirm
                </p>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-6 animate-in fade-in">{children}</div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 right-0 z-40 p-4">
        <a
          href="https://github.com/cosmos/cosmos-multisig-ui"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 rounded-lg border border-border/50 bg-card/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm transition-all hover:border-border hover:text-foreground"
        >
          <Github className="h-4 w-4" />
          <span className="hidden font-mono uppercase tracking-wide sm:inline">GitHub</span>
          <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </a>
      </footer>

      {/* Decorative Elements */}
      <div className="fixed left-4 top-20 hidden h-32 w-px bg-gradient-to-b from-border to-transparent opacity-50 lg:block" />
      <div className="fixed right-4 top-20 hidden h-32 w-px bg-gradient-to-b from-border to-transparent opacity-50 lg:block" />
    </div>
  );
};

export default Page;
