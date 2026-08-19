import { Href, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';

// A drop-in replacement for expo-router's useRouter that debounces navigation so a
// rapid double-tap can't push the same route twice (a transition takes a beat, and
// the button stays pressable during it). The lock is keyed by the action, so two
// DIFFERENT navigations are never blocked — only an identical one repeated inside
// the window. Module-level so it also catches the same target fired from two
// buttons mashed together.
//
// It also guards against navigating before the root navigator has hydrated:
// cold-launch callers (notification taps, the RevenueCat listener, launch
// routing) can fire in the first milliseconds and would throw "Attempted to
// navigate before mounting the Root Layout component". Actions attempted
// before readiness are queued (latest wins) and flushed once the navigator
// exists, so a launch redirect is deferred, never dropped.

const WINDOW_MS = 700;
let lastKey = '';
let lastAt = 0;

function allow(key: string): boolean {
    const now = Date.now();
    if (key === lastKey && now - lastAt < WINDOW_MS) return false;
    lastKey = key;
    lastAt = now;
    return true;
}

const hrefKey = (href: Href): string => (typeof href === 'string' ? href : JSON.stringify(href));

export function useNav() {
    const router = useRouter();
    // No key = the root navigator hasn't mounted/hydrated yet.
    const ready = !!useRootNavigationState()?.key;
    const readyRef = useRef(ready);
    readyRef.current = ready;
    const pendingRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (ready && pendingRef.current) {
            const flush = pendingRef.current;
            pendingRef.current = null;
            flush();
        }
    }, [ready]);

    return useMemo(() => {
        // Run now if the navigator is ready; otherwise hold the LATEST action
        // until it is (launch flows only ever race a single redirect).
        const run = (action: () => void) => {
            if (readyRef.current) {
                action();
            } else {
                pendingRef.current = action;
            }
        };
        return {
            ...router,
            push: (href: Href) => { if (allow('push:' + hrefKey(href))) run(() => router.push(href)); },
            replace: (href: Href) => { if (allow('replace:' + hrefKey(href))) run(() => router.replace(href)); },
            navigate: (href: Href) => { if (allow('navigate:' + hrefKey(href))) run(() => router.navigate(href)); },
            back: () => { if (allow('back')) run(() => router.back()); },
        };
    }, [router]);
}
