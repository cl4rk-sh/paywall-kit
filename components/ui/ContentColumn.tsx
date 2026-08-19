import { MAX_CONTENT_WIDTH } from '@/constants/designTokens';
import React from 'react';
import { View, ViewProps } from 'react-native';

/**
 * Centers its children in a column capped at MAX_CONTENT_WIDTH so screens stay
 * readable on tablets. Phones are narrower than the cap, so this renders
 * exactly like a plain full-width View there.
 *
 * Drop it directly inside a ScrollView (or a screen root) around the content;
 * keep page padding on the outer container so the scroll surface stays
 * full-bleed while the content column centers.
 */
export default function ContentColumn({ style, ...rest }: ViewProps) {
    return (
        <View
            style={[{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' }, style]}
            {...rest}
        />
    );
}
