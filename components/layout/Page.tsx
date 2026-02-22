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

const Page = ({ 
  title, 
  goBack, 
  children, 
  variant = "default",
  showPattern = true 
}: PageProps) => {
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
    <div className={`flex-1 w-full ${showPattern ? "bg-pattern-dots" : "gradient-bg"}`}>
      <Head title={title || "Cosmos Multisig Manager"} />
      
      <main className={cn(
        "mx-auto px-[0.75in] py-8 transition-all duration-300",
        containerClasses[variant]
      )}>
        {/* Back Button */}
        {goBack && (
          <div className="mb-6 animate-in fade-in slide-up">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-2 text-muted-foreground hover:text-foreground group"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <span className="font-mono text-xs uppercase tracking-wide">Back to {goBack.title}</span>
            </Button>
            
            {showConfirm && (
              <div className="mt-3 p-4 rounded-lg bg-destructive/10 border-2 border-destructive/30 text-sm animate-in slide-up">
                <p className="text-destructive font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  Changes to any form will be lost if you go back
                </p>
                <p className="text-muted-foreground mt-1.5 text-xs">
                  Click the back button again to confirm
                </p>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-6 animate-in fade-in">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 right-0 p-4 z-40">
        <a 
          href="https://github.com/cosmos/cosmos-multisig-ui" 
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/80 backdrop-blur-sm border border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-all group"
        >
          <Github className="h-4 w-4" />
          <span className="hidden sm:inline font-mono uppercase tracking-wide">GitHub</span>
          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      </footer>

      {/* Decorative Elements */}
      <div className="fixed top-20 left-4 w-px h-32 bg-gradient-to-b from-border to-transparent opacity-50 hidden lg:block" />
      <div className="fixed top-20 right-4 w-px h-32 bg-gradient-to-b from-border to-transparent opacity-50 hidden lg:block" />
    </div>
  );
};

export default Page;
