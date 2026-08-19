import ContentColumn from '@/components/ui/ContentColumn';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface PaywallPageLayoutProps {
    header: React.ReactNode;
    children: React.ReactNode;
    footer: React.ReactNode;
}

export function PaywallPageLayout({ header, children, footer }: PaywallPageLayoutProps) {
    const { bottom } = useSafeAreaInsets();

    return (
        <View className="flex-1 bg-white">
            <SafeAreaView className="flex-1 px-6 pt-6" edges={['top']}>
                {/* Cap content width on tablets; no-op on phones. */}
                <ContentColumn style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center' }}>
                    {header}

                    {children}

                    <View
                        className="w-full"
                        style={{ paddingBottom: bottom > 0 ? bottom : 24 }}
                    >
                        {footer}
                    </View>
                </ContentColumn>
            </SafeAreaView>
        </View>
    );
}
