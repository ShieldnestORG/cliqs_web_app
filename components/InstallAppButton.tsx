import { MonitorDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * "Install app": installs app.cliqs.io as a desktop / home-screen app (its own window and Dock icon, no browser bar),
 * the same way Chromium browsers install any web app that has a manifest. It renders nothing unless the browser has
 * offered the install (`beforeinstallprompt`, Chromium only) and the app is not already running installed, so it never
 * shows in Safari, Firefox or inside the installed app. The tokns app carries the same control (InstallAppItem).
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => undefined);
    setPromptEvent(null); // a prompt event can be used once
  };

  return { canInstall: promptEvent !== null, install };
}

export default function InstallAppButton({ collapsed }: { collapsed: boolean }) {
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <div className={cn("mb-2 shrink-0 px-4", collapsed && "px-2")}>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={install}
              aria-label="Install app"
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <MonitorDown className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Install app</TooltipContent>
        </Tooltip>
      ) : (
        <button
          type="button"
          onClick={install}
          className="flex h-10 w-full items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm text-muted-foreground transition-colors duration-200 animate-in fade-in hover:bg-muted/50 hover:text-foreground"
        >
          <MonitorDown className="h-4 w-4" />
          Install app
        </button>
      )}
    </div>
  );
}
