import { Text } from '@/components/ui/Text';
import { coloredShadow } from '@/constants/designTokens';
import { sky, slate, white } from '@/constants/palette';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

interface SelectionCardProps {
    label: string;
    selected: boolean;
    onPress: () => void;
    type?: 'radio' | 'checkbox';
    className?: string;
    /** Optional accessory pinned to the right edge (e.g. a date). */
    right?: React.ReactNode;
}

/** Onboarding answer card — flat soft white, selected = orange tint + accent. */
export function SelectionCard({ label, selected, onPress, type = 'radio', className = '', right }: SelectionCardProps) {
    const handlePress = () => {
        Haptics.selectionAsync();
        onPress();
    };

    return (
        <Pressable
            onPress={handlePress}
            className={`w-full flex-row items-center px-5 py-4 rounded-2xl active:opacity-90 ${className}`}
            style={selected
                ? { backgroundColor: white, borderWidth: 2, borderColor: sky.DEFAULT, ...coloredShadow(sky.DEFAULT, 0.15) }
                : { backgroundColor: white, borderWidth: 2, borderColor: slate[200] }}
        >
            <View
                className="mr-4 items-center justify-center"
                style={{
                    width: 24,
                    height: 24,
                    borderRadius: type === 'radio' ? 12 : 8,
                    backgroundColor: selected ? sky.DEFAULT : 'transparent',
                    // Constant width (border blends into the fill when selected) so nothing shifts.
                    borderWidth: 2,
                    borderColor: selected ? sky.DEFAULT : slate[300],
                }}
            >
                {selected && <Check size={15} color={white} strokeWidth={3.5} />}
            </View>

            <Text variant="h3" className={selected ? 'text-slate-800' : 'text-slate-600'} lastLineFix={false}>
                {label}
            </Text>

            {right && <View className="ml-auto pl-4">{right}</View>}
        </Pressable>
    );
}
