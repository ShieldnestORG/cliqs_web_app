import { useRouter } from "next/router";
import Head from "../head";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  readonly title?: string;
  readonly goBack?: {
    readonly pathname: string;
    readonly title: string;
  };
  readonly children: React.ReactNode;
}

const Page = ({ title, goBack, children }: PageProps) => {
  const router = useRouter();

  const handleBack = () => {
    if (!goBack) return;

    router.push(goBack.pathname);
  };

  return (
    <div className="w-full flex-1">
      <Head title={title || "Cosmos Multisig Manager"} />

      <div className="mx-auto max-w-[1600px] px-4 py-8 transition-all duration-300 sm:px-6 lg:px-[0.75in]">
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
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-6 animate-in fade-in">{children}</div>
      </div>
    </div>
  );
};

export default Page;
