import posthog from 'posthog-js'

export function initPostHog(siteName) {
  posthog.init(process.env.VITE_POSTHOG_KEY || process.env.POSTHOG_KEY, {
    api_host: 'https://app.posthog.com',
    autocapture: false, // Prevent excessive events
    bootstrap: {
      distinctID: 'anonymous_user',
      isIdentifiedID: false
    },
    loaded: (ph) => {
      ph.register({
        site: siteName || 'unknown_site'
      });
    }
  });
}
