import ProductVideo from '@/components/ProductVideo';
import Button from '@/components/ui/Button';
import ContentColumn from '@/components/ui/ContentColumn';
import { Text } from '@/components/ui/Text';
import { trackEvent } from '@/utils/analytics';
import { useGuardedRouter } from '@/hooks/use-guarded-router';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface NoTrialPaywallPageProps {
    titleLine1: string;
    titleLine2: string;
    buttonLabel: string;
    /** Analytics page identifier — used in the Onboarding Step Completed event. */
    eventPage: string;
}

export function NoTrialPaywallPage({
    titleLine1,
    titleLine2,
    buttonLabel,
    eventPage,
}: NoTrialPaywallPageProps) {
    const router = useGuardedRouter();
    const { bottom } = useSafeAreaInsets();

    const handleContinue = () => {
        trackEvent('Onboarding Step Completed', {
            step: 17,
            page: eventPage,
        });
        router.push('/paywall');
    };

    return (
        <View className="flex-1 bg-white">
            <SafeAreaView className="flex-1 px-6 pt-6" edges={['top']}>
                {/* Cap content width on tablets; no-op on phones. */}
                <ContentColumn style={{ flex: 1, justifyContent: 'space-between' }}>
                    <View className="flex-1 w-full items-center justify-center">
                        <ProductVideo />
                    </View>

                    <View className="items-center gap-1">
                        <Text variant="h1" className="text-center">{titleLine1}</Text>
                        <Text variant="h1" className="text-center !text-sky">{titleLine2}</Text>
                    </View>
                </ContentColumn>
            </SafeAreaView>

            <View
                className="px-6 pt-6 bg-white"
                style={{ paddingBottom: bottom > 0 ? bottom : 24 }}
            >
                <ContentColumn>
                    <Button
                        label={buttonLabel}
                        size="lg"
                        onPress={handleContinue}
                        className="w-full"
                    />
                </ContentColumn>
            </View>
        </View>
    );
}
