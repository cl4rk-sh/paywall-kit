import GradientButton from '@/components/ui/GradientButton';
import { Text } from '@/components/ui/Text';
import palette from '@/constants/palette';
import { FORCE_TRIAL } from '@/constants/flags';
import { PAYWALL_WEB_BASE_URL, PAYWALL_WEB_PATH_PREFIX } from '@/utils/revenueCat';
import { getAppSettings } from '@/utils/storage';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { WifiOff } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import Purchases, { PurchasesOffering } from 'react-native-purchases';
import { logPurchase, logTrialStarted } from '@/utils/analytics';
import { trackTrialStarted } from '@/utils/analytics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// Fallback for the timeline's "trial reminder" day when the user never made
// a choice on paywall-sequence page 2 (e.g. a launch-entry paywall on a
// fresh install). When a choice exists it's read from AppSettings
// (trialReminderDaysBefore). Display-only this release: the notification
// that keeps the promise ships next update and must use the same source.
const DEFAULT_REMINDER_DAYS_BEFORE_TRIAL_END = 2;

// iOS returns ISO 3166-1 alpha-3 storefront codes; Android returns alpha-2.
// Map the alpha-3s we recognize; anything else → null and the web hides flags.
const ALPHA3_TO_ALPHA2: Record<string, string> = {
    USA: 'US', CAN: 'CA', GBR: 'GB', IRL: 'IE', AUS: 'AU', NZL: 'NZ',
    JPN: 'JP', KOR: 'KR', SGP: 'SG', HKG: 'HK', TWN: 'TW', MAC: 'MO',
    ISR: 'IL', ARE: 'AE', SAU: 'SA', QAT: 'QA', KWT: 'KW', BHR: 'BH', OMN: 'OM',
    NOR: 'NO', SWE: 'SE', FIN: 'FI', DNK: 'DK', ISL: 'IS',
    NLD: 'NL', BEL: 'BE', LUX: 'LU', FRA: 'FR', DEU: 'DE', AUT: 'AT', CHE: 'CH',
    ITA: 'IT', ESP: 'ES', PRT: 'PT', GRC: 'GR', MLT: 'MT', CYP: 'CY',
    CZE: 'CZ', POL: 'PL', HUN: 'HU', SVK: 'SK', SVN: 'SI', HRV: 'HR',
    EST: 'EE', LVA: 'LV', LTU: 'LT', BGR: 'BG', ROU: 'RO',
    MEX: 'MX', BRA: 'BR', ARG: 'AR', CHL: 'CL', COL: 'CO', PER: 'PE', URY: 'UY',
    IND: 'IN', PAK: 'PK', BGD: 'BD', LKA: 'LK', NPL: 'NP',
    PHL: 'PH', IDN: 'ID', MYS: 'MY', THA: 'TH', VNM: 'VN',
    CHN: 'CN', RUS: 'RU', TUR: 'TR', UKR: 'UA',
    ZAF: 'ZA', EGY: 'EG', NGA: 'NG', KEN: 'KE', MAR: 'MA',
};

function normalizeCountry(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const upper = raw.toUpperCase();
    if (upper.length === 2) return upper;
    if (upper.length === 3) return ALPHA3_TO_ALPHA2[upper] ?? null;
    return null;
}


export type PaywallPlan = 'yearly' | 'monthly';

type Pricing = {
    currencyCode: string;
    yearly: {
        price: string;          // "$59.99"
        pricePerMonth: string;  // "$4.99"
        originalPrice?: string; // "$119.88" (12 * monthly)
        trialDays: number;      // 0 if no free trial
        trialPeriod?: string;   // "1 week" / "7 days" / "1 month"
    } | null;
    monthly: {
        // "Secondary" plan slot: monthly preferred, weekly fallback.
        // `period` tells the web how to render the suffix ("/mo" vs
        // "/wk") and the card label ("Monthly" vs "Weekly").
        price: string;          // "$9.99"
        period: 'month' | 'week';
        trialDays: number;
        trialPeriod?: string;
    } | null;
};

function formatCurrency(amount: number, currencyCode: string, locale?: string) {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
        }).format(amount);
    } catch {
        return `${currencyCode} ${amount.toFixed(2)}`;
    }
}

function trialDaysFromIntro(intro: any): number {
    if (!intro) return 0;
    const isFree = (intro.price ?? 0) === 0;
    if (!isFree) return 0;
    const unit: string | undefined = intro.periodUnit ?? intro.period?.unit;
    const n: number = intro.periodNumberOfUnits ?? intro.period?.value ?? intro.cycles ?? 1;
    switch ((unit ?? '').toUpperCase()) {
        case 'DAY': return n;
        case 'WEEK': return n * 7;
        case 'MONTH': return n * 30;
        case 'YEAR': return n * 365;
        default: return 0;
    }
}

function trialPeriodFromIntro(intro: any): string | undefined {
    if (!intro) return undefined;
    const isFree = (intro.price ?? 0) === 0;
    if (!isFree) return undefined;
    const unit: string | undefined = intro.periodUnit ?? intro.period?.unit;
    const n: number = intro.periodNumberOfUnits ?? intro.period?.value ?? intro.cycles ?? 1;
    const u = (unit ?? '').toUpperCase();
    const labelMap: Record<string, string> = {
        DAY: 'Day',
        WEEK: 'Week',
        MONTH: 'Month',
        YEAR: 'Year',
    };
    const label = labelMap[u];
    if (!label) return undefined;
    if (n === 1) return label;
    return `${n} ${label}s`;
}

function buildPricing(offering: PurchasesOffering): Pricing {
    const yearlyPkg = offering.annual ?? offering.availablePackages.find(p => p.packageType === 'ANNUAL');
    const monthlyPkg = offering.monthly ?? offering.availablePackages.find(p => p.packageType === 'MONTHLY');
    const weeklyPkg = offering.weekly ?? offering.availablePackages.find(p => p.packageType === 'WEEKLY');
    // Convention: a custom package with identifier "comparison" holds the
    // un-discounted regular yearly product. Used purely to compute the
    // "% OFF" badge for the promo paywall; never purchased.
    const comparisonPkg = offering.availablePackages.find(p => p.identifier === 'comparison');

    const currencyCode =
        yearlyPkg?.product.currencyCode ??
        monthlyPkg?.product.currencyCode ??
        weeklyPkg?.product.currencyCode ??
        comparisonPkg?.product.currencyCode ??
        'USD';

    // Pick the original/regular yearly price for the strikethrough:
    //   1. Explicit "comparison" package if present (RC has no list-price field).
    //   2. Else extrapolate from the highest-rate shorter package (weekly > monthly).
    let yearlyOriginalPrice: string | undefined;
    if (comparisonPkg) {
        yearlyOriginalPrice = comparisonPkg.product.priceString;
    } else if (weeklyPkg) {
        yearlyOriginalPrice = formatCurrency(weeklyPkg.product.price * 52, currencyCode);
    } else if (monthlyPkg) {
        yearlyOriginalPrice = formatCurrency(monthlyPkg.product.price * 12, currencyCode);
    }

    const yearly = yearlyPkg
        ? {
            price: yearlyPkg.product.priceString,
            pricePerMonth: formatCurrency(yearlyPkg.product.price / 12, currencyCode),
            originalPrice: yearlyOriginalPrice,
            trialDays: trialDaysFromIntro(yearlyPkg.product.introPrice),
            trialPeriod: trialPeriodFromIntro(yearlyPkg.product.introPrice),
        }
        : null;

    // Pick whichever shorter-period package exists for the secondary
    // slot. Monthly wins if both are present; weekly is the fallback
    // for offerings that only ship annual + weekly (e.g. webview-weekly).
    const secondaryPkg = monthlyPkg ?? weeklyPkg;
    const secondaryPeriod: 'month' | 'week' = monthlyPkg ? 'month' : 'week';

    const monthly = secondaryPkg
        ? {
            price: secondaryPkg.product.priceString,
            period: secondaryPeriod,
            trialDays: trialDaysFromIntro(secondaryPkg.product.introPrice),
            trialPeriod: trialPeriodFromIntro(secondaryPkg.product.introPrice),
        }
        : null;

    return { currencyCode, yearly, monthly };
}

export type PaywallWebMessage =
    | { type: 'ready' }
    | { type: 'close' }
    | { type: 'restore' }
    | { type: 'purchase'; plan: PaywallPlan }
    | { type: 'haptic'; style?: 'light' | 'medium' | 'heavy' | 'selection' | 'success' };

interface PaywallWebViewProps {
    offering: PurchasesOffering;
    offeringId: string;
    onClose: () => void;
    onPurchaseStarted?: (plan: PaywallPlan) => void;
    onPurchaseCompleted: (
        customerInfo: Awaited<ReturnType<typeof Purchases.purchasePackage>>['customerInfo'],
        plan: PaywallPlan,
    ) => void;
    onPurchaseCancelled?: () => void;
    onPurchaseError?: (error: unknown, plan: PaywallPlan) => void;
    onRestoreCompleted: (
        customerInfo: Awaited<ReturnType<typeof Purchases.restorePurchases>>,
    ) => void;
    onRestoreError?: (error: unknown) => void;
}

export function PaywallWebView({
    offering,
    offeringId,
    onClose,
    onPurchaseStarted,
    onPurchaseCompleted,
    onPurchaseCancelled,
    onPurchaseError,
    onRestoreCompleted,
    onRestoreError,
}: PaywallWebViewProps) {
    const insets = useSafeAreaInsets();
    const inFlightRef = useRef(false);
    const webViewRef = useRef<WebView | null>(null);

    const notifyPurchaseEnded = () => {
        webViewRef.current?.injectJavaScript(
            "window.__paywallNative && window.__paywallNative.purchaseEnded && window.__paywallNative.purchaseEnded(); true;",
        );
    };
    const [loading, setLoading] = useState(true);
    // True when the paywall page itself fails to load (offline, dev server down,
    // 5xx) — shows a retry screen instead of the WebView's default error page.
    const [loadError, setLoadError] = useState(false);
    const [country, setCountry] = useState<string | null>(null);
    const handleLoadEnd = () => setLoading(false);

    const handleRetry = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoadError(false);
        setLoading(true);
        webViewRef.current?.reload();
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const storefront = await (Purchases as any).getStorefront?.();
                if (cancelled) return;
                setCountry(normalizeCountry(storefront?.countryCode));
            } catch {
                // ignore — leave country null
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const rawPricing = useMemo(() => buildPricing(offering), [offering]);

    // Per-product trial eligibility. RC's introPrice on the product
    // describes the *configured* offer; this API tells us whether THIS
    // user is still eligible (e.g. they already burned their free trial
    // on this subscription group). Null = not yet fetched → assume
    // eligible to avoid flashing the wrong copy.
    const [ineligibleProductIds, setIneligibleProductIds] = useState<Set<string> | null>(null);

    // The reminder-timing choice from paywall-sequence page 2 (2 or 3 days
    // before trial end), read from disk so launch-entry paywalls honor a
    // choice made in an earlier session. Null until loaded; the uri waits
    // for it (a local read, resolved long before the RC eligibility fetch).
    const [reminderDays, setReminderDays] = useState<number | null>(null);
    useEffect(() => {
        let cancelled = false;
        getAppSettings()
            .then((s) => {
                if (!cancelled) setReminderDays(s?.trialReminderDaysBefore ?? DEFAULT_REMINDER_DAYS_BEFORE_TRIAL_END);
            })
            .catch(() => {
                if (!cancelled) setReminderDays(DEFAULT_REMINDER_DAYS_BEFORE_TRIAL_END);
            });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // Dev flag: skip the per-product eligibility check entirely
            // and treat every product as eligible for its intro offer.
            if (FORCE_TRIAL) {
                if (!cancelled) setIneligibleProductIds(new Set());
                return;
            }
            const yearlyPkg = offering.annual ?? offering.availablePackages.find(p => p.packageType === 'ANNUAL');
            const secondaryPkg =
                offering.monthly ??
                offering.availablePackages.find(p => p.packageType === 'MONTHLY') ??
                offering.weekly ??
                offering.availablePackages.find(p => p.packageType === 'WEEKLY');
            const productIds = [
                yearlyPkg?.product.identifier,
                secondaryPkg?.product.identifier,
            ].filter((x): x is string => !!x);
            if (productIds.length === 0) {
                if (!cancelled) setIneligibleProductIds(new Set());
                return;
            }
            try {
                const result = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
                if (cancelled) return;
                const ineligible = new Set<string>();
                for (const id of productIds) {
                    // status: 0 = unknown, 1 = ineligible, 2 = eligible, 3 = no intro offer
                    if (result[id]?.status === 1) ineligible.add(id);
                }
                setIneligibleProductIds(ineligible);
            } catch {
                if (!cancelled) setIneligibleProductIds(new Set());
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [offering]);

    const pricing = useMemo(() => {
        if (!ineligibleProductIds) return rawPricing;
        const yearlyPkg = offering.annual ?? offering.availablePackages.find(p => p.packageType === 'ANNUAL');
        const monthlyPkg =
            offering.monthly ??
            offering.availablePackages.find(p => p.packageType === 'MONTHLY') ??
            offering.weekly ??
            offering.availablePackages.find(p => p.packageType === 'WEEKLY');
        const stripTrial = <T extends { trialDays: number; trialPeriod?: string } | null>(p: T): T => {
            if (!p) return p;
            return { ...p, trialDays: 0, trialPeriod: undefined } as T;
        };
        return {
            ...rawPricing,
            yearly: yearlyPkg && ineligibleProductIds.has(yearlyPkg.product.identifier)
                ? stripTrial(rawPricing.yearly)
                : rawPricing.yearly,
            monthly: monthlyPkg && ineligibleProductIds.has(monthlyPkg.product.identifier)
                ? stripTrial(rawPricing.monthly)
                : rawPricing.monthly,
        };
    }, [rawPricing, ineligibleProductIds, offering]);

    const uri = useMemo(() => {
        // Hold off until eligibility and the reminder choice resolve so the
        // page never renders copy that gets yanked a beat later.
        if (ineligibleProductIds === null || reminderDays === null) return null;
        const params = new URLSearchParams({
            bottomInset: String(Math.round(insets.bottom)),
            topInset: String(Math.round(insets.top)),
            pricing: JSON.stringify(pricing),
            // App version, so the web paywall can branch layout by shipped
            // build — e.g. serve an App Store 3.1.2(c) compliant trial header
            // (renewal price at the same size as the trial copy) to versions
            // that expect it, while older builds still get the original layout.
            appVersion: Constants.expoConfig?.version ?? '',
            // Platform ('ios' | 'android') so the page can branch copy or
            // styling per store when needed.
            os: Platform.OS,
            // Which day the compliant timeline's "trial reminder" step names:
            // the user's page2 pick, or the default when they never chose.
            reminderDaysBeforeEnd: String(reminderDays),
        });
        if (country) params.set('country', country);
        return `${PAYWALL_WEB_BASE_URL}${PAYWALL_WEB_PATH_PREFIX}/${encodeURIComponent(offeringId)}?${params.toString()}`;
    }, [offeringId, insets.bottom, insets.top, pricing, country, ineligibleProductIds, reminderDays]);

    const resolvePackage = (plan: PaywallPlan) => {
        if (plan === 'yearly') return offering.annual ?? offering.availablePackages.find(p => p.packageType === 'ANNUAL');
        // 'monthly' here is the secondary slot — could be a real
        // monthly product OR a weekly fallback (e.g. webview-weekly).
        return (
            offering.monthly ??
            offering.availablePackages.find(p => p.packageType === 'MONTHLY') ??
            offering.weekly ??
            offering.availablePackages.find(p => p.packageType === 'WEEKLY')
        );
    };

    const triggerHaptic = (style: 'light' | 'medium' | 'heavy' | 'selection' | 'success') => {
        switch (style) {
            case 'light':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                break;
            case 'medium':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                break;
            case 'heavy':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                break;
            case 'selection':
                Haptics.selectionAsync();
                break;
            case 'success':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                break;
        }
    };

    const handleMessage = async (event: WebViewMessageEvent) => {
        let msg: PaywallWebMessage;
        try {
            msg = JSON.parse(event.nativeEvent.data);
        } catch {
            return;
        }

        if (msg.type === 'haptic') {
            triggerHaptic(msg.style ?? 'light');
            return;
        }

        if (msg.type === 'close') {
            triggerHaptic('light');
            onClose();
            return;
        }

        if (msg.type === 'restore') {
            triggerHaptic('light');
            try {
                const customerInfo = await Purchases.restorePurchases();
                onRestoreCompleted(customerInfo);
            } catch (e) {
                onRestoreError?.(e);
            }
            return;
        }

        if (msg.type === 'purchase') {
            if (inFlightRef.current) return;
            const pkg = resolvePackage(msg.plan);
            if (!pkg) {
                onPurchaseError?.(new Error(`No ${msg.plan} package on offering`), msg.plan);
                return;
            }
            inFlightRef.current = true;
            triggerHaptic('medium');
            onPurchaseStarted?.(msg.plan);
            try {
                const { customerInfo } = await Purchases.purchasePackage(pkg);
                // (Only the happy path here, not the already-subscribed restore
                // fallback below.)
                const isTrial = Object.values(customerInfo.entitlements.active).some(
                    (e) => e.periodType === 'TRIAL',
                );
                const price = pkg.product.price ?? 0;
                const currency = pkg.product.currencyCode ?? 'USD';

                // TikTok StartTrial, both platforms. A trial start is just a
                // completed store transaction, so TikTok reports it as Purchase
                // and never emits StartTrial itself on either platform —
                // logging it manually can't double-count, and it's the only
                // trial signal we get. TikTok's Purchase needs no manual call
                // anywhere: iOS observes StoreKit, Android queries Play billing
                // history with its own client, which does see RevenueCat's
                // purchases (unlike Meta, which instruments the app's client).
                if (isTrial) {
                    trackTrialStarted(price, currency);
                }

                // Meta only, Android only. Meta's Android auto-IAP detection
                // hooks the app's own BillingClient and so never sees
                // RevenueCat's; iOS stays on auto to avoid double-counting.
                if (Platform.OS === 'android') {
                    if (isTrial) {
                        logTrialStarted(price, currency);
                    } else {
                        logPurchase(price, currency);
                    }
                }
                onPurchaseCompleted(customerInfo, msg.plan);
            } catch (e: any) {
                if (e?.userCancelled) {
                    onPurchaseCancelled?.();
                } else {
                    // If purchase failed because StoreKit thinks the user
                    // is already subscribed (e.g. another Apple ID on the
                    // device, prior install, or RC hadn't synced the
                    // receipt yet), just let them in — treat it like a
                    // completed purchase if the entitlement is now active.
                    try {
                        const customerInfo = await Purchases.getCustomerInfo();
                        if (Object.keys(customerInfo.entitlements.active).length > 0) {
                            onPurchaseCompleted(customerInfo, msg.plan);
                            return;
                        }
                    } catch {
                        // fall through to original error
                    }
                    onPurchaseError?.(e, msg.plan);
                }
            } finally {
                inFlightRef.current = false;
                notifyPurchaseEnded();
            }
        }
    };

    return (
        <View className="flex-1 bg-white">
            {uri && (
                <WebView
                    ref={webViewRef}
                    source={{ uri }}
                    onMessage={handleMessage}
                    onLoadStart={() => setLoadError(false)}
                    onLoadEnd={handleLoadEnd}
                    // A network failure (offline / unreachable host) blocks the paywall.
                    onError={() => { setLoadError(true); setLoading(false); }}
                    // An HTTP error only counts if it's the paywall document itself
                    // failing, not a subresource (analytics pixel, font, etc.).
                    onHttpError={(e) => {
                        const failed = e.nativeEvent.url ?? '';
                        if (uri && failed.split('?')[0] === uri.split('?')[0]) {
                            setLoadError(true);
                            setLoading(false);
                        }
                    }}
                    javaScriptEnabled
                    domStorageEnabled
                    originWhitelist={['*']}
                    style={{ backgroundColor: 'white', opacity: loading || loadError ? 0 : 1 }}
                />
            )}
            {loading && !loadError && (
                <View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'white',
                    }}
                >
                    <ActivityIndicator size="large" color={palette.slate[500]} />
                </View>
            )}
            {loadError && (
                <View
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'white',
                        paddingHorizontal: 32,
                    }}
                >
                    <WifiOff size={40} color={palette.slate[300]} strokeWidth={2.5} />
                    <View style={{ height: 16 }} />
                    <Text variant="h3" className="text-slate-800 text-center">Couldn&apos;t load this page</Text>
                    <View style={{ height: 6 }} />
                    <Text variant="body" className="text-slate-400 text-center">
                        Check your connection and try again.
                    </Text>
                    <View style={{ height: 18 }} />
                    <GradientButton
                        label="Try again"
                        size="sm"
                        onPress={handleRetry}
                        style={{ borderRadius: 14 }}
                    />
                </View>
            )}
        </View>
    );
}
