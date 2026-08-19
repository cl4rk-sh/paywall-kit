import { ENABLE_EXIT_OFFER as LOCAL_ENABLE_EXIT_OFFER } from '@/constants/flags';

/**
 * Lightweight remote config. Fetches a small JSON blob at launch; any value it
 * returns OVERRIDES the matching local flag in constants/flags.ts. If the fetch
 * fails (offline, endpoint down, bad JSON) we fall back to the local flag, so
 * the app always has a sane default and never blocks on this.
 *
 * Server: any static JSON endpoint. The original was a route on the marketing
 * site returning `{ "ENABLE_EXIT_OFFER": true }`.
 *
 * NOTE: this endpoint is PUBLIC and unauthenticated — it must only ever carry
 * non-sensitive feature toggles. Never put secrets behind it.
 *
 * Trimmed to the paywall's one toggle; the source app pushed several unrelated
 * flags through the same blob. Add yours alongside ENABLE_EXIT_OFFER.
 */
const CONFIG_URL = process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL ?? 'https://example.com/config';

// null = not fetched yet / no remote override -> use the local flag default.
let remoteExitOffer: boolean | null = null;

/** Fetch remote config once at launch. Fire-and-forget; never throws. */
export const fetchRemoteConfig = async (): Promise<void> => {
    try {
        // Custom header so the endpoint can be allowlisted at the CDN/WAF (e.g.
        // a rule on `http.request.headers["x-app-client"][0] eq "app"` that
        // skips bot checks). More reliable than user-agent, which the platform
        // network stack can override.
        const res = await fetch(CONFIG_URL, {
            cache: 'no-store',
            headers: { 'X-App-Client': 'app' },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (typeof json?.ENABLE_EXIT_OFFER === 'boolean') {
            remoteExitOffer = json.ENABLE_EXIT_OFFER;
        }
    } catch {
        // Offline or bad response — keep the local flag default.
    }
};

/** Whether the exit-offer paywall is enabled (remote override wins). */
export const isExitOfferEnabled = (): boolean =>
    remoteExitOffer !== null ? remoteExitOffer : LOCAL_ENABLE_EXIT_OFFER;
