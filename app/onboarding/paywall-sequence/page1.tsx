import { NoTrialPaywallPage } from '@/components/onboarding/NoTrialPaywallPage';
import { PaywallPageLayout } from '@/components/onboarding/PaywallPageLayout';
import ProductVideo from '@/components/ProductVideo';
import Button from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import palette from '@/constants/palette';
import { useGuardedRouter } from '@/hooks/use-guarded-router';
import { trackEvent } from '@/utils/analytics';
import { getCachedHasTrial, getOfferings, isTrialAvailable } from '@/utils/revenueCat';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

// Copy variants for the no-trial layout, keyed by where the user came from.
// TODO: replace with your own copy. The split matters more than the wording —
// a returning user reopening the app ("launch") responds to continuity, a
// first-run user ("onboarding") to social proof.
const NO_TRIAL_COPY = {
    launch: {
        titleLine1: "You're so close",
        titleLine2: 'to reaching your goal',
        buttonLabel: 'Continue',
        eventPage: 'no-trial-app-launch',
    },
    onboarding: {
        titleLine1: 'Join thousands of people',
        titleLine2: 'making real progress',
        buttonLabel: 'Start My Journey',
        eventPage: 'no-trial-page-1',
    },
} as const;

type Entry = keyof typeof NO_TRIAL_COPY;

export default function PaywallSequencePage1() {
    const router = useGuardedRouter();
    const params = useLocalSearchParams<{ entry?: string; trial?: string }>();
    const entry: Entry = params.entry === 'launch' ? 'launch' : 'onboarding';
    // Dev override: ?trial=1 forces the trial variant regardless of RC state.
    const forceTrial = params.trial === '1';

    // Read from the synchronous cache populated by RC pre-warm (in
    // initializeRevenueCat). Null = unknown yet → optimistically render the
    // trial variant and swap if the async check disagrees.
    const [hasTrial, setHasTrial] = useState<boolean | null>(forceTrial ? true : getCachedHasTrial());

    useEffect(() => {
        if (hasTrial !== null) return;
        let cancelled = false;
        isTrialAvailable()
            .then((trial) => {
                if (!cancelled) setHasTrial(trial);
            })
            .catch(() => {
                // Default to trial-available copy on error; the actual
                // paywall will handle product reality.
                if (!cancelled) setHasTrial(true);
            });
        return () => {
            cancelled = true;
        };
    }, [hasTrial]);

    // Localized "free trial" price for the CTA, e.g. "$0.00" / "£0.00" / "€0.00".
    // Falls back to "$0.00" until the offering's currency loads.
    const [zeroPrice, setZeroPrice] = useState('$0.00');
    useEffect(() => {
        let cancelled = false;
        getOfferings()
            .then((offerings) => {
                const code = offerings?.current?.availablePackages?.[0]?.product?.currencyCode;
                if (cancelled || !code) return;
                try {
                    setZeroPrice(new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(0));
                } catch {
                    // keep the default
                }
            })
            .catch(() => { /* keep the default */ });
        return () => { cancelled = true; };
    }, []);

    if (hasTrial === null) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color={palette.slate[500]} />
            </View>
        );
    }

    if (hasTrial === false) {
        const copy = NO_TRIAL_COPY[entry];
        return <NoTrialPaywallPage {...copy} />;
    }

    const handleContinue = () => {
        trackEvent('Onboarding Step Completed', {
            step: 24,
            page: 'paywall-sequence-1',
            entry,
        });
        router.push('/onboarding/paywall-sequence/page2');
    };

    return (
        <PaywallPageLayout
            header={
                <View className="items-center mt-8">
                    {/* TODO: your copy. Line 2 is the coloured emphasis line. */}
                    <Text variant="h1" className="text-center text-slate-900">We offer 7 days for free</Text>
                    <Text variant="h1" className="text-center !text-sky-500">so everyone can get started</Text>
                </View>
            }
            footer={
                <Button
                    label={`Try for ${zeroPrice}`}
                    size="lg"
                    onPress={handleContinue}
                    className="w-full"
                />
            }
        >
            <ProductVideo />
        </PaywallPageLayout>
    );
}
