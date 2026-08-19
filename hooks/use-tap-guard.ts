import { useCallback, useRef } from 'react';

// Per-instance guard against a fast double-tap firing a button twice (double
// haptic + double onPress). Returns a predicate: the first tap passes, and any
// repeat within `windowMs` is rejected. Each button gets its own timer, so
// tapping two different buttons in quick succession is unaffected.
const DEFAULT_WINDOW_MS = 500;

export function useTapGuard(windowMs = DEFAULT_WINDOW_MS) {
    const lastAt = useRef(0);
    return useCallback(() => {
        const now = Date.now();
        if (now - lastAt.current < windowMs) return false;
        lastAt.current = now;
        return true;
    }, [windowMs]);
}
