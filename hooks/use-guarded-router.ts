import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Drop-in replacement for `useRouter()` that prevents navigation spam.
 *
 * A navigation only fires when the calling screen is currently focused AND no
 * navigation is already in flight. During a transition the source screen loses
 * focus, so rapid "Continue"/"Next" taps can't push the same route multiple
 * times before the transition finishes — the page must be fully navigated to
 * (focused) before its button works again. The in-flight lock is released when
 * the screen regains focus (e.g. after navigating back).
 *
 * Exposes the same `push`/`replace`/`navigate`/`back` API as `useRouter()`, so
 * call sites stay identical — just swap the hook.
 */
export function useGuardedRouter() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const navigating = useRef(false);

    useEffect(() => {
        if (isFocused) navigating.current = false;
    }, [isFocused]);

    const run = useCallback((fn: () => void) => {
        if (!isFocused || navigating.current) return;
        navigating.current = true;
        fn();
    }, [isFocused]);

    return {
        push: useCallback((href: any) => run(() => router.push(href)), [run, router]),
        replace: useCallback((href: any) => run(() => router.replace(href)), [run, router]),
        navigate: useCallback((href: any) => run(() => router.navigate(href)), [run, router]),
        back: useCallback(() => run(() => router.back()), [run, router]),
    };
}
