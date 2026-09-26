import * as Sentry from "@sentry/react-native";

/**
 * Sentry: rrëzimet native dhe gabimet e JavaScript-it, me vendin ku ndodhën.
 * PostHog-u (lib/errors/reporter.ts) numëron gabimet; Sentry-u tregon pse.
 *
 * Aktivizohet vetëm kur ka DSN (EXPO_PUBLIC_SENTRY_DSN) dhe jashtë
 * zhvillimit: pa DSN app-i punon njësoj, thjesht pa raportim.
 *
 * Privatësia: pa të dhëna personale (`sendDefaultPii: false`), dhe pa
 * regjistrim ekrani. App-i mban të dhëna shëndetësore të fëmijës; Sentry-t
 * i shkon vetëm gabimi dhe gjurma e kodit.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = Boolean(DSN) && !__DEV__;

export function initSentry(): void {
  if (!sentryEnabled) return;
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    // Pa tekste nga ekrani apo URL me parametra: mund të mbajnë emrin e bebit.
    beforeBreadcrumb: (breadcrumb) => (breadcrumb.category === "console" ? null : breadcrumb),
  });
}

export function captureToSentry(error: unknown, context?: string): void {
  if (!sentryEnabled) return;
  Sentry.captureException(error, context ? { tags: { context } } : undefined);
}

export const wrapWithSentry = Sentry.wrap;
