import * as Sentry from "@sentry/browser";

export function initSentry() {
  Sentry.init({
    dsn: process.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN,
    tracesSampleRate: 0, // No performance monitoring to save quota
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Enable Spike Protection in your Sentry dashboard project settings
  });
}
