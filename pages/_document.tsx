/**
 * Custom Document
 *
 * File: pages/_document.tsx
 *
 * This file is used to augment the application's <html> and <body> tags.
 * Google Fonts are loaded here instead of next/head to avoid Next.js 15 warnings.
 */

import { Html, Head, Main, NextScript } from "next/document";

/**
 * The inline script below is injected as plain text so it runs synchronously
 * during HTML parsing — before any Next.js framework code and well before the
 * dev-mode error overlay registers its own handlers.
 *
 * It intercepts both window.onerror and the unhandledrejection event (in the
 * capture phase, so it fires first) and prevents the Next.js overlay from
 * appearing. Errors are still logged to the console.
 */
const OVERLAY_SUPPRESSOR_SCRIPT = `
(function() {
  // Patterns that are entirely safe to ignore (no toast either)
  var SILENT = ["Failed to fetch", "NetworkError", "Loading chunk", "ChunkLoadError"];

  function isSilent(msg) {
    if (!msg) return false;
    for (var i = 0; i < SILENT.length; i++) {
      if (String(msg).indexOf(SILENT[i]) !== -1) return true;
    }
    return false;
  }

  // Queue messages that arrive before Sonner's Toaster is mounted
  window.__pendingErrorToasts = window.__pendingErrorToasts || [];

  function showOrQueue(msg) {
    if (isSilent(msg)) return;
    // If Sonner is ready (toast function injected by _app.tsx), use it directly
    if (typeof window.__appToastError === 'function') {
      window.__appToastError(msg);
    } else {
      // Store for _app.tsx to flush once Toaster is mounted
      window.__pendingErrorToasts.push(msg);
    }
  }

  // 1. Synchronous errors
  window.addEventListener('error', function(e) {
    var msg = (e.error && e.error.message) || e.message || 'An error occurred';
    console.error('[AppError]', e.error || e.message);
    showOrQueue(msg);
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  // 2. Unhandled promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    var reason = e.reason;
    var msg = (reason && reason.message) ? reason.message : String(reason || 'Unhandled error');
    console.warn('[UnhandledRejection]', reason);
    showOrQueue(msg);
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
})();
`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Error overlay suppressor – must run before all other scripts */}
        <script dangerouslySetInnerHTML={{ __html: OVERLAY_SUPPRESSOR_SCRIPT }} />

        {/* UI4 Typography - Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />

        {/* Favicons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />

        {/* Theme Color */}
        <meta name="theme-color" content="hsl(220, 13%, 18%)" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
