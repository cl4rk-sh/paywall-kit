/**
 * Analytics seam for the paywall kit.
 *
 * In the source app these were three separate modules (a product-analytics
 * SDK plus two ad-network attribution SDKs). They are collapsed here into one
 * no-op adapter so the kit drops in without dragging any vendor SDK, account
 * id, or access token along with it.
 *
 * Wire these to whatever you actually use. The paywall calls them at exactly
 * the moments that matter for subscription reporting, so the call sites are
 * worth keeping even if the bodies change:
 *
 *   trackEvent          — every paywall/onboarding step, purchase, restore
 *   logTrialStarted     — ad-network signal, fires once when a trial converts
 *   logPurchase         — ad-network signal, fires on a paid (non-trial) purchase
 *   logRestore          — fires when a restore finds an active entitlement
 *   trackTrialStarted   — second ad network's trial signal
 *
 * Every function must be safe to call before its SDK is initialised and must
 * never throw — the paywall does not await them and a rejection here would
 * surface as an unhandled promise rejection mid-purchase.
 */

type Props = Record<string, unknown>;

/** Product analytics. Called with a human-readable event name plus properties. */
export function trackEvent(event: string, props?: Props): void {
    if (__DEV__) console.log('[analytics] trackEvent', event, props ?? {});
}

/**
 * Ad-network trial signal. `price` is the localised amount the subscription
 * will renew at (0 for the trial itself), `currency` an ISO 4217 code.
 */
export function logTrialStarted(price: number, currency: string, params?: Props): void {
    if (__DEV__) console.log('[analytics] logTrialStarted', price, currency, params ?? {});
}

/** Ad-network purchase signal for a direct (no-trial) subscription purchase. */
export function logPurchase(price: number, currency: string, params?: Props): void {
    if (__DEV__) console.log('[analytics] logPurchase', price, currency, params ?? {});
}

/** Fires when "Restore Purchases" finds an active entitlement. */
export function logRestore(): void {
    if (__DEV__) console.log('[analytics] logRestore');
}

/** Second ad network's trial signal. Kept separate: the two fire independently. */
export function trackTrialStarted(price: number, currency: string): void {
    if (__DEV__) console.log('[analytics] trackTrialStarted', price, currency);
}
