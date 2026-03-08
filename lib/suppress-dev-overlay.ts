/**
 * suppress-dev-overlay.ts
 *
 * Globally suppresses the Next.js development error overlay (the full-page red
 * overlay with call stacks) and replaces it with a toast notification.
 *
 * Call `installOverlaySuppressor()` once at app startup (in _app.tsx).
 *
 * This only affects the dev-mode overlay. It does NOT swallow errors silently –
 * they are still logged to the console for debugging.
 */

import { toast } from "sonner";

let installed = false;

/** Returns a short, human-readable message from any thrown value. */
function extractMessage(err: unknown): string {
    if (err instanceof Error) {
        // Prefer a short first line
        return err.message.split("\n")[0] || err.message;
    }
    if (typeof err === "string") return err.split("\n")[0];
    try {
        return JSON.stringify(err);
    } catch {
        return "An unexpected error occurred";
    }
}

/** Categories of errors we can safely swallow without even a toast. */
const IGNORABLE_PATTERNS = [
    // Browser extensions intercepting fetch
    "Failed to fetch",
    // Chain registry network errors (cosmetic, not user-actionable)
    "NetworkError",
    // Webpack hot reload noise
    "Loading chunk",
];

function isIgnorable(msg: string): boolean {
    return IGNORABLE_PATTERNS.some((p) => msg.includes(p));
}

export function installOverlaySuppressor() {
    if (typeof window === "undefined" || installed) return;
    installed = true;

    /**
     * window.onerror fires for synchronous thrown errors.
     * Returning `true` tells the browser (and Next.js overlay) to treat the
     * error as "handled" – it won't render the red overlay.
     */
    const originalOnError = window.onerror;
    window.onerror = function (message, source, lineno, colno, error) {
        const msg = extractMessage(error ?? message);
        console.error("[AppError]", error ?? message);

        if (!isIgnorable(msg)) {
            toast.error(msg, {
                id: `app-error-${msg.slice(0, 40)}`, // deduplicate repeat toasts
                duration: 6000,
                closeButton: true,
            });
        }

        // Suppress the Next.js overlay by returning true
        if (originalOnError) originalOnError.call(this, message, source, lineno, colno, error);
        return true;
    };

    /**
     * window.onunhandledrejection fires for unhandled Promise rejections.
     * Calling event.preventDefault() suppresses the overlay in Next.js dev.
     */
    window.addEventListener(
        "unhandledrejection",
        (event: PromiseRejectionEvent) => {
            const msg = extractMessage(event.reason);
            console.warn("[UnhandledRejection]", event.reason);

            if (!isIgnorable(msg)) {
                toast.error(msg, {
                    id: `promise-error-${msg.slice(0, 40)}`,
                    duration: 6000,
                    closeButton: true,
                });
            }

            // Prevent the Next.js dev overlay from appearing
            event.preventDefault();
        },
        true, // capture phase so we intercept before Next.js's handler
    );
}
