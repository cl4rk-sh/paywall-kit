import { FORCE_PRODUCTION_PAYWALL_URL, FORCE_PRODUCTION_REVENUE_CAT_KEY, FORCE_TRIAL } from '@/constants/flags';
import * as TrackingTransparency from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const USE_PRODUCTION_REVENUE_CAT = !__DEV__ || FORCE_PRODUCTION_REVENUE_CAT_KEY;
const USE_PRODUCTION_PAYWALL_URL = !__DEV__ || FORCE_PRODUCTION_PAYWALL_URL;

// RevenueCat API keys. Public SDK keys (safe to ship in a binary), but they are
// per-project — supply your own via env rather than hard-coding, so a build for
// one app can never report purchases into another's project.
const REVENUE_CAT_API_KEYS = {
    ios: USE_PRODUCTION_REVENUE_CAT
        ? process.env.EXPO_PUBLIC_RC_IOS_KEY ?? ''
        : process.env.EXPO_PUBLIC_RC_TEST_KEY ?? '',
    android: USE_PRODUCTION_REVENUE_CAT
        ? process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? ''
        : process.env.EXPO_PUBLIC_RC_TEST_KEY ?? '',
};

// Paywall WebView URL. The paywall itself is a separate static SPA (deployed to
// Cloudflare Pages in the original setup) that serves any /paywall/* path and
// renders whichever offering id it is handed. Production and dev point at the
// same host here; split them if you want a staging deploy.
//
// Set EXPO_PUBLIC_PAYWALL_BASE_URL to your own deployment. The SPA is NOT part
// of this kit — see README, "The web paywall".
export const PAYWALL_WEB_BASE_URL =
    process.env.EXPO_PUBLIC_PAYWALL_BASE_URL ?? 'https://paywalls.example.com';
export const PAYWALL_WEB_PATH_PREFIX = USE_PRODUCTION_PAYWALL_URL ? '/paywall/production' : '/paywall';

/**
 * Initialize RevenueCat SDK
 * Should be called once when the app starts
 */
export const initializeRevenueCat = async () => {
    try {
        Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.ERROR);

        // Configure with platform-specific API key
        if (Platform.OS === 'ios') {
            Purchases.configure({ apiKey: REVENUE_CAT_API_KEYS.ios });
            console.log('✅ RevenueCat configured for iOS');

            // Enable Apple Search Ads attribution collection
            // If user has already seen ATT prompt, enable collection immediately
            // This allows us to collect either Standard or Detailed attribution based on consent
            const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
            if (status !== 'undetermined') {
                Purchases.enableAdServicesAttributionTokenCollection();
                console.log('✅ Apple Search Ads attribution collection enabled (status:', status, ')');
            }
        } else if (Platform.OS === 'android') {
            Purchases.configure({ apiKey: REVENUE_CAT_API_KEYS.android });
            console.log('✅ RevenueCat configured for Android');
        } else {
            console.warn('⚠️ RevenueCat not configured - unsupported platform:', Platform.OS);
        }

        // Pre-warm SDK caches so the paywall screen renders instantly later.
        // Fire-and-forget: failures here don't block app launch.
        Promise.all([
            // isTrialAvailable wraps getOfferings and populates the
            // cachedHasTrial flag the paywall-sequence reads synchronously.
            isTrialAvailable().catch((e) =>
                console.warn('Pre-warm isTrialAvailable failed', e),
            ),
            Purchases.getCustomerInfo().catch((e) =>
                console.warn('Pre-warm getCustomerInfo failed', e),
            ),
        ]);

        // Force StoreKit receipt sync so existing purchases (e.g. fresh
        // install with an active subscription on the Apple ID) are detected
        // without the user having to tap "Restore". Silent — no prompts.
        Purchases.syncPurchasesForResult().catch((e) =>
            console.warn('syncPurchases failed', e),
        );
    } catch (error) {
        console.error('❌ Failed to initialize RevenueCat:', error);
    }
};

/**
 * Enable Apple Search Ads attribution collection
 * Should be called after ATT permission is requested
 */
export const enableAppleSearchAdsAttribution = () => {
    try {
        if (Platform.OS === 'ios') {
            Purchases.enableAdServicesAttributionTokenCollection();
            console.log('✅ Apple Search Ads attribution collection enabled');
        }
    } catch (error) {
        console.error('❌ Failed to enable Apple Search Ads attribution:', error);
    }
};

/**
 * Get current customer info
 */
export const getCustomerInfo = async () => {
    try {
        const customerInfo = await Purchases.getCustomerInfo();
        return customerInfo;
    } catch (error) {
        console.error('Error fetching customer info:', error);
        throw error;
    }
};

// --- Price-point arms ------------------------------------------------------
//
// The price A/B test is assigned by RevenueCat: it serves either
// `webview-weekly` or `webview-weekly-high` as `current`. The app never picks
// an arm, it only has to stay CONSISTENT with the one it was given — a user
// shown high prices on the main paywall must not be handed the standard
// discount when they try to leave, or the exit offer undercuts the very test
// it is part of.
//
// Keyed off the id suffix rather than a hard-coded list so a future
// `webview-monthly-high` (or a renamed test) needs no app release.

/** Whether an offering id belongs to the higher price-point arm. */
export const isHighPriceOffering = (id: string | null | undefined): boolean =>
    !!id && id.toLowerCase().endsWith('-high');

/** Standard exit/discount offering. */
export const PROMO_OFFERING_ID = 'webview-promo';
/** Exit/discount offering that matches the high-price arm. */
export const PROMO_HIGH_OFFERING_ID = 'webview-promo-high';

/** The exit-offer id that pairs with whichever offering the user was shown. */
export const promoOfferingIdFor = (currentOfferingId: string | null | undefined): string =>
    isHighPriceOffering(currentOfferingId) ? PROMO_HIGH_OFFERING_ID : PROMO_OFFERING_ID;

/**
 * Get available offerings
 */
export const getOfferings = async () => {
    try {
        const offerings = await Purchases.getOfferings();
        return offerings;
    } catch (error) {
        console.error('Error fetching offerings:', error);
        throw error;
    }
};

/**
 * Purchase a package
 */
export const purchasePackage = async (packageToBuy: any) => {
    try {
        const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
        return customerInfo;
    } catch (error) {
        console.error('Error purchasing package:', error);
        throw error;
    }
};

/**
 * Restore purchases
 */
export const restorePurchases = async () => {
    try {
        const customerInfo = await Purchases.restorePurchases();
        return customerInfo;
    } catch (error) {
        console.error('Error restoring purchases:', error);
        throw error;
    }
};

/**
 * Check if user has active subscription
 */
export const hasActiveSubscription = async (): Promise<boolean> => {
    try {
        const customerInfo = await Purchases.getCustomerInfo();
        return Object.keys(customerInfo.entitlements.active).length > 0;
    } catch (error) {
        console.error('Error checking subscription status:', error);
        // If we can't verify, we assume they might be subscribed to be safe
        // Or at least allow the caller to handle the error.
        throw error;
    }
};

// In-memory cache for trial availability. Set by isTrialAvailable() after
// the first successful read; consumed synchronously by the paywall-sequence
// entry screen so it can render the right variant without awaiting RC.
let cachedHasTrial: boolean | null = null;

export const getCachedHasTrial = (): boolean | null => {
    if (FORCE_TRIAL) return true;
    return cachedHasTrial;
};

/**
 * Check if a trial is available in the current offering
 */
export const isTrialAvailable = async (): Promise<boolean> => {
    if (FORCE_TRIAL) {
        cachedHasTrial = true;
        return true;
    }
    try {
        const offerings = await Purchases.getOfferings();
        const currentOffering = offerings.current;

        if (currentOffering && currentOffering.availablePackages) {
            const hasTrial = currentOffering.availablePackages.some(
                (pkg) => pkg.product.introPrice && pkg.product.introPrice.periodNumberOfUnits > 0
            );
            cachedHasTrial = hasTrial;
            return hasTrial;
        }
        cachedHasTrial = false;
        return false;
    } catch (error) {
        console.error('Error checking trial availability:', error);
        return false;
    }
};

/**
 * Get the user ID
 */
export const getUserId = async (): Promise<string> => {
    try {
        const customerInfo = await Purchases.getCustomerInfo();
        return customerInfo.originalAppUserId;
    } catch (error) {
        console.error('Error getting user ID:', error);
        throw error;
    }
};
/**
 * Get the path to redirect to when no subscription is present. Always
 * resolves to the single paywall-sequence entry; the page itself reads
 * `entry` and the trial flag to pick the right variant. Synchronous so
 * the splash doesn't have to wait on RC.
 *
 * @param isAppLaunch - If true, marks the entry as "launch" (returning
 * user from a cold launch); otherwise "onboarding".
 */
export const getNoSubscriptionRedirectPath = (isAppLaunch: boolean = false): string => {
    const entry = isAppLaunch ? 'launch' : 'onboarding';
    return `/onboarding/paywall-sequence/page1?entry=${entry}`;
};

/**
 * Log out from RevenueCat
 */
export const logOutRevenueCat = async () => {
    try {
        await Purchases.logOut();
        console.log('✅ RevenueCat logged out');
    } catch (error) {
        console.error('❌ Failed to log out from RevenueCat:', error);
    }
};
