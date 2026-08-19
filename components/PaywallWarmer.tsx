import React from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { PAYWALL_WEB_BASE_URL, PAYWALL_WEB_PATH_PREFIX } from '@/utils/revenueCat';

// Every offering ID listed here gets an invisible WebView mounted at app
// launch so its HTML/JS/CSS/images are warm in the cache by the time the
// user actually reaches the paywall. Two chunks matter: the default
// paywall and the promo paywall (different React components → different
// JS chunks), so warming one of each is enough for the shared assets; the
// rest of the offerings reuse those chunks and only differ in RC data.
//
// Kept deliberately short: each entry is a live WebView holding memory for
// the whole session.
const OFFERING_IDS_TO_WARM = [
    'webview-weekly',
    // Price-point A/B arm served as `current` by the RevenueCat experiment.
    'webview-weekly-high',
    // Exit offer. webview-promo-high is intentionally NOT warmed: it shares
    // the promo chunk with this one (see promoOfferingIdFor).
    'webview-promo',
];

export function PaywallWarmer() {
    return (
        <View
            pointerEvents="none"
            style={{
                position: 'absolute',
                width: 1,
                height: 1,
                opacity: 0,
                overflow: 'hidden',
            }}
        >
            {OFFERING_IDS_TO_WARM.map((id) => (
                <WebView
                    key={id}
                    source={{
                        uri: `${PAYWALL_WEB_BASE_URL}${PAYWALL_WEB_PATH_PREFIX}/${encodeURIComponent(id)}`,
                    }}
                    cacheEnabled
                    javaScriptEnabled
                    domStorageEnabled
                    originWhitelist={['*']}
                    style={{ backgroundColor: 'transparent' }}
                />
            ))}
        </View>
    );
}
