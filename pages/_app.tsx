import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import GeneralNews from "@/components/GeneralNews";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/context/WalletContext";
import { PendingTransactionsProvider } from "@/context/PendingTransactionsContext";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { Analytics } from "@vercel/analytics/next";
import { ChainsProvider } from "../context/ChainsContext";
import "@/styles/globals.css";

export default function MultisigApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isLandingPage = router.asPath === "/";

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
