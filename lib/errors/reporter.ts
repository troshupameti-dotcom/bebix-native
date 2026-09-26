import { track } from "@/lib/analytics/posthog";
import { captureToSentry } from "@/lib/errors/sentry";

/**
 * Raportimi i gabimeve.
 *
 * Pa këtë, për rrëzimet mësohej vetëm nga recensionet me një yll.
 *
 * PostHog-u numëron gabimet e JavaScript-it; Sentry-u (lib/errors/sentry.ts)
 * kap edhe rrëzimet native dhe e ruan gjurmën e plotë, kur ka DSN.
 *
 * Dërgohet vetëm lloji, mesazhi dhe fillimi i gjurmës — pa të dhëna të
 * përdoruesit.
 */

type ErrorHandler = (error: Error, isFatal?: boolean) => void;

declare const ErrorUtils:
  | { getGlobalHandler: () => ErrorHandler; setGlobalHandler: (handler: ErrorHandler) => void }
  | undefined;

let installed = false;

/** Gjurma shkurtohet: PostHog-ut nuk i duhet gjithë stack-u, dhe ne as. */
function shortStack(error: Error): string {
  return (error.stack ?? "").split("\n").slice(0, 6).join(" | ").slice(0, 500);
}

export function reportError(error: unknown, context?: string): void {
  const err = error instanceof Error ? error : new Error(String(error));
  captureToSentry(err, context);
  track("app_error", {
    name: err.name,
    message: err.message.slice(0, 200),
    stack: shortStack(err),
    context: context ?? null,
    fatal: false,
  });
}

/**
 * Lidhet një herë, te rrënja e app-it. Handler-i i mëparshëm thirret
 * gjithmonë pas nesh — pa këtë, ekrani i kuq i gabimit në zhvillim do të
 * zhdukej dhe do të ishte më e vështirë të gjeje shkakun.
 */
export function installErrorReporter(): void {
  if (installed || typeof ErrorUtils === "undefined") return;
  installed = true;

  const previous = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      track("app_error", {
        name: error?.name ?? "Error",
        message: String(error?.message ?? error).slice(0, 200),
        stack: error instanceof Error ? shortStack(error) : "",
        context: "global",
        fatal: !!isFatal,
      });
    } catch {
      // Raportimi s'ka të drejtë ta përkeqësojë një rrëzim.
    }
    previous?.(error, isFatal);
  });
}
