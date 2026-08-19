/**
 * Build-time flags for the paywall kit.
 *
 * Trimmed to the paywall's own switches — the source app carried several more
 * that gated unrelated features. Anything here can be overridden at runtime by
 * the remote config endpoint (see utils/remoteConfig.ts); these are the offline
 * defaults, so the app always behaves sanely with no network.
 */

/** Dev: use the production RevenueCat key in a debug build. */
export const FORCE_PRODUCTION_REVENUE_CAT_KEY = false;

/** Dev: use the production paywall URL in a debug build. */
export const FORCE_PRODUCTION_PAYWALL_URL = true;

/**
 * Dev: pretend the user is eligible for the free trial regardless of their
 * actual StoreKit intro-offer eligibility. Affects both the paywall-sequence
 * variant choice AND the paywall WebView's per-product eligibility filter, so
 * it is the single switch for exercising the trial path on a test account that
 * has already burned its trial.
 */
export const FORCE_TRIAL = false;

/**
 * Show the discounted exit-offer (promo) paywall the first time the user
 * dismisses the main paywall in a given app session. Resets on cold launch, so
 * it triggers at most once per launch; subsequent dismissals behave normally.
 * See app/paywall.tsx.
 */
export const ENABLE_EXIT_OFFER = true;
