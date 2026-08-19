import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import { AppState, View } from 'react-native';

// The looping product clip behind the first paywall page. Muted, no controls,
// and it restarts when the app returns to the foreground so it is never frozen
// on a black frame.
//
// NOTE: assets/video/product.mp4 is NOT included in this kit — drop your own
// clip in at that path. Keep it short (a few seconds), silent, and framed for a
// tall portrait crop; it is contentFit="contain" inside a 288pt-wide column.
export default function ProductVideo() {
    const player = useVideoPlayer(require('@/assets/video/product.mp4'), player => {
        player.loop = true;
        player.play();
        player.muted = true;
    });

    React.useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                player.play();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [player]);

    return (
        <View className="flex-1 w-full pointer-events-none mb-8 justify-center items-center">
            <View className="w-full h-full max-w-72">
                <VideoView
                    player={player}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                    nativeControls={false}
                />
            </View>
        </View>
    );
}
