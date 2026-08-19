import palette from '@/constants/palette';
import { PaywallWebView } from '@/components/PaywallWebView';
import { trackEvent } from '@/utils/analytics';
import { removeSpecialOfferQuickAction } from '@/utils/paywallQuickActions';
import {
    PROMO_OFFERING_ID,
    getCustomerInfo,
    getNoSubscriptionRedirectPath,
    getOfferings,
    promoOfferingIdFor,
} from '@/utils/revenueCat';
import { logRestore } from '@/utils/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from 'expo-router';
import { useNav } from '@/hooks/use-nav';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { PurchasesOffering } from 'react-native-purchases';

export default function PaywallPromoScreen() {
    const router = useNav();
    const navigation = useNavigation();
    const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
    // Which discount offering this screen actually ended up on. Not a constant
    // any more: it follows the price-point arm RevenueCat put the user in, and
    // it is what every event below reports.
    const offeringIdRef = useRef<string>(PROMO_OFFERING_ID);
    const didCompleteRef = useRef(false);
    const hasSeenWelcomeRef = useRef<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadOffering = async () => {
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

                // Match the arm the user is already in. Reading `current`
                // rather than taking a route param on purpose: this screen is
                // also reached from the "80% OFF" push and the home-screen
                // quick action, neither of which can pass one.
                //
                // The ?? is for a misconfigured id (renamed or archived
                // offering), not for timing: the standard discount is a better
                // outcome than the permanent spinner this used to show.
                const wanted = promoOfferingIdFor(offerings.current?.identifier);
                const promo = offerings.all[wanted] ?? offerings.all[PROMO_OFFERING_ID];
                if (!promo) {
                    console.error('Promo offering not found');
                    return;
                }

                offeringIdRef.current = promo.identifier;
                setCurrentOffering(promo);
                trackEvent('Paywall Viewed', { offering_id: promo.identifier });
            } catch (e) {
                console.error('Failed to load promo offering', e);
            }
        };
        loadOffering();

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

    return (
        <PaywallWebView
            offering={currentOffering}
            offeringId={offeringIdRef.current}
            onClose={handleDismiss}
            onPurchaseCompleted={(customerInfo) => {
                const products = Object.keys(customerInfo.entitlements.active);
                const isTrial = Object.values(customerInfo.entitlements.active).some(
                    (entitlement) => entitlement.periodType === 'TRIAL',
                );

                if (isTrial) {
                    trackEvent('Paywall Trial Started', {
                        offering_id: offeringIdRef.current,
                        products,
                    });
                    // FB StartTrial: iOS auto-logs; Android fired in PaywallWebView.
                } else {
                    trackEvent('Paywall Subscription Success', {
                        offering_id: offeringIdRef.current,
                        products,
                    });
                    // FB Purchase: iOS auto-logs; Android fired in PaywallWebView.
                }

                removeSpecialOfferQuickAction();
                goToTabsAfterSuccess();
            }}
            onPurchaseCancelled={() => {
                console.log('‼️Promo Purchase cancelled');
            }}
            onPurchaseError={(error) => {
                const message = error instanceof Error ? error.message : String(error);
                Alert.alert('Purchase Error', message);
            }}
            onRestoreCompleted={(customerInfo) => {
                const isActive = Object.keys(customerInfo.entitlements.active).length > 0;
                if (isActive) {
                    trackEvent('Paywall Restore Success', { offering_id: offeringIdRef.current });
                    logRestore();
                    removeSpecialOfferQuickAction();
                    didCompleteRef.current = true;
                    navigation.reset({
                        index: 0,
                        routes: [{ name: '(tabs)' }],
                    } as any);
                } else {
                    trackEvent('Paywall Restore Failure', {
                        offering_id: offeringIdRef.current,
                        error: 'no_active_entitlements',
                    });
                    Alert.alert('Restore Failed', 'No active subscription found for this account.');
                }
            }}
            onRestoreError={(error) => {
                const message = error instanceof Error ? error.message : String(error);
                trackEvent('Paywall Restore Failure', {
                    offering_id: offeringIdRef.current,
                    error: message,
                });
                Alert.alert('Restore Error', message);
            }}
        />
    );
}
