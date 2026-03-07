import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import GeneralNews from "@/components/GeneralNews";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/context/WalletContext";
import { PendingTransactionsProvider } from "@/context/PendingTransactionsContext";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { toast } from "sonner";
import { ChainsProvider } from "../context/ChainsContext";
import "@/styles/globals.css";

// Extend the Window interface for the error bridge injected by _document.tsx
declare global {
  interface Window {
    __appToastError: ((msg: string) => void) | null;
    __pendingErrorToasts: string[];
  }
}

export default function MultisigApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isLandingPage = router.asPath === "/";

  // Bridge the inline suppressor script (installed in _document.tsx) to Sonner.
  // Once this component mounts, any errors captured before React was ready are flushed
  // as toast notifications, and future errors use the same channel.
  useEffect(() => {
    const showToast = (msg: string) => {
      toast.error(msg, {
        id: `app-error-${msg.slice(0, 40)}`,
        duration: 6000,
        closeButton: true,
      });
    };

    // Register the bridge so the inline script in _document.tsx can call it
    window.__appToastError = showToast;

    // Flush any errors that arrived before React mounted
    const pending: string[] = window.__pendingErrorToasts ?? [];
    pending.forEach(showToast);
    window.__pendingErrorToasts = [];

    return () => {
      window.__appToastError = null;
    };
  }, []);

  return (
    <ChainsProvider>
      <WalletProvider>
        <PendingTransactionsProvider>
          <TooltipProvider>
            <div className="flex min-h-screen bg-background text-foreground">
              {!isLandingPage && <Sidebar />}

              <div className="flex min-w-0 flex-1 flex-col">
                {!isLandingPage && (
                  <div className="lg:hidden">
                    <Header />
                  </div>
                )}
                {!isLandingPage && <GeneralNews active={false} />}

                <main className="relative flex flex-1 flex-col">
                  <Component {...pageProps} />
                </main>
              </div>
            </div>
            <Toaster closeButton />
            <Analytics />
          </TooltipProvider>
        </PendingTransactionsProvider>
      </WalletProvider>
    </ChainsProvider>
  );
}
