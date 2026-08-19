import { PaywallWebView } from '@/components/PaywallWebView';
import { trackEvent } from '@/utils/analytics';
import { isExitOfferEnabled } from '@/utils/remoteConfig';
import { addSpecialOfferQuickAction, removeSpecialOfferQuickAction } from '@/utils/paywallQuickActions';
import { getCustomerInfo, getNoSubscriptionRedirectPath, getOfferings } from '@/utils/revenueCat';
import { logRestore } from '@/utils/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from 'expo-router';
import { useNav } from '@/hooks/use-nav';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { PurchasesOffering } from 'react-native-purchases';
import palette from '@/constants/palette';

// Module-level so it persists across paywall mounts within one app session
// but resets on cold launch — that gives us "first dismissal per cold launch"
// without any storage. Drives the one-time exit-offer divert below.
let exitOfferShownThisLaunch = false;

export default function PaywallScreen() {
    const router = useNav();
    const navigation = useNavigation();
    const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
    const didCompleteRef = useRef(false);
    const hasSeenWelcomeRef = useRef<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;

        const initTrack = async () => {
            try {
                const [customerInfo, offerings, hasSeenWelcome] = await Promise.all([
                    getCustomerInfo(),
                    getOfferings(),
                    AsyncStorage.getItem('HAS_SEEN_WELCOME_FLOW'),
                ]);

                if (cancelled) return;

                if (Object.keys(customerInfo.entitlements.active).length > 0) {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: '(tabs)' }],
                    } as any);
                    return;
                }

                hasSeenWelcomeRef.current = hasSeenWelcome === 'true';

                const offering = offerings.current;
                if (!offering) {
                    console.error('No current offering configured in RevenueCat');
                    return;
                }

                setCurrentOffering(offering);
                trackEvent('Paywall Viewed', { offering_id: offering.identifier });
                addSpecialOfferQuickAction();
            } catch (e) {
                console.error('Failed to init paywall:', e);
            }
        };
        initTrack();

        return () => {
            cancelled = true;
        };
    }, []);

    const goToTabsAfterSuccess = () => {
        didCompleteRef.current = true;
        if (hasSeenWelcomeRef.current) {
            navigation.reset({
                index: 0,
                routes: [{ name: '(tabs)' }],
            } as any);
        } else {
            AsyncStorage.setItem('HAS_SEEN_WELCOME_FLOW', 'true');
            navigation.reset({
                index: 1,
                routes: [{ name: '(tabs)' }, { name: 'how-it-works' }],
            } as any);
        }
    };

    // When the user backs out of the native purchase sheet, divert to the
    // exit-offer (promo) paywall the first time per cold launch.
    // `exitOfferShownThisLaunch` is module-level so it stays true for the rest
    // of the session and resets on the next cold launch — so subsequent
    // cancellations behave normally (the user just stays on the paywall).
    const handlePurchaseCancelled = () => {
        if (isExitOfferEnabled() && !exitOfferShownThisLaunch) {
            exitOfferShownThisLaunch = true;
            trackEvent('Exit Offer Shown', { from_offering_id: currentOffering?.identifier });
            router.replace('/paywall-promo' as any);
        }
    };

    const handleDismiss = async () => {
        if (didCompleteRef.current) return;
        const state = navigation.getState();
        const previousRoute = state?.routes[state.index - 1];
        const isTab = previousRoute?.name === '(tabs)';

        if (router.canGoBack() && !isTab) {
            router.back();
        } else {
            const path = getNoSubscriptionRedirectPath();
            router.replace(path as any);
        }
    };

    if (!currentOffering) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color={palette.slate[500]} />
            </View>
        );
    }

    const offeringId = currentOffering.identifier;

    return (
        <PaywallWebView
            offering={currentOffering}
            offeringId={offeringId}
            onClose={handleDismiss}
            onPurchaseCompleted={(customerInfo) => {
                const products = Object.keys(customerInfo.entitlements.active);
                const isTrial = Object.values(customerInfo.entitlements.active).some(
                    (entitlement) => entitlement.periodType === 'TRIAL',
                );

                if (isTrial) {
                    trackEvent('Paywall Trial Started', {
                        offering_id: offeringId,
                        products,
                    });
                    // FB StartTrial: auto-logged on iOS via StoreKit; fired
                    // manually for Android in PaywallWebView (its auto-IAP
                    // detection doesn't hook RevenueCat's billing client).
                } else {
                    trackEvent('Paywall Subscription Success', {
                        offering_id: offeringId,
                        products,
                    });
                    // FB Purchase: iOS auto-logs; Android fired in PaywallWebView.
                }

                removeSpecialOfferQuickAction();
                goToTabsAfterSuccess();
            }}
            onPurchaseCancelled={handlePurchaseCancelled}
            onPurchaseError={(error) => {
                const message = error instanceof Error ? error.message : String(error);
                Alert.alert('Purchase Error', message);
            }}
            onRestoreCompleted={(customerInfo) => {
                const isActive = Object.keys(customerInfo.entitlements.active).length > 0;
                if (isActive) {
                    trackEvent('Paywall Restore Success', { offering_id: offeringId });
                    logRestore();
                    removeSpecialOfferQuickAction();
                    didCompleteRef.current = true;
                    navigation.reset({
                        index: 0,
                        routes: [{ name: '(tabs)' }],
                    } as any);
                } else {
                    trackEvent('Paywall Restore Failure', {
                        offering_id: offeringId,
                        error: 'no_active_entitlements',
                    });
                    Alert.alert('Restore Failed', 'No active subscription found for this account.');
                }
            }}
            onRestoreError={(error) => {
                const message = error instanceof Error ? error.message : String(error);
                trackEvent('Paywall Restore Failure', {
                    offering_id: offeringId,
                    error: message,
                });
                Alert.alert('Restore Error', message);
            }}
        />
    );
}
