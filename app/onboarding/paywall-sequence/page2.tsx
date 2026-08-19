import { PaywallPageLayout } from '@/components/onboarding/PaywallPageLayout';
import { SelectionCard } from '@/components/onboarding/SelectionCard';
import Button from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { slate } from '@/constants/palette';
import { useGuardedRouter } from '@/hooks/use-guarded-router';
import { trackEvent } from '@/utils/analytics';
import { saveAppSettings } from '@/utils/storage';
import LottieView from 'lottie-react-native';
import { ShieldCheck } from 'lucide-react-native';
import React, { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

// The free trial runs for 7 days. A reminder "N days before" the trial ends
// therefore fires (7 - N) days from now.
const TRIAL_LENGTH_DAYS = 7;
const REMINDER_OPTIONS = [2, 3] as const;
type DaysBefore = (typeof REMINDER_OPTIONS)[number];

function reminderDateFor(daysBefore: DaysBefore) {
    const date = new Date();
    date.setDate(date.getDate() + (TRIAL_LENGTH_DAYS - daysBefore));
    return date;
}

function formatDate(date: Date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PaywallSequencePage2() {
    const router = useGuardedRouter();
    const [daysBefore, setDaysBefore] = useState<DaysBefore | null>(null);
    // The bell reads small on a tablet canvas; scale it up modestly there.
    const { width: winW } = useWindowDimensions();
    const bellSize = winW >= 600 ? 320 : 260;

    const handleContinue = async () => {
        trackEvent('Onboarding Step Completed', {
            step: 25,
            page: 'paywall-sequence-2',
            reminder_days_before: daysBefore,
        });
        // Persist the choice BEFORE the paywall mounts: its trial timeline
        // reads this to cite the day the user just picked (and next update
        // the real reminder notification schedules with it).
        if (daysBefore !== null) {
            await saveAppSettings({ trialReminderDaysBefore: daysBefore });
        }
        router.push('/paywall');
    };

    return (
        <PaywallPageLayout
            header={
                <View className="items-center mt-8">
                    {daysBefore === null ? (
                        <Text variant="h1" className="text-center text-slate-900 leading-normal">
                            When should we remind you before your trial ends?
                        </Text>
                    ) : (
                        <Text variant="h1" className="text-center text-slate-900 leading-normal">
                            We&apos;ll remind you{' '}
                            <Text variant="h1" className="!text-sky-500">
                                {daysBefore}{' '}days
                            </Text>{' '}
                            before your trial ends
                        </Text>
                    )}
                </View>
            }
            footer={
                <View className="w-full">
                    <View className="flex-row items-center justify-center gap-1.5 mb-3">
                        <ShieldCheck size={17} color={slate[400]} strokeWidth={2} />
                        <Text
                            variant="body"
                            className="!text-base font-nunito-semi text-slate-400 !leading-relaxed"
                            lastLineFix={false}
                        >
                            Easy to cancel, no penalties or fees
                        </Text>
                    </View>
                    <Button
                        label="Continue for FREE"
                        size="lg"
                        onPress={handleContinue}
                        disabled={daysBefore === null}
                        className="w-full"
                    />
                </View>
            }
        >
            <View className="w-full flex-1 items-center justify-end">
                <View className="flex-1 items-center justify-center">
                    <LottieView
                        source={require('@/assets/lottie/bell.json')}
                        autoPlay
                        style={{ width: bellSize, height: bellSize }}
                    />
                </View>

                <View className="w-full gap-3 mb-8">
                    {REMINDER_OPTIONS.map((option) => (
                        <SelectionCard
                            key={option}
                            label={`${option} days before`}
                            selected={daysBefore === option}
                            onPress={() => setDaysBefore(option)}
                            right={
                                <Text
                                    variant="h3"
                                    className={daysBefore === option ? '!text-sky-500' : 'text-slate-400'}
                                    lastLineFix={false}
                                >
                                    {formatDate(reminderDateFor(option))}
                                </Text>
                            }
                        />
                    ))}
                </View>
            </View>
        </PaywallPageLayout>
    );
}
